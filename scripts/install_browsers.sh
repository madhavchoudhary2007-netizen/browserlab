#!/usr/bin/env bash
# Install the four browsers BrowserLab measures (Chrome, Brave, Firefox, LibreWolf) on macOS or Linux.
# Windows: scripts/install_browsers.ps1
#
#   bash scripts/install_browsers.sh                 install whatever is missing
#   bash scripts/install_browsers.sh --dry-run       print every command, change nothing
#   bash scripts/install_browsers.sh --only firefox,librewolf
#
# Everything comes from each vendor's own package source (Homebrew casks on macOS; the vendor apt/dnf repositories
# or packages on Linux). Firefox on Linux is installed from Mozilla's repository, not the Ubuntu snap, because the snap
# build cannot be driven reliably by geckodriver. Flatpak and snap builds are not supported for measurements.
set -euo pipefail

DRY=0
ONLY="chrome,brave,firefox,librewolf"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --only) ONLY="${2:?--only needs a comma-separated list}"; shift ;;
    -h|--help) sed -n 2,14p "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

wanted() { [[ ",$ONLY," == *",$1,"* ]]; }
say() { printf '\n== %s\n' "$*"; }
run() {
  printf '  $ %s\n' "$*"
  if [[ $DRY -eq 0 ]]; then "$@"; fi
}
SUDO=""
if [[ $(id -u) -ne 0 ]]; then SUDO="sudo"; fi
have() { command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"
ARCH="$(uname -m)"

install_macos() {
  if ! have brew; then
    echo "Homebrew is required on macOS: https://brew.sh" >&2
    exit 1
  fi
  # (macOS ships bash 3.2, which has no associative arrays)
  for b in chrome brave firefox librewolf; do
    wanted "$b" || continue
    case "$b" in
      chrome)    cask=google-chrome; app="Google Chrome" ;;
      brave)     cask=brave-browser; app="Brave Browser" ;;
      firefox)   cask=firefox;       app="Firefox" ;;
      librewolf) cask=librewolf;     app="LibreWolf" ;;
    esac
    if [[ -d "${APPS_DIR:-/Applications}/$app.app" ]]; then
      say "$app is already installed"
      continue
    fi
    say "Installing $app"
    run brew install --cask "$cask"
    if [[ $b == librewolf ]]; then
      # LibreWolf is not notarised; macOS Gatekeeper refuses to open it until the quarantine flag is cleared.
      run xattr -cr /Applications/LibreWolf.app
    fi
  done
}

