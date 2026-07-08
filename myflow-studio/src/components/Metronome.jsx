import React, { memo } from 'react';

export const Metronome = memo(function Metronome({ bpm, sig, vol, beat, onBpmChange, onSigChange, onTap, onVolChange }) {
  const beatsPerBar = sig === '3/4' ? 3 : sig === '6/8' ? 6 : 4;
  const beats = Array.from({ length: beatsPerBar }, (_, i) => i);
  return (
    <div id="metroBox">
      <div id="metroPulse" className={beat >= 0 ? 'on' : ''}></div>
      <div className="metroRow">
        <div id="metronome">
          {beats.map((i) => (
            <div
              key={i}
              className={`beat ${i === 0 ? 'accent' : ''} ${beat === i ? 'on' : ''}`}
              data-b={i}
            />
          ))}
        </div>
        <span id="bpmVal">{bpm} BPM</span>
      </div>
      <input
        id="metroBpm"
        type="range"
        min={40}
        max={200}
        value={bpm}
        step={1}
        onChange={(e) => onBpmChange(parseInt(e.target.value))}
      />
      <div className="vr" style={{ margin: '2px 0' }}>
        <label>Vol click</label>
        <input
          type="range"
          min={0}
          max={10}
          value={Math.round(vol * 10)}
          step={1}
          onChange={(e) => onVolChange(parseInt(e.target.value) / 10)}
        />
        <span className="val">{Math.round(vol * 100)}%</span>
      </div>
      <div className="metroRow">
        <button id="btnTap" onClick={onTap}>TAP</button>
        <div className="metroSigs">
          {['4/4', '3/4', '6/8'].map((s) => (
            <span
              key={s}
              className={`chip ${sig === s ? 'on' : ''}`}
              onClick={() => onSigChange(s)}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
