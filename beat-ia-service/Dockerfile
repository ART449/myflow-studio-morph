# MyFlow Beat IA — MusicGen service
FROM python:3.12-slim
WORKDIR /app

# Instala dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./
COPY start_beat_ia.bat ./

EXPOSE 7071

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/cache

CMD ["python", "main.py"]
