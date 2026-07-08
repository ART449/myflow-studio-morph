// gestureUtils.js — helpers de detección gestual para MediaPipe Hands
// Indices de landmarks de mano (21 puntos):
// 0: muñeca, 1-4: pulgar, 5-8: índice, 9-12: medio, 13-16: anular, 17-20: meñique

export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const FINGER_COLORS = {
  thumb: '#E040FB',   // magenta
  index: '#00BCD4',   // cyan
  middle: '#FFB81C',  // amarillo
  ring: '#2ecc71',    // verde
  pinky: '#FF3B5C',   // rojo
};

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIP = [2, 6, 10, 14, 18]; // nudillo proximal como referencia

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Detecta qué dedos están extendidos.
 * - Pulgar: comparar distancia punta->índice-PIP vs MCP->IPP aproximado. Simplificado:
 *   extendido si dist(tip, muñeca) > dist(IP, muñeca).
 * - Otros: extendido si tip está más arriba (menor y) que PIP, considerando orientación
 *   de la muñeca. Usamos distancia a muñeca como proxy robusto.
 */
export function detectFingers(lm) {
  const wrist = lm[0];
  const ref = dist(lm[0], lm[9]); // palma como escala
  const extended = FINGER_NAMES.map((_, i) => {
    const tip = lm[FINGER_TIPS[i]];
    const pip = lm[FINGER_PIP[i]];
    // Para pulgar usamos regla especial: distancia tip-muñeca vs pip-muñeca
    if (i === 0) {
      return dist(tip, wrist) > dist(pip, wrist) + ref * 0.05;
    }
    return dist(tip, wrist) > dist(pip, wrist) + ref * 0.02;
  });
  return {
    thumb: extended[0],
    index: extended[1],
    middle: extended[2],
    ring: extended[3],
    pinky: extended[4],
    extended,
  };
}

/** Detecta si la palma está orientada hacia arriba (dedos por encima de muñeca) aproximadamente. */
export function isPalmUp(lm) {
  const yTips = (lm[8].y + lm[12].y + lm[16].y + lm[20].y) / 4;
  return yTips < lm[0].y;
}

/** Detecta movimiento vertical de la mano entre frames. */
export function handVelocity(lm, prevLm) {
  if (!prevLm) return { dx: 0, dy: 0, mag: 0 };
  const c = lm[9];
  const p = prevLm[9];
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  return { dx, dy, mag: Math.hypot(dx, dy) };
}

/** Devuelve un objeto de gesto simplificado. */
export function detectGesture(lm, prevLm) {
  const fingers = detectFingers(lm);
  const velocity = handVelocity(lm, prevLm);
  const nExt = fingers.extended.filter(Boolean).length;
  const palmUp = isPalmUp(lm);

  // Heurísticas de gestos
  const isFist = nExt === 0;
  const isOpen = nExt >= 4;
  const thumbUp = fingers.thumb && !fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky && palmUp;
  const indexOnly = fingers.index && nExt === 1;
  const middleOnly = fingers.middle && nExt === 1;
  const ringOnly = fingers.ring && nExt === 1;
  const pinkyOnly = fingers.pinky && nExt === 1;
  const peace = fingers.index && fingers.middle && nExt === 2;
  const circle = fingers.thumb && fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky && nExt === 2;

  return {
    fingers,
    nExt,
    palmUp,
    velocity,
    isFist,
    isOpen,
    thumbUp,
    indexOnly,
    middleOnly,
    ringOnly,
    pinkyOnly,
    peace,
    circle,
  };
}
