#!/usr/bin/env python3
"""
MyFlow STUDIO API Server
========================
Servidor ligero que sirve el STUDIO + endpoints API para integración.

Endpoints:
  GET  /                          → Sirve mano_morph_studio.html
  GET  /api/health                → Health check simple
  GET  /api/health/detailed       → CPU/RAM/disco + uptime
  GET  /api/info                  → Metadata del STUDIO
  GET  /api/presets               → Presets de coro integrados
  GET  /api/presets/user          → Presets guardados por el usuario
  POST /api/presets/save          → Guardar/actualizar un preset JSON
  POST /api/upload/audio          → Subir audio (WAV/WebM/etc, límite 50 MB)
  POST /api/upload/video          → Subir video (límite 50 MB)
  POST /api/convert/rvc           → Crear job de conversión RVC (placeholder)
  GET  /api/events                → SSE heartbeat para progreso en tiempo real

Uso:
  python api/server.py                  # puerto 8000
  python api/server.py --port 3000      # puerto personalizado
  python api/server.py --host 127.0.0.1 # host personalizado
"""

import argparse
import json
import logging
import os
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Nodo local de generación de beats IA
BEAT_IA_URL = os.environ.get("MYFLOW_BEAT_IA_URL", "http://localhost:7071/generate-beat")
DIST_DIR = ROOT / "dist"
LEGACY_HTML = ROOT / "mano_morph_studio.html"
INDEX_HTML = DIST_DIR / "index.html"

# ── Directorios de trabajo ──────────────────────────────
DATA_DIR = ROOT / "data"
UPLOADS_DIR = ROOT / "uploads"
AUDIO_DIR = UPLOADS_DIR / "audio"
VIDEO_DIR = UPLOADS_DIR / "video"
JOBS_DIR = ROOT / "jobs"
PRESETS_FILE = DATA_DIR / "presets.json"

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
START_TIME = time.time()

# ── Beat IA jobs ──────────────────────────────────────────
beat_jobs = {}


