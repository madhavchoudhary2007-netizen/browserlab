#!/usr/bin/env bash
# Install the BrowserLab desktop app on macOS (Apple Silicon) or Linux from the latest GitHub release, from a terminal.
# Files fetched with curl carry no quarantine mark, so macOS shows no Gatekeeper warning.
#
#   curl -fsSL https://raw.githubusercontent.com/madhavchoudhary2007-netizen/browserlab/main/install.sh | bash
#
# Options (after `bash -s --` when piping): --url <installer url>   --with-browsers   --dry-run
set -euo pipefail

REPO="madhavchoudhary2007-netizen/browserlab"
URL=""; WITH_BROWSERS=0; DRY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --with-browsers) WITH_BROWSERS=1; shift ;;
    --dry-run) DRY=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)  LABEL="macos-arm64";  EXT="dmg" ;;
  Darwin-x86_64) echo "No Intel Mac build is published; use Apple Silicon or build from source (see the README)." >&2; exit 1 ;;
  Linux-x86_64)  LABEL="linux-x64" ;;
  Linux-aarch64|Linux-arm64) LABEL="linux-arm64" ;;
  *) echo "Unsupported system: $(uname -s) $(uname -m)" >&2; exit 1 ;;
esac
if [[ "$LABEL" == linux-* ]]; then
  if command -v dpkg >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then EXT="deb"; else EXT="AppImage"; fi
fi

if [[ -z "$URL" ]]; then
  echo "Looking up the latest release of $REPO ..."
  JSON="$(curl -fsSL -H 'User-Agent: browserlab-installer' "https://api.github.com/repos/$REPO/releases/latest")"
  URL="$(printf '%s' "$JSON" | grep -o '"browser_download_url": *"[^"]*"' | sed 's/.*"\(http[^"]*\)"/\1/' | grep -- "-$LABEL\.$EXT\$" | head -1 || true)"
  [[ -n "$URL" ]] || { echo "The latest release has no .$EXT installer for $LABEL." >&2; exit 1; }
fi
FILE="${TMPDIR:-/tmp}/$(basename "${URL%%\?*}")"
echo "Installer for $LABEL: $URL"
if [[ $DRY -eq 1 ]]; then echo "Dry run: would download to $FILE and install it ($EXT)."; exit 0; fi

curl -fL --progress-bar -o "$FILE" "$URL"
case "$FILE" in
  *.deb)
    sudo apt-get install -y "$FILE"
    echo "Installed. Start BrowserLab from your applications menu or run: browser-lab" ;;
  *.AppImage)
    mkdir -p "$HOME/.local/bin"; install -m 755 "$FILE" "$HOME/.local/bin/BrowserLab.AppImage"
    echo "Installed: $HOME/.local/bin/BrowserLab.AppImage" ;;
  *.dmg)
    MNT="$(mktemp -d)"
    hdiutil attach -nobrowse -quiet -mountpoint "$MNT" "$FILE"
    APP="$(find "$MNT" -maxdepth 1 -name '*.app' | head -1)"
    DEST="/Applications"; [[ -w "$DEST" ]] || { DEST="$HOME/Applications"; mkdir -p "$DEST"; }
    rm -rf "$DEST/$(basename "$APP")"; cp -R "$APP" "$DEST/"
    hdiutil detach -quiet "$MNT" || true
    xattr -dr com.apple.quarantine "$DEST/$(basename "$APP")" 2>/dev/null || true
    echo "Installed: $DEST/$(basename "$APP")" ;;
esac
rm -f "$FILE"

if [[ $WITH_BROWSERS -eq 1 ]]; then
  curl -fsSL "https://raw.githubusercontent.com/$REPO/main/scripts/install_browsers.sh" | bash
else
  echo "Experiments need Chrome, Brave, Firefox and LibreWolf installed. To install them too, rerun with --with-browsers."
fi
