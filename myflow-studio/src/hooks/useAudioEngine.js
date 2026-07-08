import { useRef, useCallback, useEffect } from 'react';
import { Jungle, Formant, makeImpulseResponse, detectPitch, f2m, m2f, nearestScale, musicalStrength, centsOff, nName } from '../audioUtils.js';
import { ESCALAS } from '../constants.js';

const NG = { openTh: 0.006, closeTh: 0.0032, attack: 0.004, release: 0.18, state: 0, env: 0 };

export function useAudioEngine(prodRef, onPitchUpdate) {
  const actxRef = useRef(null);
  const nodesRef = useRef({});
  const micLevelRef = useRef(0);
  const destNodeRef = useRef(null);
  const micStreamRef = useRef(null);
  const pitchSmRef = useRef(0);
  const midiTargetRef = useRef(0);
  const midiTunedRef = useRef(60);
  const pitchClarityRef = useRef(0);
  const rafRef = useRef(null);

  const ensureContext = useCallback(async () => {
    const actx = actxRef.current;
    if (!actx) return;
    if (actx.state === 'suspended') {
      try { await actx.resume(); } catch (e) { console.warn('AudioContext resume failed', e); }
    }
  }, []);

  const initAudio = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const actx = new AudioContext({ latencyHint: 'playback' });
    if (actx.state === 'suspended') await actx.resume();
    actxRef.current = actx;

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    micStreamRef.current = micStream;
    const src = actx.createMediaStreamSource(micStream);

    const noiseGate = actx.createGain(); noiseGate.gain.value = 1;
    const aGate = actx.createAnalyser(); aGate.fftSize = 256;
    src.connect(aGate); src.connect(noiseGate);

    const aPitch = actx.createAnalyser(); aPitch.fftSize = 2048;
    noiseGate.connect(aPitch);

    const gDry = actx.createGain(); gDry.gain.value = 1; noiseGate.connect(gDry);
    const wetBus = actx.createGain(); wetBus.gain.value = 1;
    const gWet = actx.createGain(); gWet.gain.value = 0; wetBus.connect(gWet);

    const reverb = actx.createConvolver(); reverb.buffer = makeImpulseResponse(actx, 1.2, 2.0);
    const revG = actx.createGain(); revG.gain.value = 0.12; reverb.connect(revG); revG.connect(wetBus);

    const j1 = new Jungle(actx), fm1 = new Formant(actx), gV1 = actx.createGain(); gV1.gain.value = 0.6;
    noiseGate.connect(j1.i); j1.o.connect(fm1.i); fm1.o.connect(gV1); gV1.connect(wetBus); fm1.o.connect(reverb);

    const dly2 = actx.createDelay(0.5); dly2.delayTime.value = 0.06;
    const j2 = new Jungle(actx), fm2 = new Formant(actx), gV2 = actx.createGain(); gV2.gain.value = 0;
    noiseGate.connect(dly2); dly2.connect(j2.i); j2.o.connect(fm2.i); fm2.o.connect(gV2); gV2.connect(wetBus); fm2.o.connect(reverb);

    const dly3 = actx.createDelay(0.5); dly3.delayTime.value = 0.10;
    const j3 = new Jungle(actx), fm3 = new Formant(actx), gV3 = actx.createGain(); gV3.gain.value = 0;
    noiseGate.connect(dly3); dly3.connect(j3.i); j3.o.connect(fm3.i); fm3.o.connect(gV3); gV3.connect(wetBus); fm3.o.connect(reverb);

    const destNode = actx.createMediaStreamDestination();
    gDry.connect(actx.destination); gWet.connect(actx.destination);
    gDry.connect(destNode); gWet.connect(destNode);

    nodesRef.current = { noiseGate, aGate, aPitch, gDry, gWet, j1, j2, j3, fm1, fm2, fm3, gV1, gV2, gV3, dly2, dly3, reverb, revG, destNode };
    destNodeRef.current = destNode;

    applyFader(0);
    loop();
  }, []);

  const applyFader = useCallback((x) => {
    const { gDry, gWet } = nodesRef.current;
    if (!gDry) return;
    const t = actxRef.current.currentTime;
    gDry.gain.setTargetAtTime(Math.cos(x * Math.PI / 2), t, 0.03);
    gWet.gain.setTargetAtTime(Math.sin(x * Math.PI / 2), t, 0.03);
  }, []);

  const updateCorrections = useCallback(() => {
    const { aPitch, j1, j2, j3, fm1, fm2, fm3, gV2, gV3, dly2, dly3 } = nodesRef.current;
    const prod = prodRef.current;
    const { pitchHz, pitchClarity } = detectPitch(aPitch, actxRef.current?.sampleRate);
    pitchClarityRef.current = pitchClarity;
    if (!pitchHz || pitchClarity < 0.25) {
      midiTargetRef.current = 0;
      onPitchUpdate?.({ midiTarget: 0, midiTuned: midiTunedRef.current, pitchClarity: pitchClarityRef.current, cents: 0, name: '' });
      return;
    }
    const alphaP = Math.min(0.9, Math.max(0.25, 0.6 / (prod.v1.atResponse || 4)));
    pitchSmRef.current = pitchSmRef.current ? (pitchSmRef.current * (1 - alphaP) + pitchHz * alphaP) : pitchHz;
    const mRaw = f2m(pitchSmRef.current);
    const s1 = ESCALAS[prod.v1.escala] || ESCALAS.mayor;
    const as = prod.v1.atStrength;
    const target = nearestScale(mRaw, s1);
    midiTargetRef.current = target;
    const rawDev = mRaw - target;
    const vibTh = prod.v1.atVibrato || 0.45;
    let effDev = rawDev;
    if (Math.abs(rawDev) < vibTh) {
      const k = Math.abs(rawDev) / vibTh;
      effDev = rawDev * k * k * k;
    }
    const str = musicalStrength(effDev, as);
    let mV1 = mRaw - effDev * str;
    const snap = str * 0.15;
    mV1 = mV1 * (1 - snap) + target * snap;
    midiTunedRef.current = mV1;
    const fV1 = m2f(mV1);
    const c1 = (fV1 / Math.max(pitchSmRef.current, 0.01)) - 1;
    j1.setMult(c1); fm1.setShift(prod.v1.genero);

    const t = actxRef.current.currentTime;
    if (prod.v2.activo) {
      let m2;
      if (prod.v2.modo === 'follow') {
        m2 = mV1 + prod.v2.intervalo;
        const s2 = ESCALAS[prod.v2.escala] || ESCALAS.mayor;
        m2 = nearestScale(m2, s2);
      } else {
        const s2 = ESCALAS[prod.v2.escala] || ESCALAS.mayor;
        m2 = nearestScale(mRaw, s2);
      }
      const f2 = m2f(m2), c2 = (f2 / Math.max(pitchSmRef.current, 0.01)) - 1;
      j2.setMult(c2); fm2.setShift(prod.v2.genero);
      gV2.gain.setTargetAtTime(prod.v2.vol * 0.7, t, 0.05);
      dly2.delayTime.setTargetAtTime(prod.v2.delay, t, 0.05);
    } else {
      gV2.gain.setTargetAtTime(0, t, 0.05);
    }

    if (prod.v3.activo) {
      let m3;
      if (prod.v3.modo === 'follow') {
        m3 = mV1 + prod.v3.intervalo;
        const s3 = ESCALAS[prod.v3.escala] || ESCALAS.mayor;
        m3 = nearestScale(m3, s3);
      } else {
        const s3 = ESCALAS[prod.v3.escala] || ESCALAS.mayor;
        m3 = nearestScale(mRaw, s3);
      }
      const f3 = m2f(m3), c3 = (f3 / Math.max(pitchSmRef.current, 0.01)) - 1;
      j3.setMult(c3); fm3.setShift(prod.v3.genero);
      gV3.gain.setTargetAtTime(prod.v3.vol * 0.7, t, 0.05);
      dly3.delayTime.setTargetAtTime(prod.v3.delay, t, 0.05);
    } else {
      gV3.gain.setTargetAtTime(0, t, 0.05);
    }

    onPitchUpdate?.({
      midiTarget: midiTargetRef.current,
      midiTuned: midiTunedRef.current,
      pitchClarity: pitchClarityRef.current,
      cents: centsOff(midiTunedRef.current, midiTargetRef.current),
      name: nName(midiTargetRef.current),
    });
  }, [prodRef, onPitchUpdate]);

  const updateNoiseGate = useCallback(() => {
    const { aGate, noiseGate } = nodesRef.current;
    if (!aGate || !noiseGate || !actxRef.current) return;
    const b = new Float32Array(aGate.frequencyBinCount);
    aGate.getFloatTimeDomainData(b);
    let s = 0;
    for (let i = 0; i < b.length; i++) s += b[i] * b[i];
    const rms = Math.sqrt(s / b.length);
    const a = rms > NG.env ? NG.attack : NG.release;
    NG.env = NG.env * (1 - a) + rms * a;
    micLevelRef.current = NG.env;
    const now = actxRef.current.currentTime;
    if (NG.state === 0) { if (NG.env > NG.openTh) { NG.state = 1; } }
    else { if (NG.env < NG.closeTh) { NG.state = 0; } }
    const cur = noiseGate.gain.value;
    const time = NG.state > cur ? NG.attack : NG.release;
    noiseGate.gain.setTargetAtTime(NG.state, now, time);
  }, []);

  const loop = useCallback(() => {
    updateNoiseGate();
    updateCorrections();
    rafRef.current = requestAnimationFrame(loop);
  }, [updateNoiseGate, updateCorrections]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      actxRef.current?.close();
    };
  }, []);

  const playBeep = useCallback(async (freq = 880, duration = 0.06, vol = 0.12) => {
    await ensureContext();
    const actx = actxRef.current;
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    g.gain.setValueAtTime(0, actx.currentTime);
    g.gain.linearRampToValueAtTime(vol, actx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + duration);
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + duration + 0.02);
  }, [ensureContext]);

  return { initAudio, applyFader, ensureContext, playBeep, getAudioContext: () => actxRef.current, getDestNode: () => destNodeRef.current, getMicLevel: () => micLevelRef.current };
}
