#!/bin/zsh
# One-time: create a LOCAL self-signed code-signing certificate ("BrowserLab Local Signing") in your login
# keychain so rebuilt BrowserLab.app builds keep the same code identity and macOS privacy grants
# (e.g. Full Disk Access, which Firefox automation needs) survive rebuilds.
# Local use only: not a Developer ID, not notarized, does not make the app distributable.
# macOS asks for your login password once to trust the certificate for code signing.
set -euo pipefail
NAME="BrowserLab Local Signing"
KC="$HOME/Library/Keychains/login.keychain-db"
if security find-identity -v -p codesigning | grep -q "$NAME"; then echo "Identity '$NAME' already exists and is trusted."; exit 0; fi
if security find-certificate -c "$NAME" "$KC" >/dev/null 2>&1; then
  echo "Certificate exists but is not trusted yet; trusting it."
  security find-certificate -c "$NAME" -p "$KC" > "${TMPDIR:-/tmp}/bl_cert.pem"
else
  D=$(mktemp -d)
  cat > "$D/openssl.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
CNF
  /usr/bin/openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -config "$D/openssl.cnf" -keyout "$D/key.pem" -out "$D/cert.pem" 2>/dev/null
  PW=$(uuidgen)
  /usr/bin/openssl pkcs12 -export -inkey "$D/key.pem" -in "$D/cert.pem" -name "$NAME" -out "$D/id.p12" -passout "pass:$PW"
  security import "$D/id.p12" -k "$KC" -P "$PW" -T /usr/bin/codesign
  cp "$D/cert.pem" "${TMPDIR:-/tmp}/bl_cert.pem"
  rm -rf "$D"
fi
echo "Trusting the certificate for code signing (macOS will ask for your login password)..."
security add-trusted-cert -r trustRoot -p codeSign -k "$KC" "${TMPDIR:-/tmp}/bl_cert.pem"
security find-identity -v -p codesigning | grep "$NAME" && echo "OK"
