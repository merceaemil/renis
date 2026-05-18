# RENIS-BI

**National Register of Diplomas and Academic Transcripts** — Republic of Burundi.

Functional specification: see `project-en.docx` (English) / `project.docx` (French).

## Architecture

| Component | Role |
|-----------|------|
| **Keycloak** | Identity (OIDC), roles: `super_admin`, `ministry_admin`, `institution_admin` |
| **Management** (`services/management`, port 3000) | Admin UI + REST API (`/api/*`) + Auth.js |
| **TYPO3 14** (`services/typo3`) | Presentation site; backend login via Keycloak (OAuth2) |
| **Widget** (`services/widget`) | Public embed script → management `/api/verify` |
| **PostgreSQL 17** | Single server: databases `renis`, `keycloak`, `typo3` |
| **MinIO** | PDF / file storage |
| **Mailhog** | Dev email |

## Quick start

```bash
cp .env.example .env
# Set AUTH_SECRET to a random 32+ character string and KEYCLOAK_INTERNAL_ISSUER (see .env.example)
docker compose up -d --build
docker compose --profile tools build db-migrate
docker compose --profile tools run --rm db-migrate
docker compose --profile tools run --rm db-seed
```

On first start, PostgreSQL creates databases `renis`, `keycloak`, and `typo3` via `infrastructure/postgres/init-databases.sh`. If you previously used MariaDB, remove old volumes: `docker compose down -v`.

Services:

| URL | Service |
|-----|---------|
| http://localhost:3000 | Management UI + API (`/api/health`, `/api/users`, `/api/verify/:code`, …) |
| http://localhost:3001 | Widget **demo page** (embed preview + test codes) |
| http://localhost:3001/renis-verify.iife.js | Verification widget script (IIFE) |
| http://localhost:8080/admin | Keycloak **admin console** (`master` realm: `admin` / `admin`) |
| http://localhost:8082 | TYPO3 presentation site |
| http://localhost:8082/verify | Public diploma verification (TYPO3 + widget) |
| http://localhost:8025 | Mailhog UI |

## Dev accounts (default passwords)

Change these in production. Values below match `.env.example`, `realm-renis.json`, and `db-seed` unless you changed `.env`.

### Infrastructure (not RENIS login)

| Service | URL | Username | Password | Notes |
|---------|-----|----------|----------|--------|
| **Keycloak Admin Console** | http://localhost:8080/admin | `admin` | `admin` | Realm **`master`** only — not for management/TYPO3 |
| **PostgreSQL** | `localhost:5532` | `renis` | `renis_dev_password` | DB `renis`; also DBs `keycloak`, `typo3` |
| **PostgreSQL (Keycloak DB user)** | — | `keycloak` | `keycloak_dev_password` | Used by Keycloak container |
| **PostgreSQL (TYPO3 DB user)** | — | `typo3` | `typo3_dev_password` | DB `typo3` |
| **MinIO** | http://localhost:9000 (API), http://localhost:9002 (console) | `minioadmin` | `minioadmin` | Bucket `renis-documents`; diploma PDFs on publish |
| **TYPO3 Install Tool** | http://localhost:8082/typo3/install.php | — | `password` | `TYPO3_INSTALL_TOOL_PASSWORD` in `.env` |
| **Mailhog** | http://localhost:8025 | — | — | Catches invitation / notification mail in dev |

### RENIS platform users (Keycloak realm `renis`)

Use these at **http://localhost:3000** (management) or **TYPO3 backend** (Keycloak OAuth).  
Do **not** use them on the Keycloak Admin Console login (`master` realm).

| Email | Password | RENIS role | Management access |
|-------|----------|------------|-------------------|
| `super.admin@renis.bi` | `SuperAdmin123!` | Super Admin | User accounts, institutions, ministry overview, all areas |
| `ministry.admin@renis.bi` | `MinistryAdmin123!` | Ministry Admin | Ministry overview (submitted grades, published diplomas) |
| `ub.admin@renis.bi` | `UbAdmin123!` | Institution Admin | Students, grades, diplomas (institution **UB** only) |

Seeded in **Keycloak** (`infrastructure/keycloak/realm-renis.json`, imported on first Keycloak start) and **PostgreSQL** (`db-seed`). On first login, `keycloak_id` is linked when the email matches a `users` row.

