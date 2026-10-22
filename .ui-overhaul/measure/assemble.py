"""Builds the review manifest for a cycle: one contact sheet per screen and theme (4 window sizes in one image) and motion strips (12 frames each).
usage: assemble.py <shots_dir> <out_dir>   (shots_dir has light/, dark/ and pen/)"""
import sys, os, glob
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
SCREENS = ["run-idle", "run-ready", "run-running", "library", "library-no-match", "compare", "results-report", "results-analysis", "settings", "palette"]
SIZES = ["900x600", "1280x800", "1920x1080", "2560x1440"]
CELL = 1200
def label(img, text):
    # header band above the image so the label never covers content
    out = Image.new("RGB", (img.width, img.height + 22), (0, 0, 0)); out.paste(img, (0, 22)); ImageDraw.Draw(out).text((6, 5), text, fill=(255, 255, 255)); return out
manifest = []
for theme in ("light", "dark"):
    for s in SCREENS:
        ims = []
        for z in SIZES:
            f = f"{src}/{theme}/{s}-{z}-1x.png"
            im = Image.open(f).convert("RGB"); r = CELL / im.width; im = im.resize((CELL, round(im.height * r)), Image.LANCZOS); ims.append(label(im, f"{s} {z} {theme}"))
        row1 = max(ims[0].height, ims[1].height); row2 = max(ims[2].height, ims[3].height)
        sheet = Image.new("RGB", (CELL * 2 + 10, row1 + row2 + 10), (128, 128, 128))
        sheet.paste(ims[0], (0, 0)); sheet.paste(ims[1], (CELL + 10, 0)); sheet.paste(ims[2], (0, row1 + 10)); sheet.paste(ims[3], (CELL + 10, row1 + 10))
        p = f"{out}/screen-{theme}-{s}.png"; sheet.save(p); manifest.append(p)
def strip(prefix, name, w=700):
    fs = sorted(glob.glob(f"{src}/pen/{prefix}-*.png"))[:12]
    if len(fs) < 12: print("missing frames for", name, len(fs)); return
    ims = []
    for i, f in enumerate(fs):
        im = Image.open(f).convert("RGB"); r = w / im.width; im = im.resize((w, round(im.height * r)), Image.LANCZOS); ims.append(label(im, f"{name} frame {i + 1}/12"))
    h = ims[0].height; sheet = Image.new("RGB", (w * 4 + 30, h * 3 + 20), (128, 128, 128))
    for i, im in enumerate(ims): sheet.paste(im, ((i % 4) * (w + 10), (i // 4) * (h + 10)))
    p = f"{out}/motion-{name}.png"; sheet.save(p); manifest.append(p)
for t in ("light", "dark"):
    strip(f"live-{t}-1280x800", f"live-{t}"); strip(f"live-{t}-x6-1280x800", f"live-{t}-throttled-6x"); strip(f"replay-{t}", f"replay-{t}")
strip("replay-dark-x6", "replay-dark-throttled-6x")
open(f"{out}/MANIFEST.txt", "w").write("\n".join(os.path.basename(m) for m in manifest) + "\n")
print(len(manifest), "manifest files ->", out)
