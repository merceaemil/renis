#!/bin/sh
# Run from repo root after TYPO3 container exists:
#   sh infrastructure/typo3/apply-verify-extension.sh
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.yml"

container_id=$($COMPOSE ps -q typo3 2>/dev/null || true)
if [ -z "$container_id" ]; then
  echo "TYPO3 is not running."
  echo "Start it with: docker compose up -d typo3"
  echo "Then re-run this script."
  exit 1
fi

state=$(docker inspect -f '{{.State.Running}}' "$container_id" 2>/dev/null || echo false)
if [ "$state" != "true" ]; then
  echo "TYPO3 container exists but is not running (state: $state)."
  echo "Start it with: docker compose up -d typo3"
  exit 1
fi

$COMPOSE exec -u root typo3 sh -c '
  if [ ! -d /opt/renis_verify ]; then
    echo "Warning: /opt/renis_verify not mounted — check docker-compose.yml volumes."
    exit 1
  fi
  rm -rf /var/www/html/packages/renis_verify
  cp -a /opt/renis_verify /var/www/html/packages/renis_verify
  chown -R www-data:www-data /var/www/html/packages/renis_verify
'

# Skip Composer installer scripts: they call deprecated extension:dumpclassloadinginformation (TYPO3 14 uses extension:setup / dumpautoload).
$COMPOSE exec typo3 composer require renis/verify:@dev --no-interaction --no-scripts

$COMPOSE exec typo3 php vendor/bin/typo3 extension:setup -n
$COMPOSE exec typo3 php vendor/bin/typo3 renis_verify:setup-page
$COMPOSE exec typo3 php vendor/bin/typo3 cache:flush

echo "Done. Open http://localhost:8082/verify"
