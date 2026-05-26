# Keycloak (realm `renis`)

## Two different logins

| Where | Realm | Username | Password |
|-------|--------|----------|----------|
| **Keycloak Admin Console** — http://localhost:8080/admin | `master` | `admin` | `admin` (from `.env`) |
| **RENIS apps** (management, TYPO3 OAuth) | `renis` | `super.admin@renis.bi` | `SuperAdmin123!` |

Do **not** use `super.admin@renis.bi` on the Keycloak Admin Console login page — that user is not in `master`, so you get *Invalid username or password*.

## Docker: management cannot reach Keycloak on `localhost`

Keycloak advertises OIDC URLs as `http://localhost:8080/...` (for the browser). The management container must call **`http://keycloak:8080`** for token exchange.

In `.env`:

```env
KEYCLOAK_ISSUER=http://localhost:8080/realms/renis
KEYCLOAK_INTERNAL_ISSUER=http://keycloak:8080/realms/renis
```

After changing auth settings, rebuild: `docker compose up -d --build management`.

User provisioning (`POST /api/users` on the management app) calls the Keycloak Admin API from the **management** container. Keep `KEYCLOAK_INTERNAL_ISSUER=http://keycloak:8080/realms/renis`; you can leave `KEYCLOAK_ADMIN_URL=http://localhost:8080` for your browser — the app resolves the internal host automatically. Or set `KEYCLOAK_ADMIN_INTERNAL_URL=http://keycloak:8080` explicitly.

## RENIS super admin

1. Open http://localhost:3000 (management) or TYPO3 backend (http://localhost:8082/typo3 → Keycloak). For TYPO3, run `docker compose exec typo3 php vendor/bin/typo3 renis_auth:sync-backend-users` first — see `infrastructure/typo3/README.md`.
2. You are redirected to the **`renis`** realm login (URL contains `/realms/renis/`).
3. Sign in with `super.admin@renis.bi` / `SuperAdmin123!`.

The Postgres seed (`db-migrate` + `npm run db:seed`) must include the matching `users` row (email `super.admin@renis.bi`).

## Reset dev password

If the realm was imported before the user existed or the password was never applied:

```bash
docker exec renis-keycloak-1 /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin

docker exec renis-keycloak-1 /opt/keycloak/bin/kcadm.sh set-password -r renis \
  --username 'super.admin@renis.bi' --new-password 'SuperAdmin123!'
```

## Direct access grants (diploma revoke password check)

Revoking a published diploma requires the admin to re-enter their Keycloak password. The management API uses the OAuth **password** grant on client `renis-management`, which needs **Direct access grants** enabled.

### Option A — Admin Console (easiest)

1. Open http://localhost:8080/admin (realm **master**, user `admin` / password from `.env`).
2. Switch realm to **renis** (top-left).
3. **Clients** → **renis-management** → **Capability config** (or **Settings**).
4. Turn **Direct access grants** **ON** → **Save**.

### Option B — CLI (existing Docker stack)

```bash
docker exec renis-keycloak-1 /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin

docker exec renis-keycloak-1 /opt/keycloak/bin/kcadm.sh update clients/$( \
  docker exec renis-keycloak-1 /opt/keycloak/bin/kcadm.sh get clients -r renis -q clientId=renis-management --fields id --format csv --noquotes | tail -1 \
) -r renis -s directAccessGrantsEnabled=true
```

Replace `admin` / container name if yours differ (`docker compose ps keycloak`).

### Option C — Re-import realm (only if you can wipe Keycloak data)

`realm-renis.json` already has `directAccessGrantsEnabled: true`, but `--import-realm` does **not** update an existing realm. Use only on a fresh Keycloak DB:

```bash
docker compose stop keycloak
# optional: remove keycloak volume if you accept losing realm users/tweaks
docker compose up -d keycloak
```

After enabling, rebuild/restart management and test revoke on a **published** diploma with your Keycloak password (not the management cookie alone).

## User invitations (activation email)

