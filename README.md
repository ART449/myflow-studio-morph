# MyFlow STUDIO v2 — React + AI Beats

Estudio vocal con auto-tune, control gestual, beats generados por IA y mini-DAW.
Ahora en React + Vite, con backend Python y servicio de beats MusicGen.

> Demo: `/demos/myflow-studio/` en [iartlabs.lat](https://iartlabs.lat)  
> Repo: `ART449/myflow-studio-morph`

## 🎤 ¿Qué hace?

- **Auto-tune** a 7 escalas musicales
- **Armonizador 3 voces** con intervalos y género independiente
- **Grabación vertical 9:16** lista para compartir
- **Beat IA** con MusicGen: elige estilo, BPM y duración
- **Control por gestos** de mano: graba, genera beats, cambia estilos
- **Mini-DAW**: waveform, trim, EQ 3-bandas, export WAV
- **Backend API** para presets, uploads, health y SSE

## 📦 Arquitectura

```
myflow-studio-morph/
├── myflow-studio/    # App React + Vite
├── api/server.py     # Backend Python (sirve build + API)
├── beat-ia-service/  # MusicGen service (FastAPI)
├── dist/             # Build de producción
├── Dockerfile        # Imagen del STUDIO
├── docker-compose.yml # STUDIO + Beat IA
└── IARTLABS/demos/myflow-studio/  # Página demo
```

## 🚀 Correr local

```bash
# 1. Backend STUDIO
cd myflow-studio-morph
python api/server.py --port 8774 --host 0.0.0.0

# 2. Beat IA service (en otra terminal)
cd beat-ia-service
.\venv\Scripts\python main.py

# 3. Abrir navegador
open http://localhost:8774
```

## 🐳 Docker

```bash
docker-compose up --build -d
```

## 📱 Mobile

En celulares se requiere HTTPS para cámara/micrófono. Se recomienda desplegar con certificado o usar Tailscale.

## 🖐️ Gestos

| Gesto | Acción |
|---|---|
| ✊ Puño cerrado + bajar | Grabar / detener |
| ✋ Palma abierta | Detener todo |
| 👍 Pulgar arriba | Play / pause beat |
| ☝ Anular extendido | Abrir / cerrar Beat IA |
| 👌 Pulgar + índice círculo | Generar beat |
| ✌ Índice + medio | Cambiar estilo de beat |

> "El sistema parpadea, pero el código no miente." — IArtLabs

## 🎛 Panel de producción

```
 [1 voz]  [2 voces]  [3 voces]

 VOZ 1 · Tú
 Escala  [mayor][menor][pentaMayor][pentaMenor][dórica]...
 Género  ♂ ────●────── ♀  (original)
 Tune    ──────●──────  70%

 VOZ 2 · Armonía
 Modo    [Sigue V1] [Libre]
 Escala  [menor][pentaMenor][cromática]...
 Intrv   [-8va][-5J][+3m][+3M][+5J][+8va]
 Género  ♂ ────────●── ♀  (femenina)
 Delay   ──●───────  60ms
 Vol     ──────●────  70%

 VOZ 3 · Armonía 2
 (mismos controles, defaults para voz masculina grave)
```

## 🎬 Post-grabación (mini-DAW)

Después de grabar:
1. **Waveform** visual del audio capturado
2. **Trim** inicio/fin con sliders
3. **EQ** Low/Mid/High post-procesado
4. **Procesar** → renderiza con OfflineAudioContext
5. **Exportar WAV** → descarga PCM 16-bit masterizado

## 🎧 Herramientas para el creador

| Herramienta | Para qué sirve |
|---|---|
| **Tuner** | Ver tu afinación en vivo. Útil para calentar y corregir tendencias. |
| **Metrónomo** | Practicar a tempo, grabar tomas limpias, grabar con click. |
| **Presets de usuario** | Guardar tu propio coro personalizado y recuperarlo en cualquier sesión. |
| **Modo práctica** | Ejercicios de escala, tono objetivo y sostenido de nota raíz. |
| **WAV export** | Descargar tomas sueltas o mezclas ya masterizadas. |

## 🖥 VICTUSART RVC (voz entrenada, calidad humana)

Incluido en `victusart_rvc/` — pipeline para entrenar una voz melódica real
con RVC (Retrieval-based Voice Conversion) y control gestual en vivo.

**Requisito:** GPU NVIDIA (RTX 3050+ recomendado).

```bash
# 1. Setup (una vez)
bash victusart_rvc/00_setup.sh

# 2. Pon tus audios limpios en dataset_voz/

# 3. Entrena (~2-4h en RTX 3050)
bash victusart_rvc/01_train.sh MiVozMelodica

# 4. Demo tiempo real con mano
python victusart_rvc/02_realtime_mano.py --model MiVozMelodica

# 5. Conversión offline calidad máxima
python victusart_rvc/03_convertir_archivo.py --model MiVozMelodica --in mi_voz.wav --out final.wav
```

## 🟡 Límites conocidos

- **Web**: pitch shift granular (algoritmo Jungle). Suena a efecto, no a persona real.
  La voz humana real requiere el pipeline RVC en VICTUSART.
- **Latencia**: ~80-120ms según navegador. Usa audífonos para evitar acople.
- **Chrome**: Solo Chrome/Edge da el rendimiento Web Audio necesario.
  Safari/Firefox funcionan pero con más latencia.
- **iOS**: MediaPipe Hands puede tener latencia extra en Safari.

## 🐝 Créditos

- **IArtLabs** — powered by
- **By ArT-AtR** — "Art en el arte de rimarte"
- **ByFlow / MyFlow** — ecosistema creativo
- **La Colmena** — agentes IA coordinados

---

*Versión 2.0.0-Suno — Cero apps. Puro navegador.*
