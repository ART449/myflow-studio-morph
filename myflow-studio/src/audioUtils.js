// Pitch helpers
export const f2m = (f) => (f > 0 ? 69 + 12 * Math.log2(f / 440) : 60);
export const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const nName = (m) => {
  const o = Math.floor(m / 12) - 1;
  const idx = ((m % 12) + 12) % 12;
  return NOTE_NAMES[idx] + o;
};

import { NOTE_NAMES, ESCALAS } from './constants.js';

export const centsOff = (m, t) => Math.round((m - t) * 100);

export const nearestScale = (m, scaleName) => {
  const sc = ESCALAS[scaleName] || ESCALAS.mayor;
  let best = m, d_ = 99;
  const oct = Math.floor(m / 12);
  for (let i = oct - 2; i <= oct + 2; i++) {
    for (const s of sc) {
      const c = i * 12 + s;
      const dd = Math.abs(c - m);
      if (dd < d_) { d_ = dd; best = c; }
    }
  }
  return best;
};

export const musicalStrength = (rawDev, as) => {
  const s = Math.min(1, Math.max(0, as));
  const d = Math.abs(rawDev);
  if (d < 0.2) return 0;
  if (d < 0.8) return s * (d - 0.2) / 0.6;
  return s * (1 - Math.exp(-(d - 0.8) * 2.5)) * 0.7 + s * 0.3;
};

// Hybrid pitch detector: autocorrelation + YIN
const PITCH_BUF_SIZE = 7;
const pitchBuf = [];
let pitchHz = 0;
let pitchClarity = 0;

function parabolicInterp(ns, i) {
  const a = ns[i - 1], b = ns[i], c = ns[i + 1];
  const d = (a - c) * 0.5 / (a - 2 * b + c);
  return d || 0;
}

function cumMeanNormDiff(buf, tau) {
  let sum = 0;
  for (let i = 0; i + tau < buf.length; i++) {
    const d = buf[i] - buf[i + tau];
    sum += d * d;
  }
  const n = buf.length - tau;
  if (n <= 0) return 1;
  const df = sum / n;
  let mns = 0;
  for (let k = 1; k <= tau; k++) {
    let s = 0;
    for (let i = 0; i + k < buf.length; i++) {
      const d = buf[i] - buf[i + k];
      s += d * d;
    }
    mns += s / (buf.length - k);
  }
  return df / (mns / tau + 1e-10);
}

export function detectPitch(aPitch, sampleRate) {
  if (!aPitch || !sampleRate) return { pitchHz: 0, pitchClarity: 0 };
  const n = aPitch.fftSize;
  const pdBuf = new Float32Array(n);
  aPitch.getFloatTimeDomainData(pdBuf);

  let rms = 0;
  for (let i = 0; i < n; i++) rms += pdBuf[i] * pdBuf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.0005) { pitchHz = 0; pitchClarity = 0; return { pitchHz: 0, pitchClarity: 0 }; }

  const lo = Math.floor(sampleRate / 1200);
  const hi = Math.floor(sampleRate / 60);
  const ns = new Float32Array(hi + 2);
  for (let tau = lo; tau <= hi; tau++) {
    let num = 0, den1 = 0, den2 = 0;
    for (let i = 0; i + tau < n; i++) {
      num += pdBuf[i] * pdBuf[i + tau];
      den1 += pdBuf[i] * pdBuf[i];
      den2 += pdBuf[i + tau] * pdBuf[i + tau];
    }
    ns[tau] = -num / Math.sqrt(den1 * den2 + 1e-12);
  }

  let peakTau = 0, peakVal = -Infinity;
  for (let tau = lo + 1; tau < hi; tau++) {
    if (ns[tau] > peakVal && ns[tau] > ns[tau - 1] && ns[tau] > ns[tau + 1]) {
      peakVal = ns[tau]; peakTau = tau;
    }
  }

  let bestTau = 0, bestD = Infinity;
  if (peakTau > 0) {
    for (let dt = -2; dt <= 2; dt++) {
      const t = peakTau + dt;
      if (t < lo || t > hi) continue;
      const cmf = cumMeanNormDiff(pdBuf, t);
      if (cmf < bestD) { bestD = cmf; bestTau = t; }
    }
  } else {
    for (let tau = lo; tau <= hi; tau++) {
      const cmf = cumMeanNormDiff(pdBuf, tau);
      if (cmf < bestD) { bestD = cmf; bestTau = tau; }
    }
  }

  const clarity = Math.max(0, 1 - bestD);
  if (bestD > 0.5 || bestTau === 0) { pitchHz = 0; pitchClarity = 0; return { pitchHz: 0, pitchClarity: 0 }; }
  const interp = parabolicInterp(ns, bestTau);
  const f = sampleRate / (bestTau + interp);
  if (f < 60 || f > 1200) { pitchHz = 0; pitchClarity = 0; return { pitchHz: 0, pitchClarity: 0 }; }

  pitchBuf.push(f);
  pitchClarity = clarity;
  if (pitchBuf.length > PITCH_BUF_SIZE) pitchBuf.shift();
  const sorted = [...pitchBuf].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  pitchHz = pitchHz ? (pitchHz * 0.55 + med * 0.45) : med;
  return { pitchHz, pitchClarity };
}