New users receive a **single-use Keycloak link** (48 hours) to set their password, then sign in at the management `/login` page. Dev mail is in **Mailhog** (http://localhost:8025). Keycloak must have SMTP (`mailhog:1025`) and the `renis` email theme — see `realm-renis.json` and `themes/renis/email/`.

If invitations fail after upgrading, configure SMTP on the existing realm:

```bash
docker exec renis-keycloak-1 /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin

docker exec renis-keycloak-1 /opt/keycloak/bin/kcadm.sh update realms/renis -s emailTheme=renis \
  -s 'attributes.actionTokenGeneratedByAdminLifespan=172800' \
  -s 'smtpServer.host=mailhog' -s 'smtpServer.port=1025' \
  -s 'smtpServer.from=noreply@renis.bi' -s 'smtpServer.fromDisplayName=RENIS-BI' \
  -s 'smtpServer.auth=false' -s 'smtpServer.ssl=false' -s 'smtpServer.starttls=false'
```

Restart Keycloak after changing the email theme mount in `docker-compose.yml`.

## TYPO3 client: `openid` scope (userinfo / backend login)

Client `renis-typo3` must have the **`openid`** default client scope. Without it, `/userinfo` returns 403 (`insufficient_scope`) and TYPO3 logs `Expected JSON` after the OAuth callback.

Keycloak’s `--import-realm` does **not** create the `openid` client scope (see [Keycloak #16168](https://github.com/keycloak/keycloak/issues/16168)). `docker compose up` runs the one-shot **`keycloak-config`** service (`infrastructure/keycloak/configure-realm-scopes.sh`) to create `openid` and attach **`openid`**, **`profile`**, **`email`**, and other defaults to `renis-typo3` and `renis-management`.

**Do not** add a `clientScopes` section to `realm-renis.json` — it replaces Keycloak’s built-in scopes and breaks login (only `openid`/`offline_access` remain).

If login still fails after a fresh wipe, run:

```bash
docker compose run --rm keycloak-config
```

Manual fix (without re-running compose):

### Admin Console

Realm **renis** → **Clients** → **renis-typo3** → **Client scopes** → **Add client scope** → choose **openid** → **Add** → set as **Default**.

### CLI (existing Docker stack)

```bash
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin

CLIENT_ID=$(docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh get clients -r renis \
  -q clientId=renis-typo3 --fields id --format csv --noquotes | tail -1)
OPENID_ID=$(docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh get client-scopes -r renis \
  -q name=openid --fields id --format csv --noquotes | tail -1)

docker compose exec keycloak /opt/keycloak/bin/kcadm.sh update \
  "clients/${CLIENT_ID}/default-client-scopes/${OPENID_ID}" -r renis
```

Then sign out of Keycloak and retry TYPO3 login (old tokens still lack `openid`).

## Multi-language (English + French)

The realm is configured for `internationalizationEnabled=true` with `supportedLocales=["en","fr"]` and `defaultLocale=en`. The `renis` login and email themes ship `messages_en.properties` and `messages_fr.properties`.

| Where | Mechanism |
|-------|-----------|
| Fresh Keycloak DB | `realm-renis.json` (i18n keys read on first import) |
| Existing realm | `keycloak-config` re-applies `internationalizationEnabled`, `supportedLocales`, `defaultLocale` on every `docker compose up` |
| Management app → Keycloak | `signIn("keycloak", { callbackUrl }, { kc_locale, ui_locales })` (login page) — Keycloak stores the choice as a user attribute and reuses it for emails |
| Forgot-password link | URL includes `kc_locale=<lang>` and `ui_locales=<lang>` |
| Keycloak login UI | Built-in locale selector (top-right) renders automatically because `locales=en,fr` is set in `theme.properties` |

Override via env (read by `configure-realm-scopes.sh`):

```env
KEYCLOAK_I18N_ENABLED=true
KEYCLOAK_I18N_SUPPORTED_LOCALES=en,fr
KEYCLOAK_I18N_DEFAULT_LOCALE=en
```

To add a new language `xx`:

1. Add it to `supportedLocales` in `realm-renis.json` and `KEYCLOAK_I18N_SUPPORTED_LOCALES`.
2. Add it to `locales=` in `themes/renis/login/theme.properties` and `themes/renis/email/theme.properties`.
3. Create `themes/renis/login/messages/messages_xx.properties` and `themes/renis/email/messages/messages_xx.properties`.
4. `docker compose restart keycloak && docker compose run --rm keycloak-config`.

## Branded login page (theme `renis`)

The Keycloak hosted login pages (sign-in, forgot password, set password, account console) are themed to match the RENIS-BI management UI:

- Files: `infrastructure/keycloak/themes/renis/login/`
- Email files (existing): `infrastructure/keycloak/themes/renis/email/`
- Parent theme: `keycloak.v2` (PatternFly 5 — Keycloak 26.x default)
- Brand colors: `#1e3a5f` primary, `#c9a227` accent (same tokens as `services/management/src/app/globals.css`)
- Realm attribute: `loginTheme=renis` (set in `realm-renis.json` and re-applied by `keycloak-config` on every `docker compose up`)

### How it is applied

| When | Mechanism |
|------|-----------|
| Fresh Keycloak DB | `realm-renis.json` → imported on first `docker compose up` |
| Existing realm (any subsequent boot) | `keycloak-config` service runs `configure-realm-scopes.sh`, which does `kcadm update realms/renis -s loginTheme=renis -s emailTheme=renis` |

Both paths read `KEYCLOAK_LOGIN_THEME` and `KEYCLOAK_EMAIL_THEME` env vars (default `renis`). Set them to `keycloak` to opt out without removing the files.

### Editing the theme

The theme directory is mounted read-only into Keycloak at `/opt/keycloak/themes/renis` (see `docker-compose.yml` `keycloak` service). To iterate on CSS:

```bash
# 1. Edit infrastructure/keycloak/themes/renis/login/...
# 2. Reload Keycloak so it re-reads themes from disk (dev mode caches them).
docker compose restart keycloak
```

Keycloak caches themes in production mode. `start-dev` (used in `docker-compose.yml`) sets `KC_THEME_STATIC_MAX_AGE=-1` and disables caching, so a hard refresh (Ctrl+Shift+R) is usually enough; the restart is only needed when you change `theme.properties` or add new files.

### Verifying

1. Open http://localhost:3000 — click **Sign in with Keycloak**.
2. The Keycloak page should show the RENIS-BI wordmark on a dark blue gradient, gold accent line, and a navy **Sign in** button.
3. The browser address bar still points at `/realms/renis/protocol/openid-connect/auth?...` — the theme runs on Keycloak, not in the management app.

### Reverting

```bash
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin
docker compose exec keycloak /opt/keycloak/bin/kcadm.sh update realms/renis -s 'loginTheme=keycloak'
```

Or set `KEYCLOAK_LOGIN_THEME=keycloak` in `.env` and re-run `docker compose run --rm keycloak-config`.

## Re-import realm

`--import-realm` only creates the realm on first start (`IGNORE_EXISTING`). To re-import from JSON:

```bash
docker compose stop keycloak
# optional: drop only keycloak DB or full volume
docker compose up -d keycloak
```
