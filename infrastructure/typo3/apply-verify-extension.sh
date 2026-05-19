#!/bin/sh
# Backwards-compatible alias — use finish-typo3-setup.sh for new installs.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec sh "$ROOT/infrastructure/typo3/finish-typo3-setup.sh"
