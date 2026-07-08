import { useState, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_SECONDS = 600;

export function useBeatAI() {
  const [beatUrl, setBeatUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const sourceNodesRef = useRef([]);
  const pollTimerRef = useRef(null);
  const pollLockRef = useRef(false);
  const cancelledRef = useRef(false);

  const clearPoll = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    clearPoll();
  };

  const generateBeat = useCallback(async (prompt, options = {}) => {
    const { bpm = 90, duration = 8, style = 'trap' } = options;
    cancel();
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    setStatus('Enviando trabajo de generación…');
    setProgress(5);
    setBeatUrl(null);

    try {
      const res = await fetch('/api/ai/generate-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, bpm, duration, style }),
      });
      if (cancelledRef.current) return;
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend error ${res.status}: ${txt}`);
      }
      const data = await res.json();
      if (!data.job_id) {
        throw new Error('Respuesta sin job_id');
      }

      const jobId = data.job_id;
      const checkUrl = data.check_url || `/api/ai/beat-status/${jobId}`;
      setStatus('Generando beat con IA…');
      setProgress(15);

      const startTime = Date.now();
      await new Promise((resolve, reject) => {
        pollTimerRef.current = setInterval(async () => {
          if (pollLockRef.current || cancelledRef.current) return;
          pollLockRef.current = true;
          try {
            const statusRes = await fetch(checkUrl);
            if (!statusRes.ok) {
              clearPoll();
              reject(new Error(`Error consultando estado: ${statusRes.status}`));
              return;
            }
            const job = await statusRes.json();
            const elapsed = (Date.now() - startTime) / 1000;
            setProgress(Math.min(90, 15 + elapsed * 1.5));

            if (job.status === 'done') {
              clearPoll();
              const result = job.result || {};
              if (result.audio_b64) {
                const blob = await fetch(`data:audio/wav;base64,${result.audio_b64}`).then(r => r.blob());
                const localUrl = URL.createObjectURL(blob);
                setBeatUrl(localUrl);
                setStatus(`Beat listo ✓ (${result.inference_seconds || '?' }s en ${result.device || '?'})`);
                setProgress(100);
                resolve(localUrl);
              } else if (result.audio_url || result.url) {
                const url = result.audio_url || result.url;
                setBeatUrl(url);
                setStatus('Beat listo ✓');
                setProgress(100);
                resolve(url);
              } else {
                reject(new Error('Resultado sin audio_b64 ni audio_url'));
              }
            } else if (job.status === 'error') {
              clearPoll();
              reject(new Error(job.error || 'Error desconocido en generación'));
            } else if (elapsed > MAX_POLL_SECONDS) {
              clearPoll();
              reject(new Error('Timeout esperando el beat'));
            }
          } catch (e) {
            clearPoll();
            reject(e);
          } finally {
            pollLockRef.current = false;
          }
        }, POLL_INTERVAL_MS);
      });
    } catch (e) {
      if (cancelledRef.current) return;
      setError(e.message);
      setStatus('Error generando beat');
      throw e;
    } finally {
      if (!cancelledRef.current) setLoading(false);
      clearPoll();
      pollLockRef.current = false;
    }
  }, []);

  const playBeat = useCallback(async (actx, destination, volume = 0.5, onEnded) => {
    if (!beatUrl || !actx) return;
    if (actx.state === 'suspended') await actx.resume();
    sourceNodesRef.current.forEach(n => { try { n.stop(); } catch {} });
    sourceNodesRef.current = [];

    const response = await fetch(beatUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await actx.decodeAudioData(arrayBuffer);
    const src = actx.createBufferSource();
    src.buffer = audioBuffer;
    src.loop = true;
    src.onended = () => onEnded?.();
    const gain = actx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(destination || actx.destination);
    src.start();
    sourceNodesRef.current.push(src);
    audioRef.current = { src, gain };
  }, [beatUrl]);

  const stopBeat = useCallback(() => {
    sourceNodesRef.current.forEach(n => { try { n.stop(); } catch {} });
    sourceNodesRef.current = [];
  }, []);

  const setVolume = useCallback((vol) => {
    if (audioRef.current?.gain) {
      audioRef.current.gain.gain.setTargetAtTime(vol, audioRef.current.gain.context.currentTime, 0.05);
    }
  }, []);

  return { beatUrl, loading, error, status, progress, generateBeat, playBeat, stopBeat, setVolume, cancel };
}
