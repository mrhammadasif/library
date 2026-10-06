#!/bin/bash
# Installs the release APK on the running emulator/device and runs the Maestro flows against the live API.
# Needs: a booted emulator (adb devices), .maestro/.env.local with TEST_EMAIL / TEST_PASSWORD for a verified account.
set -euo pipefail
cd "$(dirname "$0")/.."
APK=android/app/build/outputs/apk/release/app-release.apk
set -a; . .maestro/.env.local; set +a
adb install -r "$APK" >/dev/null
maestro test -e TEST_EMAIL="$TEST_EMAIL" -e TEST_PASSWORD="$TEST_PASSWORD" --test-output-dir test-results/maestro .maestro/ "$@"
