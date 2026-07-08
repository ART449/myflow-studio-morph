import React, { memo } from 'react';

export const UserPresets = memo(function UserPresets({ presets, selected, onSelect, onSave, onDelete, onReset }) {
  return (
    <div id="userPresetBar">
      <select id="presetSelect" value={selected} onChange={(e) => onSelect(e.target.value)}>
        <option value="">Mis presets…</option>
        {Object.keys(presets).sort().map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <button className="upBtn" onClick={onSave}>💾</button>
      <button className="upBtn" onClick={onDelete}>🗑</button>
      <button className="upBtn" onClick={onReset}>↺</button>
    </div>
  );
});
