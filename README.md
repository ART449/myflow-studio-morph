# MyFlow STUDIO — Mano Morph + DAW

Armonizador vocal con auto-tune, control gestual y mini-DAW integrado.
Un solo archivo HTML. Cero instalación. Corre en cualquier navegador moderno.

> "El sistema parpadea, pero el código no miente." — IArtLabs

## 🎤 ¿Qué hace?

Cantas al micrófono y **mueves la pinza pulgar-índice frente a la cámara**
para controlar la mezcla entre tu voz natural y un arreglo vocal producido
en tiempo real.

- **Auto-tune** a 7 escalas musicales (mayor, menor, pentatónica, dórica...)
- **Armonizador 3 voces** con intervalos configurables
- **Género independiente por voz** (♂ masculino / ♀ femenino)
- **Delay por voz** para espacialidad de coro real
- **Presets de coro**: Dueto, Coro 3, Gregoriano, Gospel
- **Grabación vertical 9:16** nativa para TikTok/Reels
- **Mini-DAW post-grabación**: waveform, trim, EQ 3-bandas, export WAV
- **Efectos**: formant shift, noise gate, reverb convolucional, bitcrusher

## 📱 Cómo usar (2 minutos)

1. Descarga `mano_morph_studio.html`
2. `python3 -m http.server 8000`
3. Chrome → `http://localhost:8000/mano_morph_studio.html`
4. **Audífonos puestos** (obligatorio, sin ellos se acopla)
5. INICIAR → dar permisos de cámara + mic
6. Calibra: mano cerrada → "Cal CERRAR", mano abierta → "Cal ABRIR"
7. Preset rápido: pulsa **Dueto**, **Coro 3**, **Grego** o **Gospel**
8. REC → canta → Compartir / Guardar

> Tiene que ser por `localhost` (servido con http.server), no abriendo el archivo directo — Chrome solo da cámara/mic en contexto seguro.

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
- **Latencia**: ~100ms en el Jungle. Usa audífonos para evitar acople.
- **Chrome**: Solo Chrome/Edge da el rendimiento Web Audio necesario.
  Safari/Firefox funcionan pero con más latencia.
- **iOS**: MediaPipe Hands puede tener latencia extra en Safari.

## 🐝 Créditos

- **IArtLabs** — powered by
- **By ArT-AtR** — "Art en el arte de rimarte"
- **ByFlow / MyFlow** — ecosistema creativo
- **La Colmena** — agentes IA coordinados

---

*Versión celular. Cero apps. Puro navegador.*
