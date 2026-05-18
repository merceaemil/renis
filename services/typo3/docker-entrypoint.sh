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
PHP

chown -R www-data:www-data /var/www/html
chmod -R ug+rwx /var/www/html/var /var/www/html/config /var/www/html/public
chmod ug+rwx /var/www/html

if [ -f config/system/settings.php ]; then
  for ext in oauth2_client renis_auth; do
    php vendor/bin/typo3 extension:activate "$ext" 2>/dev/null || true
  done
fi

if [ "$#" -eq 0 ]; then
  set -- apache2-foreground
fi

exec "$@"