**TYPO3:** Backend login uses the same Keycloak users. Run once after seed:

```bash
docker compose exec typo3 php vendor/bin/typo3 renis_auth:sync-backend-users
```

See `infrastructure/typo3/README.md` and `infrastructure/typo3/README-verify.md` (public verify page).

**Institution settings** (grade classification bands, logos/signatures for diploma PDFs): Management → **Institution settings**, or Admin → Institutions → **Settings**.

**Diploma preview:** After submit, use **Preview PDF** on the diplomas list before **Generate & publish**.

Apply TYPO3 verify extension (if `/verify` is missing):

```bash
sh infrastructure/typo3/apply-verify-extension.sh
```

### Pilot data (not login accounts)

After `db-seed`:

| Kind | Examples |
|------|----------|
| Institution | **UB** — University of Burundi (pilot) |
| Programme | **INFO** — Licence en Informatique (subjects ALG1, BD1, WEB1) |
| Students | `UB-2024-001` … `003` (Alice, Bob, Claire) |

### Creating more users

New platform users are created in the management app (**Admin → User accounts**): Keycloak user + `users` row + a **single-use activation email** (48 hours) sent by Keycloak to set their password, then sign in at `/login` with email and password. In dev, open **Mailhog** (http://localhost:8025) — the message comes from Keycloak, not the management app. They are not created in TYPO3 or via Keycloak self-registration.

### Re-import Keycloak realm

`--import-realm` only applies when the `renis` realm does not exist yet. See `infrastructure/keycloak/README.md`.

## Local development

### Management with hot reload in Docker (recommended on WSL)

Uses `next dev` with bind-mounted source — edit files under `services/management` or `packages/*` and the UI reloads without `docker compose build`.

```bash
# One-time (or after npm dependency changes)
npm run docker:dev:build

# Start management in dev mode (postgres, keycloak, mailhog should already be up)
npm run docker:dev

# Follow logs
npm run docker:dev:logs
```

Stop the production management container if it is already running, then start dev:

```bash
docker compose stop management
npm run docker:dev
```

### Management on the host (Node.js 22+)

```bash
npm install
cp .env.example .env
# DATABASE_URL=postgresql://renis:renis_dev_password@localhost:5532/renis
npm run db:migrate
npm run dev:management
npm run dev:widget
```

## Embeddable widget (React)

Open **http://localhost:3001** for the built-in demo (test codes + live embed). After `db-seed`, code `00000000-0000-4000-a000-000000000001` returns **Valid**.

Dev with HMR: `npm run dev:widget`.

```html
<div id="renis-verify" data-api-url="http://localhost:3000"></div>
<script src="http://localhost:3001/renis-verify.iife.js"></script>
```

Also: `data-renis-verify`, `window.RenisVerify.init()`, query params `?code=` / `?verify=`.

## Spec coverage (project-en.docx v3)

Phase 1 pillars are implemented: grade sessions (grid, Excel, submit, ministry audit/flag, transcript PDF), diplomas (workflow, PDF/QR, revoke with password, public verify + widget + TYPO3 `/verify`), institution settings/branding, users/institutions, audit log API, emails (Mailhog).

| Area | Status |
|------|--------|
| Grades + transcripts | Done (§4); ministry read-only + CSV; pre-submission summary with averages |
| Diplomas + verification | Done (§5); QR → `MANAGEMENT_PUBLIC_URL/verify/{code}`; widget/TYPO3 optional |
| Auth + invitations | Keycloak OIDC, 8h session, token refresh, execute-actions invitation email |
| Audit | Immutable `audit_logs`; Super Admin **Audit log** UI; login/logout events |
| PDF integrity | SHA-256 on publish; **Check PDF** on published diplomas |
| Phase 2 / out of scope | PKI, student portal, mobile app, ministry approve/reject, gov integrations |

Set `MANAGEMENT_PUBLIC_URL` (HTTPS in production) so QR codes resolve correctly. Optional: `MINISTRY_LOGO_OBJECT_KEY` for national logo on diplomas.

## Stack versions

- Next.js 15, React 19, Auth.js v5, Prisma 6, Tailwind CSS 4
- TYPO3 14.3, Keycloak 26, PostgreSQL 17 (all apps), PHP 8.4, Vite 6, React 19 (widget)