install_apt() {
  local codename_ok=1
  run $SUDO apt-get update
  run $SUDO apt-get install -y ca-certificates curl gnupg wget
  if wanted chrome && ! have google-chrome-stable; then
    say "Installing Google Chrome"
    if [[ $ARCH != x86_64 ]]; then echo "  Google publishes Chrome for Linux x86_64 only; skipping on $ARCH. Use Chromium-based Brave instead." >&2
    else
      local deb; deb="$(mktemp -d)/google-chrome.deb"
      run curl -fsSL -o "$deb" https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
      run $SUDO apt-get install -y "$deb"
    fi
  fi
  if wanted brave && ! have brave-browser; then
    say "Installing Brave"
    run $SUDO curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
    if [[ $DRY -eq 0 ]]; then
      echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" | $SUDO tee /etc/apt/sources.list.d/brave-browser-release.list >/dev/null
    else
      echo "  \$ (write /etc/apt/sources.list.d/brave-browser-release.list pointing at brave-browser-apt-release.s3.brave.com)"
    fi
    run $SUDO apt-get update
    run $SUDO apt-get install -y brave-browser
  fi
  if wanted firefox && { ! have firefox || [[ "$(command -v firefox)" == /snap/* ]]; }; then
    say "Installing Firefox from Mozilla's apt repository (not the snap)"
    run $SUDO install -d -m 0755 /etc/apt/keyrings
    if [[ $DRY -eq 0 ]]; then
      wget -q https://packages.mozilla.org/apt/repo-signing-key.gpg -O- | $SUDO tee /etc/apt/keyrings/packages.mozilla.org.asc >/dev/null
      echo "deb [signed-by=/etc/apt/keyrings/packages.mozilla.org.asc] https://packages.mozilla.org/apt mozilla main" | $SUDO tee /etc/apt/sources.list.d/mozilla.list >/dev/null
      printf 'Package: *\nPin: origin packages.mozilla.org\nPin-Priority: 1000\n' | $SUDO tee /etc/apt/preferences.d/mozilla >/dev/null
    else
      echo "  \$ (add packages.mozilla.org/apt and pin it above the distribution's snap package)"
    fi
    run $SUDO apt-get update
    run $SUDO apt-get install -y firefox
  fi
  if wanted librewolf && ! have librewolf; then
    say "Installing LibreWolf (official extrepo source)"
    run $SUDO apt-get install -y extrepo
    run $SUDO extrepo enable librewolf
    run $SUDO apt-get update
    run $SUDO apt-get install -y librewolf
  fi
  : "$codename_ok"
}

install_dnf() {
  if wanted chrome && ! have google-chrome-stable; then
    say "Installing Google Chrome"
    if [[ $ARCH != x86_64 ]]; then echo "  Google publishes Chrome for Linux x86_64 only; skipping on $ARCH." >&2
    else run $SUDO dnf install -y https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm; fi
  fi
  if wanted brave && ! have brave-browser; then
    say "Installing Brave"
    run $SUDO dnf install -y dnf-plugins-core
    if [[ $DRY -eq 1 ]]; then echo "  \$ sudo dnf config-manager addrepo --from-repofile=https://brave-browser-rpm-release.s3.brave.com/brave-browser.repo"
    elif $SUDO dnf config-manager addrepo --help >/dev/null 2>&1; then
      run $SUDO dnf config-manager addrepo --from-repofile=https://brave-browser-rpm-release.s3.brave.com/brave-browser.repo
    else
      run $SUDO dnf config-manager --add-repo https://brave-browser-rpm-release.s3.brave.com/brave-browser.repo
    fi
    run $SUDO dnf install -y brave-browser
  fi
  if wanted firefox && ! have firefox; then
    say "Installing Firefox"
    run $SUDO dnf install -y firefox
  fi
  if wanted librewolf && ! have librewolf; then
    say "Installing LibreWolf"
    run $SUDO dnf install -y dnf-plugins-core
    if [[ $DRY -eq 1 ]]; then echo "  \$ sudo dnf config-manager addrepo --from-repofile=https://repo.librewolf.net/librewolf.repo"
    elif $SUDO dnf config-manager addrepo --help >/dev/null 2>&1; then
      run $SUDO dnf config-manager addrepo --from-repofile=https://repo.librewolf.net/librewolf.repo
    else
      run $SUDO dnf config-manager --add-repo https://repo.librewolf.net/librewolf.repo
    fi
    run $SUDO dnf install -y librewolf
  fi
}

install_pacman() {
  if wanted firefox && ! have firefox; then say "Installing Firefox"; run $SUDO pacman -S --needed --noconfirm firefox; fi
  local aur=()
  wanted chrome && ! have google-chrome-stable && aur+=(google-chrome)
  wanted brave && ! have brave && aur+=(brave-bin)
  wanted librewolf && ! have librewolf && aur+=(librewolf-bin)
  if [[ ${#aur[@]} -gt 0 ]]; then
    say "These come from the Arch User Repository: ${aur[*]}"
    if have yay; then run yay -S --needed "${aur[@]}"
    elif have paru; then run paru -S --needed "${aur[@]}"
    else echo "  Install an AUR helper (yay or paru) and run: yay -S ${aur[*]}" >&2; fi
  fi
}

case "$OS" in
  Darwin) say "macOS detected"; install_macos ;;
  Linux)
    say "Linux detected ($ARCH)"
    if have apt-get; then install_apt
    elif have dnf; then install_dnf
    elif have pacman; then install_pacman
    else
      echo "No supported package manager (apt, dnf, pacman) found. Install Chrome, Brave, Firefox and LibreWolf from their websites," >&2
      echo "then point config.yaml at the binaries." >&2
      exit 1
    fi ;;
  *) echo "Unsupported system: $OS. On Windows run scripts/install_browsers.ps1." >&2; exit 1 ;;
esac

say "Done. Next: browserbench doctor"
