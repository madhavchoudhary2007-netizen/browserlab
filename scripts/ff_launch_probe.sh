#!/bin/zsh
# Probe: can Firefox be started as a direct child of THIS shell with a fresh temp profile and Marionette?
# Launches one Firefox with a throwaway profile, reports ALIVE/EXITED, then terminates only that process.
P=$(mktemp -d /private/tmp/ffprobe.XXXXXX)
/Applications/Firefox.app/Contents/MacOS/firefox --marionette -no-remote -profile "$P" about:blank >/dev/null 2>&1 &
FP=$!
sleep 12
if kill -0 $FP 2>/dev/null; then
  echo "FIREFOX-PROBE: ALIVE marionette_port=$(cat "$P/MarionetteActivePort" 2>/dev/null)"
  kill $FP
else
  wait $FP
  echo "FIREFOX-PROBE: EXITED rc=$?"
fi
