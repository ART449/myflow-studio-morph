#!/usr/bin/env python3
# ============================================================
#  VICTUSART RVC — Conversión por archivo (CALIDAD MÁXIMA)
#  Para el VIDEO FINAL: sin latencia, calidad perfecta.
#
#  Flujo recomendado para redes:
#    1) Graba en la web (mano + tu voz) -> sale clip con audio crudo
#    2) Extrae el audio o graba la voz aparte (WAV)
#    3) Conviértelo aquí a la voz melódica entrenada
#    4) Re-monta el audio convertido sobre el video
#
#  Uso:
#    python 03_convertir_archivo.py --model MiVozMelodica \
#           --in mi_voz.wav --out voz_melodica.wav --pitch 0
#
#    --pitch  : semitonos (+12 una octava arriba; 0 deja el pitch, solo cambia timbre)
#    --index  : fuerza del timbre objetivo 0-1 (default 0.66)
# ============================================================
import argparse, os, sys
import numpy as np
import soundfile as sf

RVC_DIR = os.path.expanduser("~/Retrieval-based-Voice-Conversion-WebUI")
sys.path.insert(0, RVC_DIR)

def cargar_rvc(model_name):
    from configs.config import Config
    from infer.modules.vc.modules import VC
    cfg = Config()
    vc = VC(cfg)
    vc.get_vc(f"{model_name}.pth")
    idx = ""
    logdir = os.path.join(RVC_DIR, "logs", model_name)
    if os.path.isdir(logdir):
        for fn in os.listdir(logdir):
            if fn.startswith("added_") and fn.endswith(".index"):
                idx = os.path.join(logdir, fn); break
    return vc, idx

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--in", dest="inp", required=True, help="audio de entrada (WAV/MP3)")
    ap.add_argument("--out", default="salida_rvc.wav")
    ap.add_argument("--pitch", type=int, default=0, help="semitonos (0 = sin cambio de tono)")
    ap.add_argument("--index", type=float, default=0.66, help="fuerza del timbre 0-1")
    args = ap.parse_args()

    print("🐝 Cargando modelo:", args.model)
    vc, index_path = cargar_rvc(args.model)

    print("🐝 Convirtiendo:", args.inp)
    info, (sr, wav) = vc.vc_single(
        sid=0,
        input_audio_path=os.path.abspath(args.inp),
        f0_up_key=args.pitch,
        f0_method="rmvpe",          # mejor para canto/melodía
        file_index=index_path,
        index_rate=args.index,
        filter_radius=3,
        resample_sr=0,
        rms_mix_rate=0.25,          # conserva dinámica original
        protect=0.33,               # protege consonantes (menos artefactos)
    )
    wav = np.asarray(wav, dtype=np.float32)
    peak = np.max(np.abs(wav)) or 1.0
    wav = wav / peak * 0.97         # normaliza sin clipear
    sf.write(args.out, wav, sr)
    print(f"✅ Listo: {args.out}  ({sr} Hz, {len(wav)/sr:.1f}s)")
    print("   Re-monta este audio sobre tu video y sube a redes. 🐝🎬")

if __name__ == "__main__":
    main()
