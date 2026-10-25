<#
Install the four browsers BrowserLab measures (Chrome, Brave, Firefox, LibreWolf) on Windows with winget.

  powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1
  powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File scripts\install_browsers.ps1 -Only firefox,librewolf

winget ships with current Windows 10/11 (App Installer). Packages come from the winget community repository and
install per machine; a UAC prompt may appear.
#>
param(
  [switch]$DryRun,
  [string[]]$Only = @("chrome", "brave", "firefox", "librewolf")
)
$ErrorActionPreference = "Stop"

$pf = $env:ProgramFiles
$pf86 = ${env:ProgramFiles(x86)}
$local = $env:LOCALAPPDATA
$browsers = @(
  @{ Key = "chrome";    Name = "Google Chrome"; Id = "Google.Chrome";        Paths = @("$pf\Google\Chrome\Application\chrome.exe", "$pf86\Google\Chrome\Application\chrome.exe", "$local\Google\Chrome\Application\chrome.exe") },
  @{ Key = "brave";     Name = "Brave";         Id = "Brave.Brave";          Paths = @("$pf\BraveSoftware\Brave-Browser\Application\brave.exe", "$local\BraveSoftware\Brave-Browser\Application\brave.exe") },
  @{ Key = "firefox";   Name = "Firefox";       Id = "Mozilla.Firefox";      Paths = @("$pf\Mozilla Firefox\firefox.exe", "$pf86\Mozilla Firefox\firefox.exe") },
  @{ Key = "librewolf"; Name = "LibreWolf";     Id = "LibreWolf.LibreWolf";  Paths = @("$pf\LibreWolf\librewolf.exe", "$local\LibreWolf\librewolf.exe") }
)

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Error "winget was not found. Install 'App Installer' from the Microsoft Store, or install the four browsers from their websites."
}

foreach ($b in $browsers) {
  if ($Only -notcontains $b.Key) { continue }
  $installed = $b.Paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($installed) {
    Write-Host "== $($b.Name) is already installed ($installed)"
    continue
  }
  Write-Host "== Installing $($b.Name)"
  $cmd = "winget install --id $($b.Id) --exact --silent --accept-package-agreements --accept-source-agreements"
  Write-Host "  > $cmd"
  if (-not $DryRun) {
    winget install --id $b.Id --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { Write-Warning "winget exited with code $LASTEXITCODE for $($b.Name)" }
  }
}
Write-Host ""
Write-Host "Done. Next: browserbench doctor"
