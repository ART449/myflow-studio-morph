import React from 'react';
import './Splash.css';

export function Splash({ onStart, loading }) {
  return (
    <div id="splash">
      <h1>ByFlow <span>STUDIO</span> 🎛</h1>
      <p className="warn">⚠️ AUDÍFONOS OBLIGATORIOS</p>
      <p>Canta con efectos de coro, armonías en vivo y grabación vertical lista para compartir.</p>
      <ul>
        <li><strong>Calibración:</strong> toca pulgar e índice para "cerrado" y separa la mano para "abierto".</li>
        <li><strong>Gestos:</strong> ✊+⬇ grabar · ✋ detener · 👍 play/pause beat · ☝ abrir Beat IA · ✌ cambiar estilo · 👌 generar beat.</li>
        <li><strong>Coros:</strong> elige Dueto, Coro 3, Grego, Gospel o crea tu propio preset.</li>
        <li><strong>Modo calentamiento:</strong> practica con afinador y metrónomo sin grabar.</li>
        <li><strong>Graba:</strong> pulsa REC, canta, y descarga WAV o video al terminar.</li>
      </ul>
      <p style={{ fontSize: 12, color: 'var(--ylw)' }}>By IArtLabs — "El sistema parpadea, pero el código no miente".</p>
      <button id="btnStart" onClick={onStart} disabled={loading}>
        {loading ? 'Cargando…' : 'INICIAR'}
      </button>
    </div>
  );
}
