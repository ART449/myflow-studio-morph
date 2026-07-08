import React, { memo } from 'react';

const STYLES = ['trap', 'reggaeton', 'hiphop', 'house', 'drill', 'lofi', 'pop', 'rnb', 'rock', 'electronic'];

export const BeatIA = memo(function BeatIA({
  prompt, setPrompt,
  bpm, setBpm,
  duration, setDuration,
  style, setStyle,
  volume, setVolume,
  loading, error, status, progress,
  onGenerate, onPlay, onStop, isPlaying
}) {
  return (
    <div id="beatIABox">
      <h3>🥁 Beat IA</h3>
      <textarea
        placeholder="Describe tu beat: trap oscuro 90 BPM, bajos profundos, hi-hats rápidos..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
      />
      <div className="beatRow">
        <div className="beatField">
          <label>BPM</label>
          <input type="number" min={40} max={200} value={bpm} onChange={(e) => setBpm(parseInt(e.target.value))} />
        </div>
        <div className="beatField">
          <label>Duración (s)</label>
          <input type="number" min={4} max={30} value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} />
        </div>
      </div>
      <div className="beatStyles">
        {STYLES.map((s) => (
          <span
            key={s}
            className={`chip ${style === s ? 'on' : ''}`}
            onClick={() => setStyle(s)}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="vr">
        <label>Vol beat</label>
        <input type="range" min={0} max={10} value={Math.round(volume * 10)} step={1} onChange={(e) => setVolume(parseInt(e.target.value) / 10)} />
        <span className="val">{Math.round(volume * 100)}%</span>
      </div>
      <div className="beatActions">
        <button onClick={onGenerate} disabled={loading || !prompt.trim()}>
          {loading ? 'Generando…' : '✨ Generar beat'}
        </button>
        <button onClick={isPlaying ? onStop : onPlay} disabled={!beatUrl}>
          {isPlaying ? '⏹ Detener' : '▶ Probar'}
        </button>
      </div>
      {loading && progress > 0 && (
        <div className="beatProgressWrap">
          <div className="beatProgressBar" style={{ width: `${progress}%` }} />
        </div>
      )}
      {status && <div className="beatStatus">{status}</div>}
      {error && <div className="beatError">{error}</div>}
    </div>
  );
});
