<#
Windows setup: Python environment, ffmpeg (optional), the local video workload.
Browsers: powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1
Run from the project folder:  powershell -ExecutionPolicy Bypass -File setup_windows.ps1
#>
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (Get-Command py -ErrorAction SilentlyContinue) { $pyExe = "py"; $pyArgs = @("-3") }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $pyExe = "python"; $pyArgs = @() }
else { Write-Error "Python 3.11 or newer is required. Install it with: winget install Python.Python.3.12" }
& $pyExe @pyArgs -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if ($LASTEXITCODE -ne 0) { Write-Error "Python 3.11 or newer is required." }

& $pyExe @pyArgs -m venv .venv
$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
& $venvPython -m pip install --upgrade pip setuptools wheel
& $venvPython -m pip install -e ".[dev]"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "ffmpeg is needed once to generate the video workload: winget install Gyan.FFmpeg (then open a new terminal)."
}
if (-not (Test-Path "workloads\assets\test_1080p.mp4")) {
  try { & $venvPython tools\generate_video.py } catch { Write-Warning "Video asset not generated yet: install ffmpeg and run python tools\generate_video.py" }
}
if (Get-Command Rscript -ErrorAction SilentlyContinue) { Rscript analysis\00_install_packages.R } else {
  Write-Host "R not found: collection works without it; install R before running the analysis scripts."
}

Write-Host ""
Write-Host "Setup complete. Next:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1"
Write-Host "  .venv\Scripts\Activate.ps1"
Write-Host "  browserbench doctor"
