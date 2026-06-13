#!/usr/bin/env bash
# ============================================================
#  VICTUSART RVC — Entrenamiento de la voz melódica
#  Uso:  bash 01_train.sh <NOMBRE_MODELO>
#  Requisito: audios limpios (WAV/MP3) en ./dataset_voz/
# ============================================================
set -e
MODELO="${1:-MiVozMelodica}"
DATASET="${2:-./dataset_voz}"
RVC_DIR="$HOME/Retrieval-based-Voice-Conversion-WebUI"
# --- Ajustado para RTX 3050 6GB ---
SR=40000          # 40k = buena calidad melódica y entra cómodo en 6GB
EPOCHS=250        # 150-300 para voz cantada; más epochs = más fiel
BATCH=6           # RTX 3050 6GB: 6 es el punto seguro.
# Si ves "CUDA out of memory": baja BATCH a 4 (o 2).

cd "$RVC_DIR"

echo "🐝 Dataset: $DATASET"
echo "🐝 Modelo:  $MODELO  ·  SR=$SR  ·  epochs=$EPOCHS"
ls "$DATASET" | head

# --- Paso 1: preprocesado (corta silencios, normaliza, resamplea) ---
echo "🐝 [1/4] Preprocesando audio..."
python infer/modules/train/preprocess.py "$DATASET" $SR 2 "logs/$MODELO" False 3.0

# --- Paso 2: extracción de pitch (f0) + features hubert ---
echo "🐝 [2/4] Extrayendo F0 (pitch) con RMVPE — clave para melodía..."
python infer/modules/train/extract/extract_f0_rmvpe.py 1 0 0 "logs/$MODELO" True
python infer/modules/train/extract_feature_print.py cuda:0 1 0 0 "logs/$MODELO" v2

# --- Paso 3: entrenar índice de retrieval (timbre fiel) ---
echo "🐝 [3/4] Construyendo índice FAISS..."
python infer/modules/train/train_index.py "$MODELO" v2 || true

# --- Paso 4: entrenar el modelo ---
echo "🐝 [4/4] Entrenando ($EPOCHS epochs)... esto tarda. Ve por café ☕"
python infer/modules/train/train.py \
  -e "$MODELO" -sr ${SR:0:2}k -f0 1 -bs $BATCH \
  -te $EPOCHS -se 25 -pg assets/pretrained_v2/f0G${SR:0:2}k.pth \
  -pd assets/pretrained_v2/f0D${SR:0:2}k.pth -l 0 -c 0 -sw 1 -v v2

echo ""
echo "✅ Entrenado. Modelo en: assets/weights/$MODELO.pth"
echo "   Índice en: logs/$MODELO/added_*.index"
echo "   Prueba en vivo:  python 02_realtime_mano.py --model $MODELO"
