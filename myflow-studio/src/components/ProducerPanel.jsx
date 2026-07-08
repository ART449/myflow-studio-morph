import React, { memo } from 'react';
import { ESCALAS, INTERVALOS } from '../constants.js';

const Chips = memo(function Chips({ dict, selected, onSelect, render }) {
  return (
    <div className="chips">
      {Object.entries(dict).map(([k, v]) => {
        const isOn = v === selected || k === selected;
        return (
          <span
            key={k}
            className={`chip ${isOn ? 'on' : ''}`}
            onClick={() => onSelect(k)}
          >
            {render ? render(k, v) : k}
          </span>
        );
      })}
    </div>
  );
});

function Slider({ id, label, min, max, step, value, onChange, display }) {
  return (
    <div className="vr">
      <label>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="val">{display}</span>
    </div>
  );
}

export const ProducerPanel = memo(function ProducerPanel({ prod, setProd, open, onToggle }) {
  const update = (path, value) => {
    setProd((p) => {
      const next = { ...p };
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] = { ...cur[keys[i]] };
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  return (
    <>
      <button id="btnProd" onClick={onToggle}>{open ? '✕' : '🎛'}</button>
      <div id="panelProd" className={open ? '' : 'closed'}>
        <div className="vr" style={{ justifyContent: 'center', gap: 8 }}>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`vcBtn ${prod.nVoces === n ? 'on' : ''}`}
              onClick={() => update('nVoces', n)}
            >
              {n} voz{ n > 1 ? 'es' : ''}
            </button>
          ))}
        </div>

        <hr className="sep" />
        <div className="vhead"><span className="dot v1" />VOZ 1 · Tú</div>
        <div className="vr">
          <label>Escala</label>
          <Chips dict={ESCALAS} selected={prod.v1.escala} onSelect={(k) => update('v1.escala', k)} />
        </div>
        <Slider id="gV1" label="Género" min={-10} max={10} step={1} value={prod.v1.genero * 10}
          onChange={(v) => update('v1.genero', v / 10)} display={Math.round(prod.v1.genero * 100) + '%'} />
        <Slider id="atStr" label="Tune" min={0} max={10} step={1} value={prod.v1.atStrength * 10}
          onChange={(v) => update('v1.atStrength', v / 10)} display={Math.round(prod.v1.atStrength * 100) + '%'} />
        <Slider id="atResponse" label="Respuesta" min={1} max={10} step={1} value={prod.v1.atResponse}
          onChange={(v) => update('v1.atResponse', v)} display={prod.v1.atResponse} />
        <Slider id="atVibrato" label="Vibrato" min={0} max={10} step={1} value={prod.v1.atVibrato * 10}
          onChange={(v) => update('v1.atVibrato', v / 10)} display={Math.round(prod.v1.atVibrato * 100) + '¢'} />

        <hr className="sep" />
        <div className="vhead"><span className="dot v2" />VOZ 2 · Armonía</div>
        <div className="vr">
          <label>Modo</label>
          <Chips dict={{ followV1: true, propia: false }} selected={prod.v2.modo}
            onSelect={(k) => update('v2.modo', k)} render={(k) => k === 'followV1' ? 'Sigue' : 'Libre'} />
        </div>
        <div className="vr">
          <label>Escala</label>
          <Chips dict={ESCALAS} selected={prod.v2.escala} onSelect={(k) => update('v2.escala', k)} />
        </div>
        <div className="vr">
          <label>Intrv</label>
          <Chips dict={INTERVALOS} selected={prod.v2.intervalo}
            onSelect={(k) => update('v2.intervalo', INTERVALOS[k])} />
        </div>
        <Slider id="gV2" label="Género" min={-10} max={10} step={1} value={prod.v2.genero * 10}
          onChange={(v) => update('v2.genero', v / 10)} display={Math.round(prod.v2.genero * 100) + '%'} />
        <Slider id="dly2" label="Delay" min={0} max={100} step={1} value={prod.v2.delay * 200}
          onChange={(v) => update('v2.delay', v / 200)} display={Math.round(prod.v2.delay * 1000) + 'ms'} />
        <Slider id="vol2" label="Vol" min={0} max={10} step={1} value={prod.v2.vol * 10}
          onChange={(v) => update('v2.vol', v / 10)} display={Math.round(prod.v2.vol * 100) + '%'} />

        {prod.nVoces >= 3 && (
          <div id="v3sec">
            <hr className="sep" />
            <div className="vhead"><span className="dot v3" />VOZ 3 · Armonía</div>
            <div className="vr">
              <label>Modo</label>
              <Chips dict={{ followV1: true, propia: false }} selected={prod.v3.modo}
                onSelect={(k) => update('v3.modo', k)} render={(k) => k === 'followV1' ? 'Sigue' : 'Libre'} />
            </div>
            <div className="vr">
              <label>Escala</label>
              <Chips dict={ESCALAS} selected={prod.v3.escala} onSelect={(k) => update('v3.escala', k)} />
            </div>
            <div className="vr">
              <label>Intrv</label>
              <Chips dict={INTERVALOS} selected={prod.v3.intervalo}
                onSelect={(k) => update('v3.intervalo', INTERVALOS[k])} />
            </div>
            <Slider id="gV3" label="Género" min={-10} max={10} step={1} value={prod.v3.genero * 10}
              onChange={(v) => update('v3.genero', v / 10)} display={Math.round(prod.v3.genero * 100) + '%'} />
            <Slider id="dly3" label="Delay" min={0} max={100} step={1} value={prod.v3.delay * 200}
              onChange={(v) => update('v3.delay', v / 200)} display={Math.round(prod.v3.delay * 1000) + 'ms'} />
            <Slider id="vol3" label="Vol" min={0} max={10} step={1} value={prod.v3.vol * 10}
              onChange={(v) => update('v3.vol', v / 10)} display={Math.round(prod.v3.vol * 100) + '%'} />
          </div>
        )}
      </div>
    </>
  );
});
