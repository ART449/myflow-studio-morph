#!/usr/bin/env bash
# ============================================================
#  VICTUSART RVC — Setup (voz melódica entrenada, calidad humana)
#  Corre en VICTUSART (GPU NVIDIA). NO en el Pixel.
# ============================================================
set -e

echo "🐝 [1/5] Verificando GPU (objetivo: RTX 3050)..."
if ! command -v nvidia-smi &>/dev/null; then
  echo "⚠  No veo nvidia-smi. RVC necesita GPU NVIDIA para entrenar rápido."
  echo "   (Puedes entrenar en CPU pero tardará 10-20x más.)"
else
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
  VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
  if [ "$VRAM" -lt 6000 ]; then
    echo "   ➜ Detectada VRAM ~4GB. Usa BATCH=4 (o 2) en 01_train.sh. SR=40k."
  else
    echo "   ➜ Detectada VRAM ~8GB. Puedes usar BATCH=6-8 y SR hasta 48k."
  fi
fi

echo "🐝 [2/5] Creando entorno Python (conda recomendado)..."
# Opción A: conda (recomendado)
if command -v conda &>/dev/null; then
  conda create -y -n rvc python=3.10
  echo "   Activa con: conda activate rvc"
  PY="conda run -n rvc python"
else
  # Opción B: venv
  python3.10 -m venv ~/rvc-env 2>/dev/null || python3 -m venv ~/rvc-env
  source ~/rvc-env/bin/activate
  PY="python"
fi

echo "🐝 [3/5] Clonando RVC (Mangio fork — el mejor para tiempo real)..."
cd ~
if [ ! -d "Retrieval-based-Voice-Conversion-WebUI" ]; then
  git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI.git
fi
cd Retrieval-based-Voice-Conversion-WebUI

echo "🐝 [4/5] Instalando dependencias (PyTorch CUDA + RVC)..."
# PyTorch con CUDA 11.8 (ajusta a tu driver con nvidia-smi)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
# Para inferencia en tiempo real:
pip install sounddevice mediapipe opencv-python

echo "🐝 [5/5] Descargando modelos base (hubert + pretrained)..."
python tools/download_models.py || \
  echo "   Si falla, descarga manual: assets/hubert/hubert_base.pt y assets/pretrained_v2/"

echo ""
echo "✅ Setup listo."
echo "   1) Pon tus audios limpios en:  ./dataset_voz/"
echo "   2) Entrena con:                bash 01_train.sh MiVozMelodica"
echo "   3) Demo tiempo real con mano:  python 02_realtime_mano.py --model MiVozMelodica"