// Jungle pitch shifter
function buildDownRamp(c, a, f, up) {
  const n = Math.round((a + f) * c.sampleRate);
  const b = c.createBuffer(1, n, c.sampleRate);
  const p = b.getChannelData(0);
  const l = Math.min(n, Math.round(a * c.sampleRate));
  for (let i = 0; i < n; i++) p[i] = i < l ? (up ? (l - i) / l : i / l) : 0;
  return b;
}
function buildFlat(c, a, f) {
  const n = Math.round((a + f) * c.sampleRate);
  const b = c.createBuffer(1, n, c.sampleRate);
  const p = b.getChannelData(0);
  const l = Math.min(n, Math.round(f * c.sampleRate));
  const r = Math.min(n, Math.round(a * c.sampleRate));
  for (let i = 0; i < n; i++) {
    if (i < l) p[i] = Math.sqrt(i / l);
    else if (i >= r - l && i < r) p[i] = Math.sqrt(1 - (i - r + l) / l);
    else if (i < r) p[i] = 1;
    else p[i] = 0;
  }
  return b;
}

export class Jungle {
  constructor(c) {
    const dT = 0.08, fT = 0.04, bT = 0.08;
    this.c = c;
    this.dT = dT;
    this.i = c.createGain();
    this.o = c.createGain();
    const u = buildDownRamp(c, bT, fT, true);
    const f = buildFlat(c, bT, fT);
    const s = (b) => { const o = c.createBufferSource(); o.buffer = b; o.loop = true; return o; };
    const m1 = s(u), m2 = s(u), x1 = s(f), x2 = s(f);
    this.g1 = c.createGain(); this.g2 = c.createGain();
    m1.connect(this.g1); m2.connect(this.g2);
    const d1 = c.createDelay(1), d2 = c.createDelay(1);
    this.g1.connect(d1.delayTime); this.g2.connect(d2.delayTime);
    const g1 = c.createGain(), g2 = c.createGain();
    g1.gain.value = 0; g2.gain.value = 0;
    x1.connect(g1.gain); x2.connect(g2.gain);
    this.i.connect(d1); this.i.connect(d2);
    d1.connect(g1); d2.connect(g2);
    g1.connect(this.o); g2.connect(this.o);
    const t = c.currentTime + 0.03;
    m1.start(t); x1.start(t); m2.start(t + bT - fT); x2.start(t + bT - fT);
    this.setMult(0);
  }
  setMult(m) {
    const v = this.dT * m;
    const t = this.c.currentTime;
    this.g1.gain.setTargetAtTime(v, t, 0.015);
    this.g2.gain.setTargetAtTime(v, t, 0.015);
  }
}

export class Formant {
  constructor(c) {
    this.c = c;
    this.i = c.createGain();
    this.o = c.createGain();
    this.f1 = c.createBiquadFilter(); this.f1.type = 'peaking'; this.f1.Q.value = 6; this.f1.gain.value = 6;
    this.f2 = c.createBiquadFilter(); this.f2.type = 'peaking'; this.f2.Q.value = 8; this.f2.gain.value = 5;
    this.f3 = c.createBiquadFilter(); this.f3.type = 'peaking'; this.f3.Q.value = 9; this.f3.gain.value = 4;
    this.i.connect(this.f1); this.f1.connect(this.f2); this.f2.connect(this.f3); this.f3.connect(this.o);
    this.setShift(0);
  }
  setShift(s) {
    const k = Math.pow(2, s * 0.6);
    const t = this.c.currentTime;
    this.f1.frequency.setTargetAtTime(700 * k, t, 0.05);
    this.f2.frequency.setTargetAtTime(1220 * k, t, 0.05);
    this.f3.frequency.setTargetAtTime(2600 * k, t, 0.05);
  }
}

export function makeImpulseResponse(c, d, y) {
  const r = c.sampleRate, l = Math.round(d * r);
  const b = c.createBuffer(2, l, r);
  for (let i = 0; i < 2; i++) {
    const C = b.getChannelData(i);
    for (let j = 0; j < l; j++) C[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / l, y);
  }
  return b;
}

export function encodeWAV(audioBuffer) {
  const ch = audioBuffer.numberOfChannels;
  const sr = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const buf = new ArrayBuffer(44 + len * ch * 2);
  const v = new DataView(buf);
  const w = (s, o, l) => { for (let i = 0; i < l; i++) v.setUint8(s + i, o.charCodeAt(i)); };
  w(0, 'RIFF', 4); v.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE', 4);
  w(12, 'fmt ', 4); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, 'data', 4); v.setUint32(40, len * ch * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, audioBuffer.getChannelData(c)[i]));
      v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true);
      off += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}
