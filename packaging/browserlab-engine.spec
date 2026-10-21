# PyInstaller spec for the BrowserLab sidecar (onedir, arm64). Build via scripts/build_app.sh.
from pathlib import Path
from PyInstaller.utils.hooks import collect_all, collect_submodules

root = Path(SPECPATH).parent
datas = [(str(root / "src/browserlab/protocol_base.yaml"), "browserlab"), (str(root / "workloads"), "workloads")]
binaries, hidden = [], collect_submodules("browserbench") + collect_submodules("browserlab")
for pkg in ("selenium", "statsmodels", "reportlab", "openpyxl"):
    d, b, h = collect_all(pkg)
    datas += d; binaries += b; hidden += h

a = Analysis([str(root / "src/browserlab/engine_main.py")], pathex=[str(root / "src")], binaries=binaries, datas=datas,
             hiddenimports=hidden, excludes=["matplotlib", "tkinter", "IPython", "pytest", "notebook", "jupyter"])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="browserlab-engine", console=True)
coll = COLLECT(exe, a.binaries, a.datas, name="browserlab-engine")
