<#
Install the BrowserLab desktop app on Windows from the latest GitHub release, from a terminal.
Files downloaded this way carry no "downloaded from the internet" mark, so Windows shows no SmartScreen warning.

  irm https://raw.githubusercontent.com/madhavchoudhary2007-netizen/browserlab/main/install.ps1 | iex

Options (save the script and run it with them):
  -Url <installer url>   install this installer instead of the latest release (for mirrors and tests)
  -WithBrowsers          also install Chrome, Brave, Firefox and LibreWolf with winget (what experiments measure)
  -DryRun                say what would happen and change nothing
#>
param(
  [string]$Url,
  [string]$Repo = "madhavchoudhary2007-netizen/browserlab",
  [switch]$WithBrowsers,
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$osArch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
$label = if ($osArch -eq "Arm64") { "windows-arm64" } elseif ($osArch -eq "X64") { "windows-x64" } else { throw "Unsupported processor: $osArch" }

if (-not $Url) {
  Write-Host "Looking up the latest release of $Repo ..."
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "browserlab-installer" }
  $asset = $release.assets | Where-Object { $_.name -like "*-$label.exe" } | Select-Object -First 1
  if (-not $asset) { throw "The latest release ($($release.tag_name)) has no installer for $label." }
  $Url = $asset.browser_download_url
}
$file = Join-Path $env:TEMP ([IO.Path]::GetFileName(([Uri]$Url).AbsolutePath))
Write-Host "Installer for $label : $Url"
if ($DryRun) { Write-Host "Dry run: would download to $file, install it silently for the current user, then optionally install browsers."; return }

Invoke-WebRequest -Uri $Url -OutFile $file -UseBasicParsing
Unblock-File -Path $file   # no-op for this download; keeps a mirror or proxy from re-adding the internet mark
Write-Host "Installing (silent, current user, no administrator needed) ..."
$p = Start-Process -FilePath $file -ArgumentList "/S" -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "The installer exited with code $($p.ExitCode)." }
Remove-Item $file -ErrorAction SilentlyContinue

$exe = @("$env:LOCALAPPDATA\BrowserLab\browserlab.exe", "$env:LOCALAPPDATA\Programs\BrowserLab\browserlab.exe", "$env:ProgramFiles\BrowserLab\browserlab.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { throw "The installer finished but browserlab.exe was not found where expected." }
Write-Host "Installed: $exe"

if ($WithBrowsers) {
  $script = Join-Path $env:TEMP "install_browsers.ps1"
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$Repo/main/scripts/install_browsers.ps1" -OutFile $script -UseBasicParsing
  & powershell -NoProfile -ExecutionPolicy Bypass -File $script
}
Write-Host "Done. Start BrowserLab from the Start menu, or run: `"$exe`""
if (-not $WithBrowsers) { Write-Host "Experiments need Chrome, Brave, Firefox and LibreWolf installed. To install them too, rerun with -WithBrowsers." }
