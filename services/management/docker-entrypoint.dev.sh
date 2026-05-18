#!/bin/sh
set -e

cd /app

# Re-install only when lockfile is newer than node_modules (e.g. after git pull)
if [ ! -d node_modules/.bin/next ] || [ package-lock.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
  echo "Installing npm dependencies…"
  npm ci
  touch node_modules/.package-lock.json 2>/dev/null || true
fi

echo "Generating Prisma client…"
npm run generate -w @renis/database

echo "Starting Next.js dev server (hot reload)…"
exec npm run dev -w @renis/management
