import { useRef, useCallback } from 'react';
import { encodeWAV } from '../audioUtils.js';

export function useDAW() {
  const canvasRef = useRef(null);
  const audioBufferRef = useRef(null);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(100);
  const eqLowRef = useRef(0);
  const eqMidRef = useRef(0);
  const eqHighRef = useRef(0);

  const setAudioBuffer = useCallback((buf) => {
    audioBufferRef.current = buf;
    drawWave();
  }, [drawWave]);

  const setTrim = useCallback((start, end) => {
    trimStartRef.current = start;
    trimEndRef.current = end;
    drawWave();
  }, [drawWave]);

  const setEQ = useCallback((low, mid, high) => {
    eqLowRef.current = low;
    eqMidRef.current = mid;
    eqHighRef.current = high;
  }, []);

  const drawWave = useCallback(() => {
    const cnv = canvasRef.current;
    if (!cnv || !audioBufferRef.current) return;
    const c = cnv.getContext('2d');
    const W = cnv.width = cnv.offsetWidth * 2;
    const H = cnv.height = cnv.offsetHeight * 2;
    c.clearRect(0, 0, W, H);
    const data = audioBufferRef.current.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / W));
    c.strokeStyle = '#FFB81C';
    c.lineWidth = 2;
    c.beginPath();
    let max = 0;
    for (let i = 0; i < data.length; i += 100) max = Math.max(max, Math.abs(data[i]));
    if (max === 0) max = 1;
    for (let i = 0; i < W; i++) {
      let sum = 0, cnt = 0;
      for (let j = 0; j < step && (i * step + j) < data.length; j++) { sum += Math.abs(data[i * step + j]); cnt++; }
      const y = (sum / cnt / max) * H / 2;
      c.lineTo(i, H / 2 - y);
    }
    c.stroke();
    c.lineTo(W, H / 2); c.stroke();
    for (let i = 0; i < W; i++) {
      let sum = 0, cnt = 0;
      for (let j = 0; j < step && (i * step + j) < data.length; j++) { sum += Math.abs(data[i * step + j]); cnt++; }
      const y = -(sum / cnt / max) * H / 2;
      c.lineTo(i, H / 2 - y);
    }
    c.stroke();
    c.fillStyle = 'rgba(255,184,28,.12)'; c.fill();
    const ts = trimStartRef.current / 100;
    const te = trimEndRef.current / 100;
    c.strokeStyle = '#E040FB'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(ts * W, 0); c.lineTo(ts * W, H); c.stroke();
    c.beginPath(); c.moveTo(te * W, 0); c.lineTo(te * W, H); c.stroke();
  }, []);

  const getTrimmedInfo = useCallback(() => {
    const buf = audioBufferRef.current;
    if (!buf) return null;
    const ts = trimStartRef.current / 100;
    const te = trimEndRef.current / 100;
    return {
      start: Math.floor(ts * buf.length),
      end: Math.floor(te * buf.length),
      sr: buf.sampleRate,
      channels: buf.numberOfChannels,
      data: buf,
    };
  }, []);

  const process = useCallback(async () => {
    const info = getTrimmedInfo();
    if (!info) return null;
    const len = info.end - info.start;
    const offCtx = new OfflineAudioContext(info.channels, len, info.sr);
    const src = offCtx.createBufferSource(); src.buffer = info.data;
    const low = offCtx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 300; low.gain.value = eqLowRef.current;
    const mid = offCtx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 1; mid.gain.value = eqMidRef.current;
    const high = offCtx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 3000; high.gain.value = eqHighRef.current;
    src.connect(low); low.connect(mid); mid.connect(high); high.connect(offCtx.destination);
    src.start(0, info.start / info.sr, len / info.sr);
    const rendered = await offCtx.startRendering();
    audioBufferRef.current = rendered;
    drawWave();
    return rendered;
  }, [drawWave, getTrimmedInfo]);

  const exportWAV = useCallback(() => {
    const buf = audioBufferRef.current;
    if (!buf) return;
    const wav = encodeWAV(buf);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(wav);
    a.download = 'byflow_audio.wav';
    a.click();
  }, []);

  return { canvasRef, setAudioBuffer, setTrim, setEQ, drawWave, process, exportWAV };
}
