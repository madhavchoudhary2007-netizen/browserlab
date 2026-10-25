"""Create the deterministic 20 s 1080p30 H.264 test video (no audio). Works on macOS, Linux and Windows; needs ffmpeg on PATH."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "workloads" / "assets" / "test_1080p.mp4"
HINTS = {"darwin": "brew install ffmpeg", "win32": "winget install Gyan.FFmpeg", "linux": "sudo apt install ffmpeg   (or: sudo dnf install ffmpeg-free)"}


def main() -> int:
    if not shutil.which("ffmpeg"):
        print(f"ffmpeg not found. Install it with: {HINTS.get(sys.platform, HINTS['linux'])}", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "warning", "-y", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=20",
         "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT)],
        check=True)
    print(f"Created {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
