"""Pass 4 review pack at real size: copies every capture unmodified (no contact sheets, no scaling) and writes MANIFEST.txt.
usage: assemble_full.py <shots_dir> <out_dir>   (shots_dir has light/, dark/ and pen/)"""
import sys, os, glob, shutil
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
SCREENS = ["run-idle", "run-ready", "run-running", "library", "library-no-match", "compare-empty", "compare", "results-report", "results-analysis", "settings", "palette"]
SIZES = ["960x640", "1280x800", "1920x1080", "2560x1440"]
lines = ["# Review pack, real size. Every image is an unmodified screenshot at 100 % (device pixel ratio 1). Open every file under REQUIRED.", "", "## REQUIRED: screens (screen, theme, window size)"]
req = []
for theme in ("light", "dark"):
    os.makedirs(f"{out}/screens/{theme}", exist_ok=True)
    for s in SCREENS:
        for z in SIZES:
            d = f"screens/{theme}/{s}-{z}.png"; shutil.copy(f"{src}/{theme}/{s}-{z}-1x.png", f"{out}/{d}")
            w, h = Image.open(f"{out}/{d}").size; req.append(f"{d}  ({w}x{h}px)")
lines += req
MOTION = [("live-light", "live-light-1280x800"), ("live-dark", "live-dark-1280x800"), ("live-light-throttled-6x", "live-light-x6-1280x800"), ("live-dark-throttled-6x", "live-dark-x6-1280x800"),
          ("replay-light", "replay-light"), ("replay-dark", "replay-dark"), ("replay-light-throttled-6x", "replay-light-x6"), ("replay-dark-throttled-6x", "replay-dark-x6")]
lines += ["", "## REQUIRED: motion frames (12 evenly spaced frames per sweep; open frames 01, 04, 08 and 12 of each sweep; the rest are supplied for reference)"]
extra = []
for name, prefix in MOTION:
    fs = sorted(glob.glob(f"{src}/pen/{prefix}-*.png"))[:12]
    if len(fs) < 12: print("missing frames for", name, len(fs)); continue
    os.makedirs(f"{out}/motion/{name}", exist_ok=True)
    for i, f in enumerate(fs, 1):
        d = f"motion/{name}/frame-{i:02d}.png"; shutil.copy(f, f"{out}/{d}")
        (lines if i in (1, 4, 8, 12) else extra).append(d)
lines += ["", "## Reference: remaining motion frames"] + extra
open(f"{out}/MANIFEST.txt", "w").write("\n".join(lines) + "\n")
print(len(req), "screens;", len(lines), "manifest lines ->", out)
