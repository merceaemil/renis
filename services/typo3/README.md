# TYPO3 14 — presentation site

[TYPO3 CMS base distribution](https://packagist.org/packages/typo3/cms-base-distribution) **^14.3** (Composer mode, PHP 8.4, Apache).

The full project directory is **bind-mounted** into the container (`./services/typo3` → `/var/www/html`). On first start, `composer install` runs if `vendor/` is missing.

## Stack

- **TYPO3**: 14.x
- **Database**: PostgreSQL (`typo3` database on shared `postgres` service)
- **Web root**: `public/`
- **Login**: Keycloak (`renis-typo3` client) — configure OpenID Connect after setup
- **Accounts**: created in the management app, not in TYPO3

## Local development

```bash
# From repo root — TYPO3 only (needs postgres healthy)
docker compose up -d postgres typo3

# Or install dependencies on the host (PHP 8.4 + extensions)
cd services/typo3 && composer install
```

Persistent/generated paths (gitignored): `vendor/`, `var/`, `config/`, most of `public/`.

## First visit

1. Open http://localhost:8082
2. Run the TYPO3 install wizard.
3. Database (pre-filled via `config/system/additional.php` when env vars are set):
   - Driver: **PostgreSQL**
   - Host: `postgres`
   - Database: `typo3`
   - User / password: see `.env` (`TYPO3_DB_*`)

## Verification widget embed

```html
<div id="renis-verify" data-api-url="http://localhost:4000"></div>
<script src="http://localhost:3001/renis-verify.iife.js"></script>
```
