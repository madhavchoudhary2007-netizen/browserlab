#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/workloads/assets/test_1080p.mp4"
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install with: brew install ffmpeg" >&2
  exit 1
fi
mkdir -p "$(dirname "$OUT")"
# 20 s deterministic 1920x1080/30fps H.264 test pattern, no audio.
ffmpeg -hide_banner -loglevel warning -y \
  -f lavfi -i "testsrc2=size=1920x1080:rate=30:duration=20" \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "$OUT"
echo "Created $OUT"
