import { useRef, useCallback, useState } from 'react';
import { encodeWAV } from '../audioUtils.js';

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const vidRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const vidChunksRef = useRef([]);
  const audioChunksRef = useRef([]);
  const lastVidBlobRef = useRef(null);
  const audioBlobRef = useRef(null);
  const audioBufferRef = useRef(null);
  const timerRef = useRef(null);
  const recStartRef = useRef(0);

  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const start = useCallback((videoStream, destNode) => {
    if (!videoStream || !destNode) return;
    vidChunksRef.current = [];
    audioChunksRef.current = [];
    const vm = new MediaStream();
    videoStream.getVideoTracks().forEach(t => vm.addTrack(t));
    destNode.stream.getAudioTracks().forEach(t => vm.addTrack(t));

    const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    vidRecorderRef.current = new MediaRecorder(vm, { mimeType: mime, videoBitsPerSecond: 2500000 });
    vidRecorderRef.current.ondataavailable = (e) => { if (e.data.size) vidChunksRef.current.push(e.data); };
    vidRecorderRef.current.onstop = () => {
      lastVidBlobRef.current = new Blob(vidChunksRef.current, { type: vidRecorderRef.current.mimeType });
      clearInterval(timerRef.current);
      setIsRecording(false);
      setRecSeconds(0);
    };

    const aStream = new MediaStream();
    destNode.stream.getAudioTracks().forEach(t => aStream.addTrack(t));
    audioRecorderRef.current = new MediaRecorder(aStream, { mimeType: 'audio/webm' });
    audioRecorderRef.current.ondataavailable = (e) => { if (e.data.size) audioChunksRef.current.push(e.data); };
    audioRecorderRef.current.onstop = async () => {
      audioBlobRef.current = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const ab = await audioBlobRef.current.arrayBuffer();
      try {
        audioBufferRef.current = await destNode.context.decodeAudioData(ab);
      } catch (e) { console.warn('decode err', e); }
    };

    vidRecorderRef.current.start();
    audioRecorderRef.current.start();
    recStartRef.current = Date.now();
    timerRef.current = setInterval(() => setRecSeconds(Math.floor((Date.now() - recStartRef.current) / 1000)), 1000);
    setIsRecording(true);
  }, []);

  const stop = useCallback(() => {
    vidRecorderRef.current?.stop();
    audioRecorderRef.current?.stop();
  }, []);

  const toggle = useCallback((videoStream, destNode) => {
    if (isRecording) {
      stop();
      return false;
    }
    start(videoStream, destNode);
    return true;
  }, [isRecording, start, stop]);

  const getVideoBlob = useCallback(() => lastVidBlobRef.current, []);
  const getAudioBuffer = useCallback(() => audioBufferRef.current, []);
  const getAudioBlob = useCallback(() => audioBlobRef.current, []);

  const downloadVideo = useCallback(() => {
    const blob = lastVidBlobRef.current;
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'byflow_studio.mp4';
    a.click();
  }, []);

  const downloadWAV = useCallback(async () => {
    const blob = audioBlobRef.current;
    if (!blob) return;
    const ab = await blob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(ab);
    const wav = encodeWAV(buf);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(wav);
    a.download = 'byflow_audio.wav';
    a.click();
  }, []);

  const shareVideo = useCallback(async () => {
    const blob = lastVidBlobRef.current;
    if (!blob) return;
    const f = new File([blob], 'byflow_studio.mp4', { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: 'ByFlow STUDIO 🎛', text: 'Producido con ByFlow STUDIO 🐝 #ByFlow #IArtLabs' }); } catch (e) {}
    }
  }, []);

  return {
    isRecording,
    recDisplay: fmtTime(recSeconds),
    toggle,
    getVideoBlob,
    getAudioBuffer,
    getAudioBlob,
    downloadVideo,
    downloadWAV,
    shareVideo,
  };
}
