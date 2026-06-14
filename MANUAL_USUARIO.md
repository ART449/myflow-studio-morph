# Manual de Usuario — MyFlow STUDIO

> Para cantantes, raperos, creadores de contenido y músicos.
> No necesitas saber de código. Solo tu voz y una mano.

## 🎤 ¿Qué es MyFlow STUDIO?

Un **armonizador vocal con control gestual** que corre en el navegador
de tu celular. Cantas al micrófono y mueves la pinza (pulgar contra índice)
frente a la cámara para transformar tu voz en vivo.

**Suenas como un dueto, un trío o un coro completo — cantando tú solo.**

## 📱 Qué necesitas

- Un celular con cámara y micrófono
- Chrome (Android) o Safari (iPhone)
- **Audífonos** (obligatorio — sin ellos se acopla y chilla)
- WiFi para cargar el modelo de mano la primera vez

## 🚀 Cómo empezar (2 minutos)

### Si estás en la misma red que el server:

1. Abre Chrome en tu celular
2. Ve a la URL que te dieron (ej. `http://192.168.68.204:8000/mano_morph_byflow.html`)
3. Pulsa **INICIAR**
4. Da permiso a cámara y micrófono cuando Chrome te lo pida
5. **Ponte los audífonos**
6. Calibra la mano (ver abajo)
7. Empieza a cantar

### Si tienes el archivo en tu compu:

1. Descarga `mano_morph_studio.html`
2. En terminal: `python3 -m http.server 8000`
3. Chrome → `http://localhost:8000/mano_morph_studio.html`

> ⚠️ Tiene que ser por `localhost` servido. NO abras el archivo directo.
> Chrome solo da cámara y micrófono en conexiones seguras (localhost o HTTPS).

## ✋ Calibración de la mano

MyFlow STUDIO usa la distancia entre tu pulgar y tu índice para controlar
la mezcla. Necesitas decirle cuándo tu mano está cerrada y cuándo abierta.

1. Pon tu mano frente a la cámara (se ve en la pantalla)
2. **Cierra pulgar e índice** (como pellizcando) → pulsa **"Cal CERRAR"**
3. **Abre pulgar e índice** (mano abierta) → pulsa **"Cal ABRIR"**

Ya está. Ahora:
- **Mano cerrada** = tu voz natural, sin efectos
- **Mano abierta** = todas las voces producidas

## 🎶 Presets rápidos de coro

Del lado derecho de la pantalla hay 4 botones. Púlsalos para cambiar
el estilo al instante:

| Preset | Voces | Cómo suena |
|---|---|---|
| **Dueto** | 2 | Tú + una voz femenina en 5ª. Clásico. |
| **Coro 3** | 3 | Tú + 3ª femenina + 5ª masculina. Trío completo. |
| **Grego** | 3 | Dórica, 5ªs, delays largos. Canto gregoriano cibernético. |
| **Gospel** | 3 | Penta mayor, 3ª+5ª tight. Coro de iglesia. |

## 🎛 Panel de producción (avanzado)

Para los que quieren control total. Pulsa el botón 🎛 (abajo-derecha).

### Voces

Puedes tener **1, 2 o 3 voces** cantando al mismo tiempo:

- **Voz 1** — eres tú. Con auto-tune para que siempre cantes afinado.
- **Voz 2** — tu primera armonía. Puede ser femenina o masculina.
- **Voz 3** — tu segunda armonía. Igual, otro género y otro tono.

### Por cada voz puedes ajustar:

- **Escala** — mayor, menor, pentatónica, dórica, mixolidia, cromática...
- **Modo** — "Sigue V1" (armoniza a partir de tu nota) o "Libre" (canta en su propia escala)
- **Intervalo** — cuántos semitonos arriba o abajo de tu voz (-8va, -5ª, +3ª, +5ª, +8va...)
- **Género** — ♂ (voz grave, masculina) a ♀ (voz aguda, femenina)
- **Delay** — milisegundos de retraso (para que suene a coro real, no pegado)
- **Volumen** — qué tan fuerte suena esa voz

### Auto-tune

El slider de **Tune** controla qué tan fuerte se corrige tu voz:
- **0%** = sin corrección (tu voz natural)
- **50%** = corrección suave (todavía suenas humano)
- **100%** = cuantización total (efecto T-Pain / Cher)

## 🎬 Grabar y compartir

1. Pulsa el botón rojo **REC**
2. Canta tu canción (con la mano controlando la mezcla)
3. Pulsa **REC** de nuevo para detener
4. Se abre una ventana con tu video vertical (listo para TikTok/Reels)
5. Opciones:
   - **Compartir** — envía directo a WhatsApp, Instagram, TikTok...
   - **Guardar** — descarga el video a tu celular
   - **Editar audio** — abre el mini-DAW (ver abajo)

## 🎛 Editor post-grabación (mini-DAW)

Después de grabar, puedes editar solo el audio:

1. Pulsa **"Editar audio"** tras grabar
2. Verás la **forma de onda** de tu voz
3. **Trim** — recorta el inicio y el final con los sliders
4. **EQ** — ajusta graves, medios y agudos (Low/Mid/High)
5. Pulsa **"Procesar"** para aplicar los cambios
6. Pulsa **"Exportar WAV"** para descargar el audio masterizado

El WAV exportado es calidad 16-bit, compatible con cualquier software
de edición (Audacity, Premiere, CapCut, etc.)

## 🟡 Consejos

- **Audífonos siempre.** Si usas el altavoz del celular, el micrófono capta
  el sonido de vuelta y se produce un acople horrible.
- **Buena luz.** La cámara necesita ver tu mano claramente. No a contraluz.
- **Acércate.** La mano debe ocupar buena parte del cuadro. No muy lejos.
- **Elige la escala correcta.** Si cantas en mayor, pon la escala en mayor.
  Si improvisas libre, usa cromática.
- **Empieza con Dueto.** Dos voces es lo más fácil de controlar. Luego sube a 3.
- **El delay da realismo.** 40-80ms para voz femenina (más cerca), 80-120ms para
  voz masculina (más lejos). Así suena a escenario real.

## 🐝 Créditos

- **MyFlow STUDIO** — parte del ecosistema MyFlow
- **Powered by IArtLabs** — Aguascalientes, MX
- **By ArT-AtR** — "Art en el arte de rimarte"
- **La Colmena** — agentes IA coordinados

---

*Versión celular. Cero apps. Puro navegador.*
*"El sistema parpadea, pero el código no miente."*
