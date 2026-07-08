"""
MyFlow Beat IA Service
Genera beats/instrumentales usando MusicGen (small) vía Hugging Face.
Endpoint: POST /generate-beat
Devuelve audio WAV en base64 + metadatos.
"""
import os
import re
import base64
import tempfile
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import soundfile as sf
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("beat-ia")

# ── FastAPI + CORS ──────────────────────────────────────────────────────────
app = FastAPI(title="MyFlow Beat IA", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Device / Model globals ──────────────────────────────────────────────────
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info("Device: %s", device)

model = None
processor = None


def _load_model():
    global model, processor
    if model is not None:
        return
    try:
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
        logger.info("Cargando MusicGen small...")
        model_name = "facebook/musicgen-small"
        processor = AutoProcessor.from_pretrained(model_name)
        model = MusicgenForConditionalGeneration.from_pretrained(model_name)
        model = model.to(device)
        model.eval()
        logger.info("MusicGen small cargado en %s", device)
    except Exception as e:
        logger.exception("No se pudo cargar MusicGen: %s", e)
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_model()
    yield


app.router.lifespan_context = lifespan


# ── Request / Response schemas ──────────────────────────────────────────────
class BeatRequest(BaseModel):
    prompt: str = "trap beat, 808 bass, hi-hats, dark atmosphere"
    bpm: int = 90
    duration: int = 8
    style: str = "trap"
    seed: int | None = None


class BeatResponse(BaseModel):
    success: bool
    audio_b64: str
    sample_rate: int
    duration_seconds: float
    prompt: str
    bpm: int
    style: str
    inference_seconds: float
    device: str


# ── Helpers ─────────────────────────────────────────────────────────────────
STYLE_PROMPTS = {
    "trap": "trap beat, hard 808 bass, fast hi-hats, dark synths",
    "hiphop": "boom bap hip hop beat, vinyl crackle, laid back drums",
    "lofi": "lofi hip hop beat, jazz chords, soft drums, vinyl noise",
    "edm": "electronic dance music beat, four on the floor, synth pluck",
    "rock": "rock drum beat, energetic, electric guitar riff backing",
    "pop": "pop beat, bright synths, clap, energetic",
    "reggaeton": "reggaeton beat, dembow rhythm, perreo, 808",
    "rnb": "smooth R&B beat, soft drums, warm pads",
}


def _build_prompt(req: BeatRequest) -> str:
    style_part = STYLE_PROMPTS.get(req.style.lower(), req.style)
    user_part = req.prompt.strip() if req.prompt.strip() else ""
    if user_part:
        return f"{style_part}, {user_part}"
    return style_part


# MusicGen small genera a 32 kHz con ~50 tokens/segundo
TOKEN_RATE = 50.3


# ── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "device": device, "model_loaded": model is not None}


@app.post("/generate-beat", response_model=BeatResponse)
def generate_beat(req: BeatRequest):
    if model is None:
        _load_model()

    start = time.time()
    prompt_text = _build_prompt(req)

    # Limitar duración para no fundir la GPU de 6 GB
    duration = max(4, min(int(req.duration), 16))

    # Calcular tokens para la duración deseada
    max_tokens = int(duration * TOKEN_RATE)

    rng_seed = req.seed if req.seed is not None else int(time.time())
    torch.manual_seed(rng_seed)

    logger.info("Generando beat: bpm=%d dur=%d style=%s prompt=%s",
                req.bpm, duration, req.style, prompt_text)

    inputs = processor(
        text=[prompt_text],
        return_tensors="pt",
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        audio_values = model.generate(**inputs, max_new_tokens=max_tokens, do_sample=True)

    audio = audio_values[0, 0].cpu().numpy()
    sample_rate = model.config.audio_encoder.sampling_rate

    # Ajustar a mono float32
    if audio.ndim > 1:
        audio = audio.mean(axis=0)
    audio = audio.astype(np.float32)

    # Normalizar headroom
    peak = np.max(np.abs(audio))
    if peak > 1e-6:
        audio = audio / peak * 0.95

    # Guardar temporalmente a WAV y devolver base64
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, audio, sample_rate, format="WAV", subtype="PCM_16")
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            wav_bytes = f.read()
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    inference_seconds = round(time.time() - start, 2)

    logger.info("Beat generado: %.1fs audio en %.1fs", len(audio) / sample_rate, inference_seconds)

    return BeatResponse(
        success=True,
        audio_b64=base64.b64encode(wav_bytes).decode("ascii"),
        sample_rate=sample_rate,
        duration_seconds=round(len(audio) / sample_rate, 2),
        prompt=prompt_text,
        bpm=req.bpm,
        style=req.style,
        inference_seconds=inference_seconds,
        device=device,
    )


@app.get("/")
def root():
    return {"service": "MyFlow Beat IA", "endpoints": ["/health", "/generate-beat"]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7071)
