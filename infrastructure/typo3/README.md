# TYPO3 + Keycloak backend login

TYPO3 does **not** use Keycloak passwords directly. After OAuth succeeds, `renis_auth` looks up a **backend user** (`be_users`) whose **email** matches the Keycloak account.

## Typical failure

> Your login attempt did not succeed…

Keycloak worked, but there is no matching `be_users` row (e.g. only `admin@admin.com` exists while you sign in as `super.admin@renis.bi`).

## Fix

Sync active RENIS users into TYPO3 (runs automatically on container start if `RENIS_DATABASE_URL` is set):

```bash
docker compose exec typo3 php vendor/bin/typo3 renis_auth:sync-backend-users
```

Or recreate TYPO3:

```bash
docker compose up -d typo3
```

## Requirements

1. User exists in Keycloak **renis** realm (same email as management app).
2. User exists in RENIS `users` table (`db-seed` / management app).
3. `renis_auth:sync-backend-users` created/updated the TYPO3 `be_users` record.

Sign in at **http://localhost:8082/typo3/login?loginProvider=1616569531** → click **RENIS (Keycloak)** → `super.admin@renis.bi` / `SuperAdmin123!`.

Do **not** use the username/password tab’s **Login** button with empty fields (TYPO3 logs `username '' with an empty password` — that is unrelated to Keycloak).
