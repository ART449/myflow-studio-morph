import React, { memo } from 'react';

export const Tuner = memo(function Tuner({ name, cents, clarity, warmMode }) {
  const inTune = Math.abs(cents) <= 6;
  const color = inTune ? 'var(--green)' : (cents > 0 ? 'var(--ylw)' : 'var(--mag)');
  return (
    <div id="tunerCol">
      <div
        className="tuner"
        style={{ borderColor: color, color: color }}
      >
        {name || '—'}
      </div>
      <div id="tunerInfo">
        {warmMode && name ? `${clarity > .55 ? 'claro' : 'leve'} · ${Math.abs(cents)}¢` : ''}
      </div>
    </div>
  );
});
