import React, { useEffect, useRef } from 'react';
import { FINGER_COLORS, FINGER_NAMES } from '../gestureUtils.js';

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // pulgar
  [0, 5], [5, 6], [6, 7], [7, 8],       // índice
  [0, 9], [9, 10], [10, 11], [11, 12],  // medio
  [0, 13], [13, 14], [14, 15], [15, 16], // anular
  [0, 17], [17, 18], [18, 19], [19, 20], // meñique
];

function clamp(n, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

export const OverlayCanvas = React.forwardRef(function OverlayCanvas({ landmarks, fader, gesture, actionLabel }, ref) {
  const canvasRef = useRef(null);
  const lastActionRef = useRef(null);

  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') ref(canvasRef.current);
      else ref.current = canvasRef.current;
    }
  }, [ref]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !landmarks) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = canvas.offsetHeight * 2;
    ctx.clearRect(0, 0, W, H);
    const lm = landmarks;

    // Dibujar esqueleto de mano completo
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3 + fader * 4;
    ctx.shadowColor = '#FFB81C';
    ctx.shadowBlur = 8 + fader * 16;
    ctx.strokeStyle = '#FFB81C';
    ctx.beginPath();
    for (const [a, b] of BONES) {
      ctx.moveTo(clamp(lm[a].x) * W, clamp(lm[a].y) * H);
      ctx.lineTo(clamp(lm[b].x) * W, clamp(lm[b].y) * H);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Puntos de landmarks
    for (let i = 0; i < lm.length; i++) {
      const x = clamp(lm[i].x) * W;
      const y = clamp(lm[i].y) * H;
      ctx.fillStyle = i === 0 ? '#F3EBDD' : '#333';
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? 12 : 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dedo índice y pulgar resaltados para fader
    for (const i of [4, 8]) {
      ctx.fillStyle = '#F3EBDD';
      ctx.beginPath();
      ctx.arc(clamp(lm[i].x) * W, clamp(lm[i].y) * H, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Indicadores de dedos activos
    if (gesture?.fingers) {
      const active = FINGER_NAMES.filter((n, i) => gesture.fingers.extended[i]);
      const pad = 14 * 2;
      const boxH = 24 * 2;
      const startX = W - pad;
      let y = H - pad - boxH;
      for (const name of active.slice().reverse()) {
        const color = FINGER_COLORS[name];
        const label = name === 'thumb' ? 'PULGAR' : name === 'index' ? 'ÍNDICE' : name === 'middle' ? 'MEDIO' : name === 'ring' ? 'ANULAR' : 'MEÑIQUE';
        ctx.font = 'bold 18px system-ui, sans-serif';
        const w = ctx.measureText(label).width + 16 * 2;
        ctx.fillStyle = color + 'CC';
        ctx.beginPath();
        ctx.roundRect(startX - w, y, w, boxH, 8);
        ctx.fill();
        ctx.fillStyle = '#060608';
        ctx.fillText(label, startX - w + 16, y + 20);
        y -= boxH + 8;
      }
    }

    // Acción ejecutada recientemente
    if (actionLabel) {
      lastActionRef.current = { text: actionLabel, until: performance.now() + 900 };
    }
    if (lastActionRef.current && performance.now() < lastActionRef.current.until) {
      const text = lastActionRef.current.text;
      ctx.font = 'bold 34px system-ui, sans-serif';
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(255,184,28,.18)';
      ctx.fillRect(W / 2 - tw / 2 - 12, H / 2 - 26, tw + 24, 52);
      ctx.fillStyle = '#FFB81C';
      ctx.fillText(text, W / 2 - tw / 2, H / 2 + 10);
    }
  }, [landmarks, fader, gesture, actionLabel]);

  return <canvas id="overlay" ref={canvasRef} />;
});
