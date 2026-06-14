# Manual Técnico — MyFlow STUDIO

> Para desarrolladores, integradores y agentes de La Colmena.
> Arquitectura, dependencias, puntos de extensión y pipeline RVC.

## Arquitectura general

```
┌──────────────────────────────────────────────────────┐
│                  mano_morph_studio.html               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ MediaPipe    │  │ Audio Engine │  │ UI Layer    │ │
│  │ Hands JS     │  │ (Web Audio)  │  │ (DOM+Canvas)│ │
│  │              │  │              │  │             │ │
│  │ HandLandmarker│ │ Jungle x3   │  │ Panel prod  │ │
│  │ GPU delegate │  │ Formant x3  │  │ Mini-DAW    │ │
│  │ Pinza 4↔8   │  │ Reverb conv │  │ WaveCanvas  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │        │
│         └─────────────────┴──────────────────┘        │
│                    fader (0..1)                       │
│         ┌─────────────────────────────┐              │
│         │   MediaRecorder x2          │              │
│         │   video/mp4 + audio/webm    │              │
│         └─────────────────────────────┘              │
└──────────────────────────────────────────────────────┘
```

## Cadena de audio

```
mic → MediaStreamSource
        → AnalyserNode (noise gate detección)
        → GainNode (noiseGate)
              ├→ AnalyserNode (pitch detector, FFT 2048)
              ├→ gDry → output          (voz natural)
              └→ wetBus:
                    ├→ V1: Jungle → Formant → gV1 → wetBus
                    ├→ V2: DelayNode → Jungle → Formant → gV2 → wetBus
                    ├→ V3: DelayNode → Jungle → Formant → gV3 → wetBus
                    └→ ConvolverNode (reverb global) → revG → wetBus

gDry → AudioDestination + MediaStreamDestination
wetBus → gWet → AudioDestination + MediaStreamDestination

Crossfade: gDry.gain = cos(fader·π/2), gWet.gain = sin(fader·π/2)
```

### Componentes de audio

| Componente | Clase | Función |
|---|---|---|
| Jungle | `class J` | Pitch shifter granular (algoritmo Chris Wilson). 2 delays modulados con crossfade. Rampas up/down de 100ms. |
| Formant | `class F` | Banco de 3 filtros peaking (700/1220/2600 Hz) desplazables. Mueve el timbre sin afectar pitch. |
| Reverb | `ConvolverNode` | IR sintética: ruido blanco con decay exponencial. Compartida para todas las voces. |
| Noise Gate | `GainNode` | RMS threshold 0.008, ataque 5ms, release 80ms. Lee de AnalyserNode FFT 256. |
| Delays | `DelayNode` | Máximo 0.5s por voz. Control independiente en ms vía slider. |

## Detección de pitch

```
AnalyserNode FFT 2048 (48 kHz → ~23 Hz/bin)
  → getFloatFrequencyData()
  → Búsqueda de pico entre 60-1200 Hz (rango vocal)
  → Interpolación parabólica de 3 bins para sub-bin accuracy
  → Filtro de mediana (ventana 6 muestras)
  → Conversión MIDI: 69 + 12·log₂(f/440)
```

## Auto-tune

```
pitchHz detectado → EMA (α=0.3)
  → MIDI raw
  → nearestScale(midiRaw, escala) → MIDI tuned
  → MIDI target = midiRaw·(1-atStrength) + midiTuned·atStrength
  → fTarget = 440·2^((target-69)/12)
  → corrección = fTarget/fDetectada - 1
  → Jungle.setMult(corrección)
```

## Armonizador

```
V1: midiV1 (auto-tuned)
V2: modo="follow" → midiV1 + intervalo → nearestScale(result, escalaV2)
     modo="propia" → nearestScale(midiRaw, escalaV2)
V3: igual que V2 con su propio intervalo y escala
```

## Escalas soportadas

| Escala | Semitonos |
|---|---|
| mayor | 0,2,4,5,7,9,11 |
| menor | 0,2,3,5,7,8,10 |
| pentaMayor | 0,2,4,7,9 |
| pentaMenor | 0,3,5,7,10 |
| dórica | 0,2,3,5,7,9,10 |
| mixolidia | 0,2,4,5,7,9,10 |
| cromática | 0,1,2,3,4,5,6,7,8,9,10,11 |

## Grabación

- **Video**: `MediaRecorder(video.srcObject + destNode.stream, video/mp4)` 2.5Mbps, 720×1280
- **Audio**: `MediaRecorder(destNode.stream, audio/webm)` para edición post
- WAV export: header 44 bytes + PCM 16-bit little-endian

## Mini-DAW

```
audioBlob (WebM) → decodeAudioData() → AudioBuffer
  → waveform canvas (peaks drawing)
  → trim sliders (0-100%)
  → OfflineAudioContext con BiquadFilterNode:
       lowShelf(300Hz) → peaking(1kHz, Q=1) → highShelf(3kHz)
  → startRendering() → nuevo AudioBuffer
  → export WAV 16-bit
```

## Dependencias CDN

- **MediaPipe Hands**: `@mediapipe/tasks-vision@0.10.14` (HandLandmarker, FilesetResolver, WASM)
- **Modelo**: `hand_landmarker/float16/1/hand_landmarker.task` desde Google Storage

Sin dependencias npm. Un solo archivo HTML autocontenido.

## Puntos de extensión

- **Nuevas escalas**: agregar entrada en `ESCALAS` (línea ~195)
- **Nuevos presets de coro**: agregar entrada en `PRESETS_CORO` (línea ~203)
- **Nuevos efectos**: insertar en la cadena wetBus dentro de `initAudio()`
- **Nuevo intervalo**: agregar entrada en `INTERVALOS`
- **Exportar MP3**: usar `AudioEncoder` o `lamejs` en `exportWAV()`

## Pipeline VICTUSART RVC

Incluido en `victusart_rvc/` para voz entrenada con calidad humana.

```
00_setup.sh     → Instala RVC (Mangio fork) + PyTorch CUDA + dependencias
01_train.sh     → Preprocesa + extrae F0 (RMVPE) + entrena (250 ep, batch=6, 40k)
02_realtime_mano.py → Inferencia tiempo real con MediaPipe Python + RVC
03_convertir_archivo.py → Conversión offline WAV (calidad máxima, sin latencia)
```

**Requisitos**: GPU NVIDIA (RTX 3050+), Python 3.10, PyTorch CUDA.

## Limitaciones técnicas

| Área | Límite |
|---|---|
| Pitch shift | Algoritmo granular (Jungle). Latencia ~100ms. Sonido "efecto", no humano. |
| Voces | Máximo 3 (cada Jungle consume ~20% CPU en móvil). |
| Navegador | Chrome/Edge óptimo. Safari/Firefox con latencia extra. |
| iOS | MediaPipe WASM puede tener latencia adicional en Safari. |
| Offline | Requiere servidor local (localhost). No funciona en file://. |

## Branding

- **Nombre**: MyFlow STUDIO
- **Marca**: 🐝 ByFlow / MyFlow
- **Empresa**: IArtLabs — Aguascalientes, MX
- **Creador**: ArT-AtR — "Art en el arte de rimarte"
- **Lema**: "El sistema parpadea, pero el código no miente."
- **GitHub**: `ART449/myflow-studio-morph`
