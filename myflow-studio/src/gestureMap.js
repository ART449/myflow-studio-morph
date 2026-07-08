// gestureMap.js — mapeo configurable de gestos a acciones de MyFlow STUDIO v2
// Cada entrada define condiciones y la acción resultante.
// cooldownMs: tiempo mínimo entre activaciones consecutivas del mismo gesto.
// once: si es true, la acción no se repite mientras el gesto se mantenga (disparo de flanco).

export const GESTURE_ACTIONS = [
  {
    id: 'rec',
    label: 'GRABAR / DETENER',
    desc: 'Puño cerrado + mover mano hacia abajo',
    condition: (g, _prev, ctx) => g.isFist && g.velocity.dy > 0.018 && ctx.lastFistDown,
    cooldownMs: 1200,
    once: true,
  },
  {
    id: 'stop',
    label: 'DETENER TODO',
    desc: 'Palma abierta',
    condition: (g) => g.isOpen && g.palmUp,
    cooldownMs: 1200,
    once: true,
  },
  {
    id: 'beat_toggle',
    label: 'BEAT IA',
    desc: 'Dedo anular extendido solo',
    condition: (g) => g.ringOnly,
    cooldownMs: 1000,
    once: true,
  },
  {
    id: 'beat_generate',
    label: 'GENERAR BEAT',
    desc: 'Pulgar + índice juntos (círculo)',
    condition: (g) => g.circle,
    cooldownMs: 2000,
    once: true,
  },
  {
    id: 'beat_play',
    label: 'PLAY/PAUSE BEAT',
    desc: 'Pulgar arriba',
    condition: (g) => g.thumbUp,
    cooldownMs: 1000,
    once: true,
  },
  {
    id: 'beat_style_next',
    label: 'SIGUIENTE ESTILO BEAT',
    desc: 'Dedos en V (índice + medio)',
    condition: (g) => g.peace,
    cooldownMs: 1000,
    once: true,
  },
  {
    id: 'cursor_select',
    label: 'SELECCIONAR / MOVER CURSOR',
    desc: 'Índice extendido solo',
    condition: (g) => g.indexOnly,
    cooldownMs: 0,
    once: false,
  },
  {
    id: 'secondary',
    label: 'ACCIÓN SECUNDARIA',
    desc: 'Medio extendido solo',
    condition: (g) => g.middleOnly,
    cooldownMs: 400,
    once: true,
  },
];

export function findAction(gesture, prevGesture, ctx, now = Date.now()) {
  for (const action of GESTURE_ACTIONS) {
    const last = ctx.lastFired[action.id] || 0;
    if (now - last < action.cooldownMs) continue;
    if (action.condition(gesture, prevGesture, ctx)) {
      if (action.once) {
        const wasActive = action.condition(prevGesture || gesture, null, ctx);
        if (wasActive) continue; // evita repetición mientras se mantiene
      }
      return action;
    }
  }
  return null;
}
