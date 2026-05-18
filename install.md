# RENIS-BI — full installation guide

Step-by-step setup for a **fresh** development environment using Docker Compose. For architecture and feature overview, see [README.md](README.md).

---

## 1. Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Docker** + **Docker Compose** v2 | Enough RAM (~4 GB+) for Keycloak, Next.js, TYPO3, PostgreSQL |
| **Git** | Clone the repository |
| **Ports free** | 3000, 3001, 5532, 8025, 8080, 8082, 9000, 9002, 1025 |

Optional (host development without Docker for management):

- **Node.js 22+** and **npm**

---

## 2. Get the code

```bash
git clone <repository-url> renis
cd renis
```

---

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Random string, **at least 32 characters** (Auth.js session signing) |
| `KEYCLOAK_INTERNAL_ISSUER` | Must be `http://keycloak:8080/realms/renis` when management runs **in Docker** |

Generate a secret (example):

```bash
openssl rand -base64 32
```

**Do not change** these unless you also update Keycloak realm / Postgres init:

- `KEYCLOAK_CLIENT_SECRET` — must match `infrastructure/keycloak/realm-renis.json` (`change-me-in-production` in dev)
- `KEYCLOAK_TYPO3_CLIENT_SECRET` — must match realm (`change-me-typo3-secret` in dev)
- `KEYCLOAK_DB_PASSWORD` / `TYPO3_DB_PASSWORD` — must match `infrastructure/postgres/init-databases.sh` on **first** database creation

