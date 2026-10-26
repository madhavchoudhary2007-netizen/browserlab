<#
Windows setup: Python environment, ffmpeg (optional), the local video workload.
Browsers: powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1
Run from the project folder:  powershell -ExecutionPolicy Bypass -File setup_windows.ps1
#>
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$installPython = "Install it with:  winget install Python.Python.3.12   (then open a new terminal)"
function Test-Python($exe, $exeArgs) {
  try { & $exe @exeArgs -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" 2>$null } catch { return $false }
  return ($LASTEXITCODE -eq 0)
}
# `py` is the launcher; `python` may be the Microsoft Store stub, which exits non-zero, so test each.
$pyExe = $null
foreach ($c in @(@("py", @("-3")), @("python", @()))) {
  if ((Get-Command $c[0] -ErrorAction SilentlyContinue) -and (Test-Python $c[0] $c[1])) { $pyExe = $c[0]; $pyArgs = $c[1]; break }
}
if (-not $pyExe) { Write-Error "Python 3.11 or newer was not found (the Microsoft Store 'python' shortcut does not count). $installPython" }

& $pyExe @pyArgs -m venv .venv
if ($LASTEXITCODE -ne 0) { Write-Error "Could not create the virtual environment (.venv)." }
$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
& $venvPython -m pip install --upgrade pip setuptools wheel
if ($LASTEXITCODE -ne 0) { Write-Error "pip could not update itself. Check your internet connection and rerun." }
& $venvPython -m pip install -e ".[dev]"
if ($LASTEXITCODE -ne 0) { Write-Error "Installing the Python packages failed (see the pip error above). Check your internet connection and rerun." }

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
