#!/bin/sh
# Runs inside the typo3 container (mounted as /usr/local/bin/renis-typo3-finish-setup.sh).
set -e

cd /var/www/html

if [ ! -f config/system/settings.php ]; then
  echo "TYPO3: settings.php missing — complete install before finish setup."
  exit 1
fi

if [ ! -f vendor/autoload.php ]; then
  echo "TYPO3: running composer install…"
  composer install --no-interaction --prefer-dist
fi

if [ -d /opt/renis_verify ]; then
  rm -rf packages/renis_verify 2>/dev/null || true
  cp -a /opt/renis_verify packages/renis_verify
  chown -R www-data:www-data packages/renis_verify
fi

# Path packages (renis/verify, renis/auth, oauth2_client) from composer.json
composer install --no-interaction --prefer-dist --no-scripts

for ext in oauth2_client renis_auth renis_verify; do
  php vendor/bin/typo3 extension:activate "$ext" 2>/dev/null || true
done

php vendor/bin/typo3 extension:setup -n
php vendor/bin/typo3 renis_verify:setup-page
php vendor/bin/typo3 cache:flush

echo "TYPO3 finish setup done — public verify page: ${TYPO3_BASE_URL:-http://localhost:8082}/verify"