If you previously used another database engine or custom passwords, reset volumes (see [§12 Clean reset](#12-clean-reset)).

---

## 4. Start the stack

From the repository root:

```bash
docker compose up -d --build
```

Wait until containers are up (first build can take several minutes):

```bash
docker compose ps
```

Expected services: `postgres`, `keycloak`, `mailhog`, `minio`, `minio-init` (exits), `management`, `widget`, `typo3`.

**What this does automatically:**

- PostgreSQL creates databases `renis`, `keycloak`, `typo3` (first start only)
- Keycloak imports realm **`renis`** with dev users (first start only)
- MinIO creates bucket `renis-documents`
- Management and widget images are built and started

**What it does *not* do:**

- Apply Prisma schema to `renis` (next step)
- Seed pilot data
- Run the TYPO3 install wizard (`config/` is not in git)

---

## 5. Database migrations and seed

Build the migration tool image once, then run migrate and seed:

```bash
docker compose --profile tools build db-migrate
docker compose --profile tools run --rm db-migrate
docker compose --profile tools build db-seed
docker compose --profile tools run --rm db-seed
```

| Command | Effect |
|---------|--------|
| `db-migrate` | Applies all Prisma migrations to the `renis` database |
| `db-seed` | Loads pilot institution (UB), programme, students, users linked to Keycloak emails, sample diplomas/transcripts |

Re-run seed only when you intend to reset data (may conflict with existing rows).

---

## 6. Verify the management app

1. Open **http://localhost:3000**
2. Sign in with a seeded account:

   | Email | Password | Role |
   |-------|----------|------|
   | `super.admin@renis.bi` | `SuperAdmin123!` | Super Admin |
   | `ministry.admin@renis.bi` | `MinistryAdmin123!` | Ministry Admin |
   | `ub.admin@renis.bi` | `UbAdmin123!` | Institution Admin (UB) |

3. Optional health check: **http://localhost:3000/api/health**

**Login tips:**

- Use the **management** login at port **3000**, not the Keycloak Admin Console (`admin` / `admin` on port 8080 is only for realm `master`).
- Browser redirects to Keycloak realm **`renis`** (`/realms/renis/` in the URL).

**Widget demo:** **http://localhost:3001** — after seed, test code `00000000-0000-4000-a000-000000000001` should return **Valid**.

---

## 7. TYPO3 — first-time install

TYPO3’s `config/` directory is gitignored. On a fresh clone you must run the install wizard once.

1. Ensure TYPO3 is running: `docker compose up -d typo3`
2. Open **http://localhost:8082**
3. Follow the **TYPO3 Install Tool** / setup wizard.
4. Database settings (also injected via container env; use these if prompted):

   | Field | Value |
   |-------|--------|
   | Driver | PostgreSQL |
   | Host | `postgres` (inside Docker network) |
   | Port | `5432` |
   | Database | `typo3` |
   | User | `typo3` |
   | Password | `typo3_dev_password` (or your `TYPO3_DB_PASSWORD` from `.env`) |

5. Complete site setup and admin user as guided by TYPO3.

Install tool password (if asked): value of `TYPO3_INSTALL_TOOL_PASSWORD` in `.env` (default `password`).

See also `services/typo3/README.md`.

---

## 8. TYPO3 — Keycloak backend users

RENIS users are created in the management app and Keycloak; TYPO3 backend login uses OAuth and synced `be_users` rows.

After **db-seed** and TYPO3 install (`config/system/settings.php` exists):

```bash
docker compose exec typo3 php vendor/bin/typo3 renis_auth:sync-backend-users
```

Then open **http://localhost:8082/typo3** → **Sign in with Keycloak** → e.g. `super.admin@renis.bi` / `SuperAdmin123!`.

Details: `infrastructure/typo3/README.md`.

---

## 9. TYPO3 — public verification page (optional)

Enable the `/verify` page with the embeddable widget:

```bash
sh infrastructure/typo3/apply-verify-extension.sh
```

Then open **http://localhost:8082/verify**.

Manual equivalent: `infrastructure/typo3/README-verify.md`.

---

## 10. Keycloak — diploma revoke (recommended)

Revoking a **published** diploma requires re-entering the user’s Keycloak password. The `renis-management` client needs **Direct access grants** enabled.

**Option A — Admin Console**

1. http://localhost:8080/admin — realm **`master`**, user `admin` / password from `.env`
2. Switch realm to **`renis`**
3. **Clients** → **renis-management** → enable **Direct access grants** → **Save**

**Option B — CLI**

See `infrastructure/keycloak/README.md` (section “Direct access grants”).

The imported `realm-renis.json` already sets this on a **fresh** Keycloak database.

---

## 11. Service URLs (development)

| URL | Service |
|-----|---------|
| http://localhost:3000 | Management UI + API |
| http://localhost:3001 | Widget demo + `renis-verify.iife.js` |
| http://localhost:8080/admin | Keycloak admin (`master` realm) |
| http://localhost:8082 | TYPO3 frontend |
| http://localhost:8082/typo3 | TYPO3 backend |
| http://localhost:8082/verify | Public verify page (after §9) |
| http://localhost:8025 | Mailhog (invitation / notification mail) |
| http://localhost:9002 | MinIO console (`minioadmin` / `minioadmin`) |
| `localhost:5532` | PostgreSQL (`renis` / `renis_dev_password`) |

---

## 12. Clean reset

Use when switching DB engines, corrupted volumes, or password mismatches:

```bash
docker compose down -v
```

Then repeat from [§4](#4-start-the-stack) (migrations and TYPO3 install are required again).

**Keycloak realm:** `--import-realm` only runs when realm `renis` does not exist. To force re-import, stop Keycloak and remove its data (see `infrastructure/keycloak/README.md`).

---

## 13. Post-install checks

| Check | How |
|-------|-----|
| Management login | §6 |
| Institution data | Management → Students / Grades / Diplomas (UB pilot) |
| API verify | `curl http://localhost:3000/api/verify/00000000-0000-4000-a000-000000000001` |
| Widget | http://localhost:3001 |
| User invitation mail | Admin → User accounts → create user → Mailhog http://localhost:8025 |
| PDF / MinIO | Publish a diploma draft → PDF stored in MinIO |
| Diagnostics | Super Admin → **Diagnostics** (admin UI) |
| TYPO3 OAuth | §8 |

---

## 14. Optional: management hot reload (WSL / dev)

Edit `services/management` or `packages/*` with live reload:

```bash
npm run docker:dev:build    # once, or after dependency changes
docker compose stop management
npm run docker:dev
npm run docker:dev:logs     # follow logs
```

See README “Local development”.

---

## 15. Optional: management on the host (no Docker for app)

```bash
npm install
cp .env.example .env
```

Set in `.env`:

```env
DATABASE_URL=postgresql://renis:renis_dev_password@localhost:5532/renis
KEYCLOAK_ISSUER=http://localhost:8080/realms/renis
# Do NOT use keycloak:8080 for host-run management unless you add extra networking
MINIO_ENDPOINT=http://localhost:9000
```

Start infrastructure only:

```bash
docker compose up -d postgres keycloak mailhog minio
```

Then:

```bash
npm run db:migrate
npm run db:seed
npm run dev:management
npm run dev:widget   # separate terminal
```

---

## 16. Troubleshooting

### Management: database / Prisma errors

Run [§5](#5-database-migrations-and-seed). The app does not migrate on container start.

### Management: login fails / token errors

- Confirm `KEYCLOAK_INTERNAL_ISSUER=http://keycloak:8080/realms/renis` in `.env`
- Rebuild: `docker compose up -d --build management`
- See `infrastructure/keycloak/README.md`

### Management: MinIO or Keycloak “degraded” in Diagnostics

When Next.js runs **on the host**, use `http://localhost:9000` for MinIO, not `http://minio:9000`. When running **in Docker**, use `http://minio:9000`.

### TYPO3: “login did not succeed” after Keycloak

Run `renis_auth:sync-backend-users` (§8). Email must match a row in RENIS `users` (from seed or management app).

### TYPO3: `/verify` missing

Run §9 (`apply-verify-extension.sh`).

### Keycloak: wrong password for `super.admin@renis.bi`

Reset via `kcadm.sh` — `infrastructure/keycloak/README.md` (“Reset dev password”).

### Port already in use

Change host ports in `docker-compose.yml` or stop conflicting services.

### `db-migrate` build fails

Ensure Docker has network access for `npm ci`. Retry after `docker compose --profile tools build db-migrate --no-cache`.

---

## 17. Production notes (brief)

- Replace all default passwords and secrets in `.env` and Keycloak.
- Set `MANAGEMENT_PUBLIC_URL` to your public HTTPS URL (QR codes on diplomas).
- Use real SMTP instead of Mailhog.
- Do not commit `.env` or TYPO3 `config/`.
- Run migrations in CI/CD: `prisma migrate deploy` (same as `db-migrate` container).

---

## Quick reference (copy-paste)

```bash
cp .env.example .env
# Edit AUTH_SECRET and confirm KEYCLOAK_INTERNAL_ISSUER

docker compose up -d --build
docker compose --profile tools build db-migrate
docker compose --profile tools run --rm db-migrate
docker compose --profile tools run --rm db-seed

# Browser: http://localhost:3000 → super.admin@renis.bi / SuperAdmin123!

# TYPO3: http://localhost:8082 → install wizard → then:
docker compose exec typo3 php vendor/bin/typo3 renis_auth:sync-backend-users
sh infrastructure/typo3/apply-verify-extension.sh
```
