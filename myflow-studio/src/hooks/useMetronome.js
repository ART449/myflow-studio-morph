import { useRef, useCallback, useEffect } from 'react';

export function useMetronome() {
  const actxRef = useRef(null);
  const metroRef = useRef({ on: false, bpm: 90, sig: '4/4', beat: 0, next: 0, vol: 0.5, tapTimes: [] });
  const rafRef = useRef(null);

  const setAudioContext = useCallback((actx) => { actxRef.current = actx; }, []);

  const playClick = useCallback(async (t, accent) => {
    const actx = actxRef.current;
    if (!actx || metroRef.current.vol <= 0.001) return;
    if (actx.state === 'suspended') {
      try { await actx.resume(); } catch (e) { return; }
    }
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(accent ? 1000 : 760, t);
    const peak = metroRef.current.vol * (accent ? 0.9 : 0.55);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t);
    o.stop(t + 0.1);
  }, []);

  const schedule = useCallback((onPulse) => {
    const actx = actxRef.current;
    if (!actx || !metroRef.current.on) return;
    const m = metroRef.current;
    const now = actx.currentTime;
    while (m.next < now + 0.1) {
      const accent = m.beat === 0;
      playClick(m.next, accent);
      onPulse?.({ beat: m.beat, accent, time: m.next });
      const beatsPerBar = m.sig === '3/4' ? 3 : (m.sig === '6/8' ? 6 : 4);
      const secPerBeat = 60 / m.bpm * (m.sig === '6/8' ? 2 / 3 : 1);
      m.beat = (m.beat + 1) % beatsPerBar;
      m.next += secPerBeat;
    }
  }, [playClick]);

  const start = useCallback((onPulse) => {
    const actx = actxRef.current;
    if (!actx || metroRef.current.on) return;
    metroRef.current.on = true;
    metroRef.current.beat = 0;
    metroRef.current.next = actx.currentTime + 0.05;
    const loop = () => {
      if (!metroRef.current.on) return;
      schedule(onPulse);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [schedule]);

  const stop = useCallback(() => {
    metroRef.current.on = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const setBpm = useCallback((bpm) => {
    metroRef.current.bpm = Math.max(40, Math.min(200, bpm));
    const actx = actxRef.current;
    if (actx && metroRef.current.on) metroRef.current.next = actx.currentTime + 0.02;
  }, []);

  const setSig = useCallback((sig) => { metroRef.current.sig = sig; }, []);

  const setVol = useCallback((vol) => { metroRef.current.vol = vol; }, []);

  const tap = useCallback(() => {
    const now = Date.now();
    const m = metroRef.current;
    m.tapTimes = m.tapTimes.filter(t => now - t < 2000);
    m.tapTimes.push(now);
    if (m.tapTimes.length > 1) {
      const intervals = [];
      for (let i = 1; i < m.tapTimes.length; i++) intervals.push(m.tapTimes[i] - m.tapTimes[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      m.bpm = Math.max(40, Math.min(200, Math.round(60000 / avg)));
      return m.bpm;
    }
    return null;
  }, []);

  const getState = useCallback(() => ({ ...metroRef.current }), []);

  useEffect(() => () => stop(), [stop]);

  return { setAudioContext, start, stop, setBpm, setSig, setVol, tap, getState };
}
