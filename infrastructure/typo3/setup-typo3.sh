#!/bin/sh
# Non-interactive TYPO3 database + site setup (run from repo root after postgres + typo3 are up).
#   sh infrastructure/typo3/setup-typo3.sh
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT/docker-compose.yml"

# shellcheck source=/dev/null
[ -f "$ROOT/.env" ] && set -a && . "$ROOT/.env" && set +a

TYPO3_DB_HOST="${TYPO3_DB_HOST:-postgres}"
TYPO3_DB_NAME="${TYPO3_DB_NAME:-typo3}"
TYPO3_DB_USER="${TYPO3_DB_USER:-typo3}"
TYPO3_DB_PASSWORD="${TYPO3_DB_PASSWORD:-typo3_dev_password}"
TYPO3_BASE_URL="${TYPO3_BASE_URL:-http://localhost:8082}"
TYPO3_ADMIN_PASSWORD="${TYPO3_ADMIN_PASSWORD:-Typo3Admin123!}"

container_id=$($COMPOSE ps -q typo3 2>/dev/null || true)
if [ -z "$container_id" ]; then
  echo "TYPO3 is not running. Start with: docker compose up -d typo3"
  exit 1
fi

table_count=$(
  $COMPOSE exec -T postgres psql -U "$TYPO3_DB_USER" -d "$TYPO3_DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null \
    | tr -d '[:space:]'
)

if [ "${table_count:-0}" != "0" ]; then
  echo "TYPO3 database already has ${table_count} tables — skipping schema setup."
else
echo "Setting up TYPO3 (PostgreSQL schema + site)…"
$COMPOSE exec -T typo3 php vendor/bin/typo3 setup \
  --driver=postgres \
  --host="$TYPO3_DB_HOST" \
  --port=5432 \
  --dbname="$TYPO3_DB_NAME" \
  --username="$TYPO3_DB_USER" \
  --password="$TYPO3_DB_PASSWORD" \
  --project-name=RENIS \
  --admin-username=admin \
  --admin-user-password="$TYPO3_ADMIN_PASSWORD" \
  --server-type=other \
  --create-site="${TYPO3_BASE_URL}/" \
  -n --force

$COMPOSE exec -T typo3 php vendor/bin/typo3 extension:setup -n

fi

echo "Activating extensions and creating /verify page…"
sh "$ROOT/infrastructure/typo3/finish-typo3-setup.sh"

echo ""
echo "TYPO3 setup complete."
echo "  Verify:   ${TYPO3_BASE_URL}/verify"
echo "  Frontend: ${TYPO3_BASE_URL}"
echo "  Backend:  ${TYPO3_BASE_URL}/typo3 (use Keycloak after renis_auth:sync-backend-users)"
echo "  Local admin (fallback): admin / ${TYPO3_ADMIN_PASSWORD}"
