#!/bin/sh
# Activates renis_verify and creates /verify page (run from repo root after TYPO3 DB exists).
#   sh infrastructure/typo3/finish-typo3-setup.sh
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.yml"

container_id=$($COMPOSE ps -q typo3 2>/dev/null || true)
if [ -z "$container_id" ]; then
  echo "TYPO3 is not running. Start with: docker compose up -d typo3"
  exit 1
fi

$COMPOSE exec -T typo3 sh /usr/local/bin/renis-typo3-finish-setup.sh
