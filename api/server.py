#!/usr/bin/env python3
"""
MyFlow STUDIO API Server
========================
Servidor ligero que sirve el STUDIO + endpoints API para integración.

Endpoints:
  GET  /                    → Sirve mano_morph_studio.html
  GET  /api/health          → Health check
  GET  /api/info            → Metadata del STUDIO
  GET  /api/presets         → Lista de presets de coro disponibles
  GET  /api/scales          → Lista de escalas soportadas
  GET  /api/intervals       → Lista de intervalos soportados

Uso:
  python3 api/server.py                  # puerto 8000
  python3 api/server.py --port 3000      # puerto personalizado
  python3 api/server.py --host 0.0.0.0   # accesible desde red local
"""

import argparse
import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_FILE = ROOT / "mano_morph_studio.html"

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
    "version": "1.0.0",
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
}


class APIHandler(SimpleHTTPRequestHandler):
    """Sirve el HTML estático + endpoints JSON."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/" or path == "/index.html":
            self._serve_html()
        elif path == "/api/health":
            self._json({"status": "ok", "service": "MyFlow STUDIO API"})
        elif path == "/api/info":
            self._json(INFO)
        elif path == "/api/presets":
            self._json(PRESETS)
        elif path == "/api/scales":
            self._json(SCALES)
        elif path == "/api/intervals":
            self._json(INTERVALS)
        elif path == "/api/manifesto":
            manifesto_path = ROOT / "MANIFIESTO.md"
            if manifesto_path.exists():
                self._text(manifesto_path.read_text())
            else:
                self._json({"error": "manifesto not found"}, 404)
        else:
            super().do_GET()

    def _serve_html(self):
        if HTML_FILE.exists():
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(HTML_FILE.read_bytes())
        else:
            self.send_error(404, "STUDIO HTML not found")

    def _json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def _text(self, content, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(content.encode())

    def log_message(self, format, *args):
        print(f"[api] {args[0]}")


def main():
    parser = argparse.ArgumentParser(description="MyFlow STUDIO API Server")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    if not HTML_FILE.exists():
        print(f"❌ No encontré {HTML_FILE}")
        print("   Corre este script desde la raíz del repo myflow-studio/")
        sys.exit(1)

    server = HTTPServer((args.host, args.port), APIHandler)
    print(f"🐝 MyFlow STUDIO API")
    print(f"   Local:  http://localhost:{args.port}")
    print(f"   Red:    http://0.0.0.0:{args.port}")
    print(f"   API:    http://localhost:{args.port}/api/info")
    print(f"   Presets: http://localhost:{args.port}/api/presets")
    print(f"   Ctrl+C para detener")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Cerrado.")
        server.server_close()


if __name__ == "__main__":
    main()
