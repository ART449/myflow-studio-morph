# MyFlow STUDIO v2 — Docker production image
# Build stage: compila React app
FROM node:24-alpine AS builder
WORKDIR /app
COPY myflow-studio/package*.json ./myflow-studio/
RUN cd myflow-studio && npm ci
COPY myflow-studio/ ./myflow-studio/
RUN cd myflow-studio && npm run build

# Runtime stage: Python API server + dist
FROM python:3.12-slim
WORKDIR /app

# Instala dependencias mínimas
RUN pip install --no-cache-dir psutil

# Copia backend
COPY api/ ./api/
COPY MANIFIESTO.md ./MANIFIESTO.md

# Copia build de React
COPY --from=builder /app/dist ./dist

# Volumen para datos persistentes
VOLUME ["/app/data", "/app/uploads", "/app/jobs"]

EXPOSE 8774

ENV MYFLOW_BEAT_IA_URL=http://beat-ia:7071/generate-beat
ENV PYTHONUNBUFFERED=1

CMD ["python", "api/server.py", "--port", "8774", "--host", "0.0.0.0"]
