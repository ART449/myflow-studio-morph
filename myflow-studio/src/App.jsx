import React, { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';
import { FACTORY_PROD, PRESETS_CORO, LS_PRESETS } from './constants.js';
import { useAudioEngine } from './hooks/useAudioEngine.js';
import { useVision } from './hooks/useVision.js';
import { useMetronome } from './hooks/useMetronome.js';
import { useRecording } from './hooks/useRecording.js';
import { useDAW } from './hooks/useDAW.js';
import { useBeatAI } from './hooks/useBeatAI.js';
import { centsOff, nName } from './audioUtils.js';
import { findAction } from './gestureMap.js';

import { Splash } from './components/Splash.jsx';
import { OverlayCanvas } from './components/OverlayCanvas.jsx';
import { Tuner } from './components/Tuner.jsx';
import { Metronome } from './components/Metronome.jsx';
import { ProducerPanel } from './components/ProducerPanel.jsx';
import { UserPresets } from './components/UserPresets.jsx';
import { VideoModal } from './components/VideoModal.jsx';
import { DAWModal } from './components/DAWModal.jsx';
import { BeatIA } from './components/BeatIA.jsx';

function clone(obj) {
  return structuredClone ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}

function loadUserPresets() {
  try {
    const j = localStorage.getItem(LS_PRESETS);
    return j ? JSON.parse(j) : {};
  } catch (e) { return {}; }
}

function saveUserPresets(obj) {
  try { localStorage.setItem(LS_PRESETS, JSON.stringify(obj)); } catch (e) {}
}

function App() {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prod, setProd] = useState(clone(FACTORY_PROD));
  const prodRef = useRef(prod);
  useEffect(() => { prodRef.current = prod; }, [prod]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [warmMode, setWarmMode] = useState(false);
  const [userPresets, setUserPresets] = useState(loadUserPresets());
  const [selectedPreset, setSelectedPreset] = useState('');
  const [status, setStatus] = useState('');
  const [pitchInfo, setPitchInfo] = useState({ name: '', cents: 0, clarity: 0, midiTarget: 0, midiTuned: 60 });
  const [micLevel, setMicLevel] = useState(0);
  const [fader, setFader] = useState(0);
  const [cal, setCal] = useState({ min: 0.15, max: 1.10 });
  const [landmarks, setLandmarks] = useState(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [dawModalOpen, setDawModalOpen] = useState(false);
  const [metroBeat, setMetroBeat] = useState(-1);
  const [metroState, setMetroState] = useState({ bpm: 90, sig: '4/4', vol: 0.5 });
  const [videoBlob, setVideoBlob] = useState(null);
  const [beatPanelOpen, setBeatPanelOpen] = useState(false);

  // Cerrar BeatIA con Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setBeatPanelOpen(false);
        setVideoModalOpen(false);
        setDawModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [beatPrompt, setBeatPrompt] = useState('');
  const [beatBpm, setBeatBpm] = useState(90);
  const [beatDuration, setBeatDuration] = useState(8);
  const [beatStyle, setBeatStyle] = useState('trap');
  const [beatVolume, setBeatVolume] = useState(0.5);
  const [beatPlaying, setBeatPlaying] = useState(false);
  const [gesture, setGesture] = useState(null);
  const [gestureAction, setGestureAction] = useState('');

  const gestureCtxRef = useRef({ lastFired: {}, lastFistDown: false });
  const prevGestureRef = useRef(null);
  const beatStylesRef = useRef(['trap', 'reggaeton', 'hiphop', 'house', 'drill', 'lofi', 'pop', 'rnb', 'rock', 'electronic']);

  const videoStreamRef = useRef(null);

  const {
    initAudio, applyFader, ensureContext, playBeep, getAudioContext, getDestNode, getMicLevel
  } = useAudioEngine(prodRef, useCallback((info) => {
    setPitchInfo(info);
  }, []));
  const beatAI = useBeatAI();

  const handleGestureAction = useCallback(async (action) => {
    await ensureContext();
    setGestureAction(action.label);
    setStatus(action.desc);
    playBeep(action.id.startsWith('beat_') ? 660 : 880, 0.07, 0.12);

    switch (action.id) {
      case 'rec':
        handleRec();
        break;
      case 'stop':
        if (recording.isRecording) recording.stop();
        if (beatPlaying) { beatAI.stopBeat(); setBeatPlaying(false); }
        if (warmMode) setWarmMode(false);
        break;
      case 'beat_toggle':
        setBeatPanelOpen(o => !o);
        break;
      case 'beat_generate':
        if (!beatPrompt.trim()) {
          setStatus('Escribe un prompt para Beat IA primero');
          return;
        }
        setBeatPanelOpen(true);
        handleGenerateBeat();
        break;
      case 'beat_play':
        handlePlayBeat();
        break;
      case 'beat_style_next':
        setBeatStyle(prev => {
          const styles = beatStylesRef.current;
          const idx = styles.indexOf(prev);
          const next = styles[(idx + 1) % styles.length];
          setStatus('Estilo beat: ' + next);
          return next;
        });
        break;
      case 'cursor_select':
        // placeholder: en futuro puede mover cursor o seleccionar UI
        break;
      case 'secondary':
        // placeholder: acción secundaria configurable
        break;
      default:
        break;
    }
  }, [ensureContext, playBeep, recording, beatPlaying, warmMode, beatPrompt, beatAI, handleGenerateBeat, handlePlayBeat, handleRec]);

  const onVisionFrame = useCallback(({ raw, landmarks: lm, gesture: g }) => {
    setLandmarks(lm);
    setGesture(g);
    if (raw !== null) {
      const denom = Math.max(cal.max - cal.min, 1e-6);
      const x = Math.min(1, Math.max(0, (raw - cal.min) / denom));
      const nextFader = fader + 0.25 * (x - fader);
      setFader(nextFader);
      applyFader(nextFader);
    }
    if (!g) return;

    // Actualizar contexto de gestos
    const ctx = gestureCtxRef.current;
    ctx.lastFistDown = g.isFist && g.velocity.dy > 0.005;
    const now = Date.now();
    const prev = prevGestureRef.current;
    const action = findAction(g, prev, ctx, now);
    prevGestureRef.current = g;
    if (action) {
      ctx.lastFired[action.id] = now;
      handleGestureAction(action);
    }
  }, [cal, fader, applyFader, handleGestureAction]);

  const { videoRef, initVision } = useVision(onVisionFrame);

  const metronome = useMetronome();

  const recording = useRecording();
  const { canvasRef, setAudioBuffer, setTrim, setEQ, process, exportWAV } = useDAW();

  // Update mic level display
  useEffect(() => {
    const id = setInterval(() => setMicLevel(getMicLevel()), 80);
    return () => clearInterval(id);
  }, [getMicLevel]);

  // Sync metronome UI state
  useEffect(() => {
    const id = setInterval(() => {
      const s = metronome.getState();
      setMetroState({ bpm: s.bpm, sig: s.sig, vol: s.vol });
    }, 200);
    return () => clearInterval(id);
  }, [metronome]);

  const handleStart = useCallback(async () => {
    setLoading(true);
    try {
      await initAudio();
      const actx = getAudioContext();
      if (actx && actx.state === 'suspended') await actx.resume();
      metronome.setAudioContext(actx);
      await initVision();
      if (videoRef.current) videoStreamRef.current = videoRef.current.srcObject;
      setStarted(true);
      setWarmMode(false);
      setStatus('Listo · cierra=natural · abre=producido · gestos activos');
      playBeep(440, 0.08, 0.1);
    } catch (e) {
      setLoading(false);
      setStatus('Error: ' + e.message);
      const msg = e.name === 'NotAllowedError'
        ? 'Permiso de cámara/micrófono denegado. Actívalos y recarga.'
        : 'Necesito cámara y micrófono.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  }, [initAudio, initVision, getAudioContext, metronome, videoRef, playBeep]);

  const handleCalClose = useCallback(() => {
    if (!landmarks) { setStatus('Muestra la mano primero'); return; }
    const dPI = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
    const dRef = Math.hypot(landmarks[0].x - landmarks[9].x, landmarks[0].y - landmarks[9].y);
    if (dRef > 1e-6) setCal(c => ({ ...c, min: dPI / dRef }));
    setStatus(`cal cerrado=${(dPI / dRef).toFixed(2)}`);
  }, [landmarks]);

  const handleCalOpen = useCallback(() => {
    if (!landmarks) { setStatus('Muestra la mano primero'); return; }
    const dPI = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
    const dRef = Math.hypot(landmarks[0].x - landmarks[9].x, landmarks[0].y - landmarks[9].y);
    if (dRef > 1e-6) setCal(c => ({ ...c, max: dPI / dRef }));
    setStatus(`cal abierto=${(dPI / dRef).toFixed(2)}`);
  }, [landmarks]);

  const toggleWarmMode = useCallback(() => {
    setWarmMode((prev) => {
      const next = !prev;
      if (next) {
        if (recording.isRecording) recording.toggle();
        metronome.start(({ beat }) => setMetroBeat(beat));
        setStatus('Modo calentamiento 🎧');
      } else {
        metronome.stop();
        setMetroBeat(-1);
        setStatus('Modo performance');
      }
      return next;
    });
  }, [metronome, recording]);

  const applyPreset = useCallback((key) => {
    const p = PRESETS_CORO[key];
    if (!p) return;
    const next = clone(prod);
    next.nVoces = p.nVoces;
    if (p.v2) Object.assign(next.v2, p.v2);
    if (p.v3) Object.assign(next.v3, p.v3);
    setProd(next);
    setStatus('Preset: ' + key);
  }, [prod]);

  const savePreset = useCallback(() => {
    const name = prompt('Nombre del preset:');
    if (!name) return;
    const nextPresets = { ...userPresets };
    const toSave = clone(prod);
    delete toSave.panelOpen;
    nextPresets[name.trim()] = toSave;
    setUserPresets(nextPresets);
    saveUserPresets(nextPresets);
    setSelectedPreset(name.trim());
    setStatus('Preset guardado: ' + name.trim());
  }, [userPresets, prod]);

  const deletePreset = useCallback(() => {
    if (!selectedPreset) { setStatus('Selecciona un preset para borrar'); return; }
    if (!confirm(`¿Borrar "${selectedPreset}"?`)) return;
    const next = { ...userPresets };
    delete next[selectedPreset];
    setUserPresets(next);
    saveUserPresets(next);
    setSelectedPreset('');
    setStatus('Preset borrado');
  }, [userPresets, selectedPreset]);

  const resetPresets = useCallback(() => {
    if (!confirm('¿Borrar TODOS tus presets y restaurar fábrica?')) return;
    localStorage.removeItem(LS_PRESETS);
    setUserPresets({});
    setSelectedPreset('');
    setProd(clone(FACTORY_PROD));
    setStatus('Restaurado a fábrica ✓');
  }, []);

  const loadUserPreset = useCallback((name) => {
    if (!name) return;
    const p = userPresets[name];
    if (!p) return;
    setProd(clone(p));
    setSelectedPreset(name);
    setStatus('Preset cargado: ' + name);
  }, [userPresets]);

  const handleRec = useCallback(() => {
    if (warmMode) { setStatus('Desactiva modo calentamiento para grabar'); return; }
    const currentlyRecording = recording.isRecording;
    if (currentlyRecording) {
      recording.stop();
      setTimeout(() => {
        const vBlob = recording.getVideoBlob();
        const buf = recording.getAudioBuffer();
        if (vBlob) setVideoBlob(vBlob);
        if (buf) setAudioBuffer(buf);
        setVideoModalOpen(true);
      }, 400);
    } else {
      recording.toggle(videoStreamRef.current, getDestNode());
    }
  }, [recording, warmMode, getDestNode, setAudioBuffer]);

  const handleEdit = useCallback(() => {
    setVideoModalOpen(false);
    const buf = recording.getAudioBuffer();
    if (buf) {
      setAudioBuffer(buf);
      setDawModalOpen(true);
    } else {
      setStatus('Sin audio para editar');
    }
  }, [recording, setAudioBuffer]);

  const handleGenerateBeat = useCallback(async () => {
    if (!beatPrompt.trim()) return;
    try {
      await beatAI.generateBeat(beatPrompt, { bpm: beatBpm, duration: beatDuration, style: beatStyle });
      setStatus('Beat generado ✓');
    } catch (e) {
      setStatus('Beat IA: ' + e.message);
    }
  }, [beatAI, beatPrompt, beatBpm, beatDuration, beatStyle]);

  const handlePlayBeat = useCallback(async () => {
    const actx = getAudioContext();
    if (!actx) return;
    await ensureContext();
    if (beatPlaying) {
      beatAI.stopBeat();
      setBeatPlaying(false);
    } else {
      await beatAI.playBeat(actx, actx.destination, beatVolume, () => setBeatPlaying(false));
      setBeatPlaying(true);
    }
  }, [beatAI, getAudioContext, beatPlaying, beatVolume, ensureContext]);

  const handleProcess = useCallback(async () => {
    await process();
    setStatus('Procesado ✓');
  }, [process]);

  const handleExport = useCallback(() => {
    exportWAV();
    setStatus('WAV exportado ✓');
  }, [exportWAV]);

  // Keep prod active flags in sync with nVoces
  useEffect(() => {
    setProd(p => {
      if (p.v2.activo === (p.nVoces >= 2) && p.v3.activo === (p.nVoces >= 3)) return p;
      return { ...p, v2: { ...p.v2, activo: p.nVoces >= 2 }, v3: { ...p.v3, activo: p.nVoces >= 3 } };
    });
  }, [prod.nVoces]);

  const tunerCents = pitchInfo.midiTarget > 0 ? centsOff(pitchInfo.midiTuned, pitchInfo.midiTarget) : 0;
  const tunerName = pitchInfo.midiTarget > 0 ? nName(pitchInfo.midiTarget) : '';
  const labelText = fader < .1 ? 'NATURAL' : (fader > .9 ? 'PRODUCIDO ✨' : 'MEZCLA');
  const labelColor = fader > .9 ? 'var(--mag)' : 'var(--cream)';

  const gestureHint = gesture?.nExt != null ? `${gesture.nExt} dedo${gesture.nExt !== 1 ? 's' : ''}` : '';

  return (
    <div id="stage">
      {!started && <Splash onStart={handleStart} loading={loading} />}
      <video id="cam" ref={videoRef} playsInline muted autoPlay />
      <OverlayCanvas landmarks={landmarks} px={0.5} py={0.5} fader={fader} micLevel={micLevel} gesture={gesture} actionLabel={gestureAction} />

      <div id="micDot" className={micLevel > 0.003 ? 'live' : ''} style={{ transform: `scale(${1 + micLevel * 80})`, background: micLevel > 0.003 ? 'var(--green)' : '#333' }}></div>
      <div id="levelWrap" className={micLevel > 0.003 ? 'live' : ''} style={{ display: warmMode ? 'block' : 'none' }}>
        <div id="levelFill" style={{ width: Math.min(100, micLevel * 1600) + '%' }} />
      </div>

      {warmMode && (
        <div id="warmupBox">
          <Tuner name={tunerName} cents={tunerCents} clarity={pitchInfo.pitchClarity} warmMode={warmMode} />
          <Metronome
            bpm={metroState.bpm}
            sig={metroState.sig}
            vol={metroState.vol}
            beat={metroBeat}
            onBpmChange={metronome.setBpm}
            onSigChange={metronome.setSig}
            onTap={() => {
              const b = metronome.tap();
              if (b) setStatus('BPM: ' + b);
            }}
            onVolChange={metronome.setVol}
          />
        </div>
      )}

      <div id="brand">🐝 ByFlow STUDIO</div>
      <div id="faderCol"><div id="faderFill" style={{ height: (fader * 100).toFixed(0) + '%' }} /></div>
      <div id="label" style={{ color: labelColor }}>{labelText}</div>
      <div id="sub">cierra=natural · abre=producido · {gestureHint || 'esperando mano…'}</div>
      <div id="pitchNote">
        {pitchInfo.midiTarget > 0 && (
          <>
            <span className="tunNote">{tunerName}</span>{' '}
            <span className="tunCents" style={{ color: Math.abs(tunerCents) <= 6 ? 'var(--green)' : (tunerCents > 0 ? 'var(--ylw)' : 'var(--mag)') }}>
              {tunerCents >= 0 ? '+' : ''}{tunerCents}¢
            </span>
          </>
        )}
      </div>

      <div id="recInfo">
        <span id="recTimer">{recording.isRecording ? recording.recDisplay : ''}</span>
        <span id="recPeak" className={micLevel > 0.005 ? 'live' : ''} />
      </div>

      <UserPresets
        presets={userPresets}
        selected={selectedPreset}
        onSelect={loadUserPreset}
        onSave={savePreset}
        onDelete={deletePreset}
        onReset={resetPresets}
      />

      <div id="quickPresets">
        {Object.keys(PRESETS_CORO).map((k) => (
          <button key={k} className="qp" onClick={() => applyPreset(k)}>
            {k === 'duo' && '🎤 Dueto'}
            {k === 'coro' && '🎶 Coro 3'}
            {k === 'greg' && '⛪ Grego'}
            {k === 'gospel' && '🙌 Gospel'}
          </button>
        ))}
      </div>

      <button id="btnWarm" className={warmMode ? 'on' : ''} onClick={toggleWarmMode} title="Modo calentamiento">🎧</button>
      <button id="btnBeat" className={beatPanelOpen ? 'on' : ''} onClick={() => setBeatPanelOpen(o => !o)} title="Beat IA">🥁</button>
      <ProducerPanel prod={prod} setProd={setProd} open={panelOpen} onToggle={() => setPanelOpen(o => !o)} />

      <div id="controls">
        <button onClick={handleCalClose}>✊ Cal CERR</button>
        <button id="btnRec" className={recording.isRecording ? 'recording' : ''} onClick={handleRec} title="GRABAR">
          {recording.isRecording ? '■' : 'REC'}
        </button>
        <button onClick={handleCalOpen}>🖐 Cal ABI</button>
      </div>

      <div id="status">{status}</div>

      <VideoModal
        open={videoModalOpen}
        videoBlob={videoBlob}
        onClose={() => setVideoModalOpen(false)}
        onEdit={handleEdit}
        onDownloadVideo={recording.downloadVideo}
        onDownloadWAV={recording.downloadWAV}
        onShare={recording.shareVideo}
      />

      <DAWModal
        open={dawModalOpen}
        canvasRef={canvasRef}
        onClose={() => setDawModalOpen(false)}
        onProcess={handleProcess}
        onExport={handleExport}
        setTrim={setTrim}
        setEQ={setEQ}
      />

      {beatPanelOpen && (
        <div id="beatIAModal">
          <div className="beatIAModalInner">
            <button className="beatClose" onClick={() => setBeatPanelOpen(false)}>✕</button>
            <BeatIA
              prompt={beatPrompt}
              setPrompt={setBeatPrompt}
              bpm={beatBpm}
              setBpm={setBeatBpm}
              duration={beatDuration}
              setDuration={setBeatDuration}
              style={beatStyle}
              setStyle={setBeatStyle}
              volume={beatVolume}
              setVolume={setBeatVolume}
              loading={beatAI.loading}
              error={beatAI.error}
              status={beatAI.status}
              progress={beatAI.progress}
              onGenerate={handleGenerateBeat}
              onPlay={handlePlayBeat}
              onStop={() => { beatAI.stopBeat(); setBeatPlaying(false); }}
              isPlaying={beatPlaying}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
