#!/bin/bash
# Fails if a release APK is missing its inlined API config.
# EXPO_PUBLIC_* values are inlined at bundle time; a stale Metro cache can leave them as runtime lookups (= empty).
# Usage: bash scripts/check-apk.sh <apk>
set -euo pipefail
APK=${1:-library-preview.apk}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
unzip -q -o "$APK" assets/index.android.bundle -d "$tmp"
# Dump strings to a file first: `strings | grep -q` under pipefail reports failure when grep exits early (SIGPIPE).
strings -n 4 "$tmp/assets/index.android.bundle" > "$tmp/strings.txt"
leftover=$(grep -oE 'EXPO_PUBLIC_(API_URL|COVERS_URL|GOOGLE_WEB_CLIENT_ID)' "$tmp/strings.txt" | sort -u || true)
if ! grep -q 'api.library.nitroxis.com' "$tmp/strings.txt"; then
  echo "FAIL: API URL not found in bundle"
  exit 1
fi
if [ -n "$leftover" ]; then
  echo "FAIL: not inlined (stale Metro cache?): $leftover"
  exit 1
fi
echo "OK: env inlined"
