export const COLORS = {
  ylw: '#FFB81C',
  amber: '#C97E10',
  bg: '#060608',
  panel: '#0f0f13',
  cream: '#F3EBDD',
  gray: '#6E6657',
  red: '#FF3B5C',
  green: '#2ecc71',
  mag: '#E040FB',
  cyan: '#00BCD4',
};

export const ESCALAS = {
  mayor: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 10],
  pentaMayor: [0, 2, 4, 7, 9],
  pentaMenor: [0, 3, 5, 7, 10],
  dorica: [0, 2, 3, 5, 7, 9, 10],
  mixolidia: [0, 2, 4, 5, 7, 9, 10],
  cromatica: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const INTERVALOS = {
  '-8va': -12, '-5J': -7, '-3M': -4, '-3m': -3,
  '+3m': 3, '+3M': 4, '+5J': 7, '+8va': 12,
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const FACTORY_PROD = {
  nVoces: 2,
  v1: { escala: 'mayor', genero: 0, atStrength: 0.7, atResponse: 4, atVibrato: 0.45 },
  v2: { activo: true, modo: 'follow', escala: 'menor', intervalo: 7, genero: 0.8, delay: 0.06, vol: 0.7 },
  v3: { activo: false, modo: 'follow', escala: 'pentaMenor', intervalo: -7, genero: -0.8, delay: 0.10, vol: 0.6 },
};

export const PRESETS_CORO = {
  duo: {
    nVoces: 2,
    v2: { modo: 'follow', escala: 'mayor', intervalo: 7, genero: 0.7, delay: 0.05, vol: 0.75 },
  },
  coro: {
    nVoces: 3,
    v2: { modo: 'follow', escala: 'mayor', intervalo: 4, genero: 0.6, delay: 0.04, vol: 0.65 },
    v3: { modo: 'follow', escala: 'mayor', intervalo: 7, genero: -0.6, delay: 0.09, vol: 0.55 },
  },
  greg: {
    nVoces: 3,
    v2: { modo: 'follow', escala: 'dorica', intervalo: 7, genero: 0.5, delay: 0.08, vol: 0.6 },
    v3: { modo: 'follow', escala: 'dorica', intervalo: 12, genero: -0.5, delay: 0.14, vol: 0.5 },
  },
  gospel: {
    nVoces: 3,
    v2: { modo: 'follow', escala: 'pentaMayor', intervalo: 4, genero: 0.8, delay: 0.03, vol: 0.7 },
    v3: { modo: 'follow', escala: 'pentaMayor', intervalo: 7, genero: -0.7, delay: 0.06, vol: 0.6 },
  },
};

export const LS_PRESETS = 'byflow_user_presets';
