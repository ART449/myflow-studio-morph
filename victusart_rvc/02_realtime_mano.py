#!/usr/bin/env python3
# ============================================================
#  VICTUSART RVC — Inferencia en tiempo real + control de mano
#  La mano (pinza pulgar-índice) mueve el fader voz tuya <-> voz melódica.
#
#  Uso:
#    python 02_realtime_mano.py --model MiVozMelodica
#
#  Requisitos (instalados por 00_setup.sh):
#    torch (CUDA), sounddevice, mediapipe, opencv-python, numpy
#    + el modelo entrenado en assets/weights/<model>.pth
# ============================================================
import argparse, os, sys, threading, queue, time
import numpy as np

# --- RVC: localizar el repo y el motor de inferencia ---
RVC_DIR = os.path.expanduser("~/Retrieval-based-Voice-Conversion-WebUI")
sys.path.insert(0, RVC_DIR)

import sounddevice as sd
import cv2
import mediapipe as mp

# ------------------------------------------------------------
# 1) Estado compartido: la mano escribe 'fader', el audio lo lee
# ------------------------------------------------------------
class Estado:
    def __init__(self):
        self.fader = 0.0          # 0 = tu voz · 1 = voz melódica
        self.cal_min = 0.15
        self.cal_max = 1.10
        self.lock = threading.Lock()
    def set_apertura(self, cruda):
        x = (cruda - self.cal_min) / max(self.cal_max - self.cal_min, 1e-6)
        x = min(1.0, max(0.0, x))
        with self.lock:
            self.fader = self.fader * 0.75 + x * 0.25   # suavizado EMA
    def get(self):
        with self.lock:
            return self.fader

estado = Estado()

# ------------------------------------------------------------
# 2) Hilo de VISIÓN: MediaPipe lee pulgar(4)-indice(8)
# ------------------------------------------------------------
def hilo_vision():
    mp_hands = mp.solutions.hands
    cap = cv2.VideoCapture(0)
    with mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.6) as hands:
        while True:
            ok, frame = cap.read()
            if not ok:
                continue
            frame = cv2.flip(frame, 1)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = hands.process(rgb)
            if res.multi_hand_landmarks:
                lm = res.multi_hand_landmarks[0].landmark
                dPI = np.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y)
                dRef = np.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y)
                if dRef > 1e-6:
                    estado.set_apertura(dPI / dRef)
                # dibujo simple
                h, w, _ = frame.shape
                p4 = (int(lm[4].x*w), int(lm[4].y*h))
                p8 = (int(lm[8].x*w), int(lm[8].y*h))
                cv2.line(frame, p4, p8, (28, 184, 255), 4)
                cv2.circle(frame, p4, 9, (243, 235, 221), -1)
                cv2.circle(frame, p8, 9, (243, 235, 221), -1)
            f = estado.get()
            # barra fader
            h, w, _ = frame.shape
            cv2.rectangle(frame, (w-50, 60), (w-20, h-120), (110, 100, 90), 2)
            top = int((h-120) - f*((h-120)-60))
            cv2.rectangle(frame, (w-48, top), (w-22, h-122), (28, 184, 255), -1)
            etiqueta = "TU VOZ" if f < .15 else ("MELODICA" if f > .85 else "MEZCLA")
            cv2.putText(frame, etiqueta, (20, 50), cv2.FONT_HERSHEY_DUPLEX, 1.1,
                        (0, 184, 255), 2)
            cv2.putText(frame, "[c]=cerrado  [a]=abierto  [q]=salir", (20, h-20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
            cv2.imshow("Mano Morph RVC - VICTUSART", frame)
            k = cv2.waitKey(1) & 0xFF
            if k == ord('q'):
                os._exit(0)
            elif k == ord('c'):
                estado.cal_min = (dPI/dRef) if res.multi_hand_landmarks else estado.cal_min
                print(f"✊ cerrado = {estado.cal_min:.2f}")
            elif k == ord('a'):
                estado.cal_max = (dPI/dRef) if res.multi_hand_landmarks else estado.cal_max
                print(f"🖐 abierto = {estado.cal_max:.2f}")

# ------------------------------------------------------------
# 3) Motor RVC en tiempo real
# ------------------------------------------------------------
def cargar_rvc(model_name):
    """Carga el modelo entrenado usando el VC pipeline de RVC."""
    from configs.config import Config
    from infer.modules.vc.modules import VC
    cfg = Config()
    vc = VC(cfg)
    weight = f"{model_name}.pth"
    vc.get_vc(weight)
    # localizar el índice FAISS
    idx = ""
    logdir = os.path.join(RVC_DIR, "logs", model_name)
    if os.path.isdir(logdir):
        for fn in os.listdir(logdir):
            if fn.startswith("added_") and fn.endswith(".index"):
                idx = os.path.join(logdir, fn)
                break
    return vc, idx

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="nombre del modelo entrenado")
    ap.add_argument("--device-in", type=int, default=None, help="indice mic")
    ap.add_argument("--device-out", type=int, default=None, help="indice salida")
    ap.add_argument("--block", type=float, default=0.40,
                    help="seg por bloque. RTX 3050: 0.35-0.50 (más bajo = más latencia de CPU/GPU)")
    ap.add_argument("--index-rate", type=float, default=0.5, help="fuerza del timbre (0-1)")
    args = ap.parse_args()

    print("🐝 Cargando RVC:", args.model)
    print("   ⚠ RTX 3050: el tiempo real va con ~0.4s de latencia. Si entrecorta,")
    print("     sube --block a 0.5 o usa el modo archivo (03_convertir_archivo.py)")
    print("     para el VIDEO FINAL — ahí la calidad es perfecta sin latencia.")
    vc, index_path = cargar_rvc(args.model)
    SR = 16000  # RVC procesa internamente; sd resamplea
    block = int(args.block * SR)

    audio_q = queue.Queue()

    def cb(indata, outdata, frames, t, status):
        seco = indata[:, 0].copy()
        f = estado.get()
        if f < 0.02:
            outdata[:, 0] = seco            # pasa tu voz tal cual
            return
        try:
            # convertir bloque con RVC (pitch shift implícito + timbre)
            _, wav = vc.vc_single(
                sid=0, input_audio_path=None, audio=seco, f0_up_key=0,
                f0_method="rmvpe", file_index=index_path,
                index_rate=args.index_rate * f, filter_radius=3,
                resample_sr=0, rms_mix_rate=0.25, protect=0.33,
            )
            conv = np.asarray(wav, dtype=np.float32)
            if len(conv) < frames:
                conv = np.pad(conv, (0, frames - len(conv)))
            conv = conv[:frames]
            # crossfade seco <-> convertida segun fader (potencia constante)
            import math
            g_dry = math.cos(f * math.pi / 2)
            g_wet = math.sin(f * math.pi / 2)
            outdata[:, 0] = seco * g_dry + conv * g_wet
        except Exception as e:
            outdata[:, 0] = seco
            print("conv err:", e)

    print("🐝 Abriendo stream de audio... (usa AUDÍFONOS)")
    with sd.Stream(channels=1, samplerate=SR, blocksize=block,
                   dtype="float32", callback=cb,
                   device=(args.device_in, args.device_out)):
        print("🟢 EN VIVO. Mueve la pinza. Ctrl+C para salir.")
        while True:
            time.sleep(0.5)

if __name__ == "__main__":
    threading.Thread(target=hilo_vision, daemon=True).start()
    main()
