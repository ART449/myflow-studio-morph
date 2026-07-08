import React, { useEffect, useState } from 'react';

export function DAWModal({ open, canvasRef, onClose, onProcess, onExport, setTrim, setEQ }) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(100);
  const [low, setLow] = useState(0);
  const [mid, setMid] = useState(0);
  const [high, setHigh] = useState(0);

  useEffect(() => {
    if (open) {
      setStart(0); setEnd(100); setLow(0); setMid(0); setHigh(0);
    }
  }, [open]);

  useEffect(() => { setTrim(start, end); }, [start, end, setTrim]);
  useEffect(() => { setEQ(low, mid, high); }, [low, mid, high, setEQ]);

  if (!open) return null;
  return (
    <div className="modal open" id="modalDAW">
      <h2>🎛 Editor post-grabación</h2>
      <canvas id="waveCanvas" ref={canvasRef} />
      <div className="trimRow">
        <span>Inicio</span>
        <input type="range" min={0} max={100} value={start} step={1} onChange={(e) => setStart(parseInt(e.target.value))} />
        <span>Fin</span>
        <input type="range" min={0} max={100} value={end} step={1} onChange={(e) => setEnd(parseInt(e.target.value))} />
      </div>
      <div className="vr" style={{ width: 'min(380px,92%)' }}>
        <label>EQ Low</label>
        <input type="range" min={-10} max={10} value={low} step={1} onChange={(e) => setLow(parseInt(e.target.value))} />
        <span className="val">{low}dB</span>
      </div>
      <div className="vr" style={{ width: 'min(380px,92%)' }}>
        <label>EQ Mid</label>
        <input type="range" min={-10} max={10} value={mid} step={1} onChange={(e) => setMid(parseInt(e.target.value))} />
        <span className="val">{mid}dB</span>
      </div>
      <div className="vr" style={{ width: 'min(380px,92%)' }}>
        <label>EQ High</label>
        <input type="range" min={-10} max={10} value={high} step={1} onChange={(e) => setHigh(parseInt(e.target.value))} />
        <span className="val">{high}dB</span>
      </div>
      <div className="modalRow">
        <button onClick={onProcess} style={{ flex: 1 }}>↺ Procesar</button>
        <button onClick={onExport} style={{ flex: 1 }}>⬇ Exportar WAV</button>
      </div>
      <div className="modalRow">
        <button onClick={onClose} style={{ flex: 1 }}>↺ Cerrar</button>
      </div>
    </div>
  );
}