def _run_beat_job(job_id, payload):
    """Llama al generador de beats en segundo plano y guarda resultado."""
    beat_jobs[job_id]["status"] = "running"
    try:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            BEAT_IA_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=600) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            beat_jobs[job_id].update({
                "status": "done",
                "result": result,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as e:
        beat_jobs[job_id].update({
            "status": "error",
            "error": str(e),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.exception("Beat IA job %s falló", job_id)

# ── Logger ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("myflow-api")


# ── Utilidades ────────────────────────────────────────────

def ensure_dirs():
    """Crea los directorios de datos si no existen."""
    for d in (DATA_DIR, AUDIO_DIR, VIDEO_DIR, JOBS_DIR):
        d.mkdir(parents=True, exist_ok=True)


def load_user_presets():
    if PRESETS_FILE.exists():
        try:
            with PRESETS_FILE.open("r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            logger.error("Error leyendo presets.json: %s", e)
    return {}


def save_user_presets(presets):
    PRESETS_FILE.write_text(json.dumps(presets, ensure_ascii=False, indent=2), encoding="utf-8")


def _human_time(seconds):
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h {m}m {s}s"


def _parse_mime_from_header(header_text):
    """Extrae el MIME type de una cabecera Content-Type sin depender de cgi."""
    match = None
    for line in header_text.splitlines():
        if line.strip().lower().startswith("content-type:"):
            match = line.split(":", 1)[1].strip().split(";")[0].strip()
            break
    return match or "application/octet-stream"


class _UploadHelpersMixin:
    """Mix-in para reutilizar el parser multipart mínimo."""

    @staticmethod
    def _extract_multipart_file(body, boundary, name_hints=("file",)):
        parts = body.split(b"--" + boundary)
        for part in parts[1:]:
            if b"\r\n\r\n" not in part:
                continue
            header, data = part.split(b"\r\n\r\n", 1)
            data = data.rsplit(b"\r\n", 1)[0]
            header_text = header.decode("utf-8", errors="ignore")
            if 'filename="' not in header_text:
                continue
            filename = header_text.split('filename="')[-1].split('"')[0]
            lower_header = header_text.lower()
            for hint in name_hints:
                if f'name="{hint}"' in lower_header:
                    return data, filename, header_text
            # fallback: devolver el primer archivo con filename
            return data, filename, header_text
        return None, None, ""


# ── Datos de configuración ──────────────────────────────

PRESETS = {
    "duo":     {"name": "Dueto",       "voices": 2, "style": "Tú + 5ª femenina"},
    "coro":    {"name": "Coro 3",      "voices": 3, "style": "Tú + 3ª fem + 5ª masc"},
    "greg":    {"name": "Gregoriano",  "voices": 3, "style": "Dórica, 5ªs, delays largos"},
    "gospel":  {"name": "Gospel",      "voices": 3, "style": "Penta mayor, 3ª+5ª tight"},
}

SCALES = {
    "mayor":       [0, 2, 4, 5, 7, 9, 11],
    "menor":       [0, 2, 3, 5, 7, 8, 10],
    "pentaMayor":  [0, 2, 4, 7, 9],
    "pentaMenor":  [0, 3, 5, 7, 10],
    "dorica":      [0, 2, 3, 5, 7, 9, 10],
    "mixolidia":   [0, 2, 4, 5, 7, 9, 10],
    "cromatica":   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

INTERVALS = {
    "-8va": -12, "-5J": -7, "-3M": -4, "-3m": -3,
    "+3m": 3, "+3M": 4, "+4J": 5, "+5J": 7, "+6M": 9, "+8va": 12,
}

INFO = {
    "name": "MyFlow STUDIO",
    "version": "2.0.0",
    "description": "Armonizador vocal con control gestual y mini-DAW",
    "author": "ArT-AtR",
    "org": "IArtLabs",
    "repo": "https://github.com/ART449/myflow-studio-morph",
    "stack": "HTML5 + MediaPipe Hands + Web Audio API",
    "single_file": True,
    "voices": 3,
    "scales": list(SCALES.keys()),
    "intervals": list(INTERVALS.keys()),
    "presets": list(PRESETS.keys()),
    "upload_limit_mb": MAX_UPLOAD_BYTES // (1024 * 1024),
}


class APIHandler(SimpleHTTPRequestHandler, _UploadHelpersMixin):
    """Sirve el build React + endpoints JSON + subida de archivos + SSE."""

    def __init__(self, *args, **kwargs):
        # Prefer dist/ for static files; fall back to root for uploads/legacy
        directory = str(DIST_DIR) if DIST_DIR.exists() else str(ROOT)
        super().__init__(*args, directory=directory, **kwargs)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, X-Requested-With")

    def _json(self, data, code=200, extra_headers=None):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._send_cors_headers()
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def _text(self, content, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(content.encode())

    def _error(self, message, code=400):
        logger.warning("Error %s: %s", code, message)
        self._json({"success": False, "error": message}, code)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]

        try:
            if path in ("/", "/index.html"):
                self._serve_html()
            elif path.startswith("/assets/") and DIST_DIR.exists():
                super().do_GET()
                return
            elif path.startswith("/uploads/"):
                super().do_GET()
                return
            elif path == "/api/health":
                self._json({"status": "ok", "service": "MyFlow STUDIO API"})
            elif path == "/api/health/detailed":
                self._health_detailed()
            elif path == "/api/info":
                self._json(INFO)
            elif path == "/api/presets":
                self._json(PRESETS)
            elif path == "/api/presets/user":
                self._json(load_user_presets())
            elif path == "/api/scales":
                self._json(SCALES)
            elif path == "/api/intervals":
                self._json(INTERVALS)
            elif path == "/api/events":
                self._sse_heartbeat()
            elif path.startswith("/api/ai/beat-status/"):
                job_id = path.split("/")[-1]
                self._beat_status(job_id)
            elif path == "/api/manifesto":
                manifesto_path = ROOT / "MANIFIESTO.md"
                if manifesto_path.exists():
                    self._text(manifesto_path.read_text())
                else:
                    self._error("manifesto not found", 404)
            else:
                super().do_GET()
        except Exception as e:
            logger.exception("Error en GET %s", path)
            self._error(str(e), 500)

    def do_POST(self):
        path = self.path.split("?")[0]
        logger.info("POST %s", path)

        try:
            if path == "/api/presets/save":
                self._save_preset()
            elif path == "/api/upload/audio":
                self._upload_file(AUDIO_DIR)
            elif path == "/api/upload/video":
                self._upload_file(VIDEO_DIR)
            elif path == "/api/convert/rvc":
                self._convert_rvc_placeholder()
            elif path == "/api/ai/generate-beat":
                self._generate_beat()
            else:
                self._error("not found", 404)
        except Exception as e:
            logger.exception("Error en POST %s", path)
            self._error(str(e), 500)

    def _serve_html(self):
        html_file = INDEX_HTML if DIST_DIR.exists() and INDEX_HTML.exists() else LEGACY_HTML
        if html_file.exists():
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(html_file.read_bytes())
        else:
            self.send_error(404, "STUDIO HTML not found")

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return b""
        if length > MAX_UPLOAD_BYTES:
            raise ValueError(f"Payload demasiado grande. Máximo {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
        return self.rfile.read(length)

    def _save_preset(self):
        body = self._read_body()
        if not body:
            return self._error("body vacío")
        try:
            preset = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return self._error("JSON inválido")

        preset_id = preset.get("id")
        if not preset_id:
            return self._error("'id' es requerido")

        presets = load_user_presets()
        preset["updated_at"] = datetime.now(timezone.utc).isoformat()
        presets[preset_id] = preset
        try:
            save_user_presets(presets)
        except OSError as e:
            return self._error(f"No se pudo guardar el preset: {e}", 500)

        logger.info("Preset guardado: %s", preset_id)
        self._json({"success": True, "id": preset_id, "preset": preset})

    def _upload_file(self, dest_dir):
        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            return self._error("Se espera multipart/form-data con campo 'file'", 415)

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return self._error("body vacío")
        if length > MAX_UPLOAD_BYTES:
            return self._error(f"Archivo demasiado grande. Límite {MAX_UPLOAD_BYTES // (1024 * 1024)} MB", 413)

        boundary = content_type.split("boundary=")[-1].encode()
        body = self.rfile.read(length)

        file_part, filename, header_text = self._extract_multipart_file(body, boundary, name_hints=("file",))
        if not file_part or not filename:
            return self._error("No se encontró campo 'file' en el formulario", 400)

        # Seguridad básica de nombres
        safe_name = Path(filename).name
        if not safe_name or safe_name in (".", ".."):
            return self._error("nombre de archivo inválido", 400)
        ext = Path(safe_name).suffix
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
        final_name = f"{timestamp}{ext}" if ext else timestamp
        dest_path = dest_dir / final_name

        try:
            dest_path.write_bytes(file_part)
        except OSError as e:
            return self._error(f"No se pudo guardar el archivo: {e}", 500)

        file_mime = _parse_mime_from_header(header_text)
        rel_path = f"/uploads/{dest_dir.name}/{final_name}"
        logger.info("Archivo subido: %s (%s bytes, %s)", rel_path, len(file_part), file_mime)
        self._json({
            "success": True,
            "filename": final_name,
            "original_name": safe_name,
            "mime": file_mime,
            "size": len(file_part),
            "url": rel_path,
            "path": str(dest_path),
        })

    def _convert_rvc_placeholder(self):
        content_type = self.headers.get("Content-Type", "")
        input_path = None
        if content_type.startswith("multipart/form-data"):
            length = int(self.headers.get("Content-Length", 0))
            if length > MAX_UPLOAD_BYTES:
                return self._error(f"Audio demasiado grande. Límite {MAX_UPLOAD_BYTES // (1024 * 1024)} MB", 413)
            boundary = content_type.split("boundary=")[-1].encode()
            body = self.rfile.read(length)
            file_part, filename, _ = self._extract_multipart_file(body, boundary, name_hints=("audio", "file"))
            if file_part:
                ext = Path(filename).suffix if filename else ".wav"
                if not ext:
                    ext = ".wav"
                timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
                saved_name = f"rvc_input_{timestamp}{ext}"
                input_path = AUDIO_DIR / saved_name
                input_path.write_bytes(file_part)

        job_id = f"rvc_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')}"
        job_path = JOBS_DIR / f"{job_id}.json"
        job = {
            "job_id": job_id,
            "status": "queued",
            "type": "rvc",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "input_path": str(input_path) if input_path else None,
            "output_path": None,
            "message": "RVC conversion queued (placeholder).",
        }
        try:
            job_path.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError as e:
            return self._error(f"No se pudo crear el job: {e}", 500)

        logger.info("RVC job creado: %s", job_id)
        self._json({"success": True, "job_id": job_id, "status": "queued", "message": job["message"]})

    def _generate_beat(self):
        body = self._read_body()
        if not body:
            return self._error("body vacío")
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return self._error("JSON inválido")

        job_id = str(uuid.uuid4())
        beat_jobs[job_id] = {
            "status": "queued",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }

        thread = threading.Thread(target=_run_beat_job, args=(job_id, payload), daemon=True)
        thread.start()

        logger.info("Beat IA job creado: %s", job_id)
        self._json({
            "success": True,
            "job_id": job_id,
            "status": "queued",
            "check_url": f"/api/ai/beat-status/{job_id}",
            "message": "Generando beat, consulta el estado en check_url.",
        })

    def _beat_status(self, job_id):
        job = beat_jobs.get(job_id)
        if not job:
            return self._error("job no encontrado", 404)
        self._json({
            "job_id": job_id,
            "status": job.get("status"),
            "created_at": job.get("created_at"),
            "finished_at": job.get("finished_at"),
            "result": job.get("result"),
            "error": job.get("error"),
        })

    def _health_detailed(self):
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=0.1)
            mem = psutil.virtual_memory()._asdict()
            disk = psutil.disk_usage(str(ROOT))._asdict()
        except ImportError:
            cpu = None
            mem = None
            disk = None

        uptime = time.time() - START_TIME
        self._json({
            "status": "ok",
            "service": "MyFlow STUDIO API",
            "uptime_seconds": round(uptime, 2),
            "uptime_human": _human_time(uptime),
            "cpu_percent": cpu,
            "memory": mem,
            "disk": disk,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def _sse_heartbeat(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self._send_cors_headers()
        self.end_headers()

        try:
            count = 0
            while True:
                count += 1
                event = f"id: {count}\nevent: heartbeat\ndata: {json.dumps({'type': 'heartbeat', 'count': count, 'time': datetime.now(timezone.utc).isoformat()})}\n\n"
                self.wfile.write(event.encode())
                self.wfile.flush()
                time.sleep(3)
        except (BrokenPipeError, ConnectionResetError, OSError):
            logger.info("Cliente SSE desconectado")

    def log_message(self, format, *args):
        logger.info("%s - %s", self.address_string(), format % args)


def main():
    parser = argparse.ArgumentParser(description="MyFlow STUDIO API Server")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    ensure_dirs()

    if not (INDEX_HTML.exists() or LEGACY_HTML.exists()):
        print(f"❌ No encontré {INDEX_HTML} ni {LEGACY_HTML}")
        print("   Corre este script desde la raíz del repo myflow-studio/")
        sys.exit(1)

    server = HTTPServer((args.host, args.port), APIHandler)
    print(f"🐝 MyFlow STUDIO API")
    print(f"   Local:  http://localhost:{args.port}")
    print(f"   Red:    http://{args.host}:{args.port}")
    print(f"   API:    http://localhost:{args.port}/api/info")
    print(f"   Presets: http://localhost:{args.port}/api/presets")
    print(f"   Beat IA: http://localhost:{args.port}/api/ai/generate-beat")
    print(f"   SSE:    http://localhost:{args.port}/api/events")
    print(f"   Ctrl+C para detener")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Cerrado.")
        server.server_close()


if __name__ == "__main__":
    main()
