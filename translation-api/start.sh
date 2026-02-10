#!/bin/bash
# Start TranslaChat Translation API
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source /home/naoto/venv/bin/activate
exec python3 "$SCRIPT_DIR/server.py"
