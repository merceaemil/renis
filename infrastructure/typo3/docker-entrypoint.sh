#!/bin/sh
set -e

export TYPO3_CONTEXT="${TYPO3_CONTEXT:-Development/Docker}"

cd /var/www/html

if [ ! -f vendor/autoload.php ]; then
  echo "Installing TYPO3 dependencies (composer install)…"
  composer install --no-interaction --prefer-dist
fi

mkdir -p config/system var public/fileadmin public/_assets

cat > config/system/additional.php <<'PHP'
<?php

declare(strict_types=1);

defined('TYPO3') or die();

$GLOBALS['TYPO3_CONF_VARS']['DB']['Connections']['Default'] = [
    'charset' => 'utf8',
    'driver' => 'pdo_pgsql',
    'host' => getenv('TYPO3_DB_HOST') ?: 'postgres',
    'dbname' => getenv('TYPO3_DB_NAME') ?: 'typo3',
    'user' => getenv('TYPO3_DB_USER') ?: 'typo3',
    'password' => getenv('TYPO3_DB_PASSWORD') ?: '',
    'port' => (int) (getenv('TYPO3_DB_PORT') ?: 5432),
];

$issuer = rtrim((string) (getenv('KEYCLOAK_ISSUER') ?: 'http://localhost:8080/realms/renis'), '/');
$internalIssuer = rtrim(
    (string) (getenv('KEYCLOAK_INTERNAL_ISSUER') ?: getenv('KEYCLOAK_ISSUER') ?: 'http://keycloak:8080/realms/renis'),
    '/',
);
$clientId = (string) (getenv('KEYCLOAK_TYPO3_CLIENT_ID') ?: 'renis-typo3');
$clientSecret = (string) (getenv('KEYCLOAK_TYPO3_CLIENT_SECRET') ?: '');

// OAuth redirect: Keycloak on :8080, TYPO3 on :8082 — cookies must be Lax (not Strict).
$GLOBALS['TYPO3_CONF_VARS']['BE']['cookieSameSite'] = 'lax';

if ($issuer !== '' && $clientId !== '') {
    $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['oauth2_client'] = [
        'providers' => [
            'keycloak' => [
                'label' => 'RENIS (Keycloak)',
                'iconIdentifier' => 'actions-key',
                'description' => 'Sign in with your RENIS account',
                'scopes' => [
                    \Waldhacker\Oauth2Client\Service\Oauth2ProviderManager::SCOPE_BACKEND,
                ],
                'options' => [
                    'clientId' => $clientId,
                    'clientSecret' => $clientSecret,
                    'urlAuthorize' => $issuer . '/protocol/openid-connect/auth',
                    'urlAccessToken' => $internalIssuer . '/protocol/openid-connect/token',
                    'urlResourceOwnerDetails' => $internalIssuer . '/protocol/openid-connect/userinfo',
                    'responseResourceOwnerId' => 'sub',
                ],
            ],
        ],
    ];
}

// Default login tab: Keycloak (not empty username/password form).
$oauthProviderId = \Waldhacker\Oauth2Client\Backend\LoginProvider\Oauth2LoginProvider::PROVIDER_ID;
if (isset($GLOBALS['TYPO3_CONF_VARS']['EXTCONF']['backend']['loginProviders'][$oauthProviderId])) {
    $GLOBALS['TYPO3_CONF_VARS']['EXTCONF']['backend']['loginProviders'][$oauthProviderId]['sorting'] = 100;
}
PHP

chown -R www-data:www-data /var/www/html
chmod -R ug+rwx /var/www/html/var /var/www/html/config /var/www/html/public
chmod ug+rwx /var/www/html

if [ -d /opt/renis_verify ]; then
  rm -rf /var/www/html/packages/renis_verify 2>/dev/null || true
  cp -a /opt/renis_verify /var/www/html/packages/renis_verify
  chown -R www-data:www-data /var/www/html/packages/renis_verify
fi

if [ -f config/system/settings.php ]; then
  # settings.php can exist before the DB schema (e.g. partial web install) — create tables if missing
  if ! php -r "
    require 'vendor/autoload.php';
    \$h = getenv('TYPO3_DB_HOST') ?: 'postgres';
    \$d = getenv('TYPO3_DB_NAME') ?: 'typo3';
    \$u = getenv('TYPO3_DB_USER') ?: 'typo3';
    \$p = getenv('TYPO3_DB_PASSWORD') ?: 'typo3_dev_password';
    \$pdo = new PDO(\"pgsql:host=\$h;dbname=\$d\", \$u, \$p);
    \$n = (int) \$pdo->query(\"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\")->fetchColumn();
    exit(\$n > 0 ? 0 : 1);
  " 2>/dev/null; then
    echo "TYPO3: no database tables yet — run extension:setup…"
    php vendor/bin/typo3 extension:setup -n || echo "TYPO3 extension:setup failed; use infrastructure/typo3/setup-typo3.sh"
  elif [ -x /usr/local/bin/renis-typo3-finish-setup.sh ]; then
    echo "TYPO3: ensuring /verify page and extensions…"
    sh /usr/local/bin/renis-typo3-finish-setup.sh || echo "TYPO3 finish setup failed; run: sh infrastructure/typo3/finish-typo3-setup.sh"
  fi
  php vendor/bin/typo3 renis_auth:sync-backend-users 2>/dev/null || true
fi

if [ "$#" -eq 0 ]; then
  set -- apache2-foreground
fi

exec "$@"
