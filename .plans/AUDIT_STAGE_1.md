# Stage 1 — Infrastructure & Build Pipeline
**Session:** 2026-05-26
**Status:** ⚠️ Findings found

---

## Findings Summary

| # | Finding | File | Severity |
|---|---------|------|----------|
| 1 | Duplicate `.env` files with divergent `DATABASE_PATH` values | `/.env` vs `/server/.env` | **HIGH** |
| 2 | `.env.template` missing fields present in actual `.env` | `/.env.template` | MEDIUM |
| 3 | Two backup directories with 100+ files, no rotation policy | `/backups/` + `/server/backups/` | MEDIUM |
| 4 | CORS configured with `origin: '*'` | `/server/server.js:13` | MEDIUM |
| 5 | Body parser limit at 50mb on both json and urlencoded | `/server/server.js:20-21` | LOW |
| 6 | No Helmet, rate limiting, or compression middleware | `/server/server.js` | MEDIUM |
| 7 | Backup runs synchronously before server starts (blocks startup) | `/server/server.js:151-152` | LOW |
| 8 | Request logging logs all URLs including sensitive paths | `/server/server.js:24-27` | LOW |
| 9 | Server `.env` has `DATABASE_PATH` empty (defaults to `server/calendarly.db`) but root `.env` has Docker path | `/server/.env:15` | **HIGH** |
| 10 | 94 backup files in `/server/backups/` — no cleanup/retention policy | `/server/backups/` | MEDIUM |
| 11 | 12 manual backup `.bak` files in root `/backups/` — origin unknown | `/backups/` | LOW |
| 12 | `opencode-cache` volume mounted `:ro` (read-only) in Docker — write operations will fail | `/docker-compose.yml:14` | MEDIUM |
| 13 | `.env.template` missing several fields vs actual `.env` (AGENTS_API_URL, GEMINI_* vars) | `/.env.template` | LOW |
| 14 | `graphify-out/` in `.gitignore` — graph does not survive fresh clone | `/.gitignore:102` | INFO |
| 15 | No `npm run lint` or typecheck script in any package.json | All 3 package.json files | LOW |

---

## Docker Compose

**Structure:**
- 2 services: `backend`, `frontend`
- 1 named volume: `db-data` (local driver)
- Both services load from `.env` file at project root
- Backend: port 3000, DB volume + backup bind mount + opencode-cache (ro) + OPENCLAW_MCP.md (ro)
- Frontend: port 5173, depends_on backend, sets `VITE_BACKEND_URL=http://backend:3000`

**Issues found:**
1. `opencode-cache` mounted `:ro` — if the server tries to write to this cache, it will fail silently or crash
2. No healthcheck defined on either service
3. No network constraints or internal-only exposure
4. `restart: unless-stopped` on both services — reasonable for production
5. No resource limits (memory/cpu)

---

## Dockerfiles

**Backend** (`server/Dockerfile`):
- Base: `node:20-bullseye` (includes build-essential for sqlcipher native compilation)
- Installs `libssl1.1` for openssl compatibility
- Copies `package*.json` before source code (layer caching optimization) ✅
- `CMD ["npm", "start"]` — runs `node server.js`

**Frontend** (`client/Dockerfile`):
- Multi-stage build ✅
- Stage 1: `node:20` builder — `npm install` + `npm run build`
- Stage 2: `nginx:alpine` — serves `dist/` via custom `nginx.conf`
- Exposes port 5173

**Issues:**
- None critical. Multi-stage is correct. Layer caching is used.

---

## Nginx Config

- Listens on port 5173
- `client_max_body_size 100M` — allows large uploads (graphify archives)
- SPA fallback: `try_files $uri $uri/ /index.html` ✅
- API proxy: `/api` → `http://backend:3000` with standard proxy headers
- `proxy_read_timeout 300s` — long timeout for integrity checks

**No issues found.** Config is clean and correct for Docker deployment.

---

## Vite Config

- Uses `@vitejs/plugin-react`
- Dev server on port 5173, `host: true` (accessible on network)
- Dev proxy: `/api` → `VITE_BACKEND_URL` or `http://localhost:3000`
- Loads all env vars via `loadEnv(mode, process.cwd(), '')`

**No issues found.** Standard Vite React config.

---

## Environment Configuration Drift

### `.env` files found (2):

| File | DATABASE_PATH | DB_ENCRYPTION_KEY |
|------|--------------|-------------------|
| `/.env` | `/data/calendarly.db` | (set — 512-char hex key) |
| `/server/.env` | *(empty)* → defaults to `server/calendarly.db` | (same key) |

**Issue:** The root `.env` sets `DATABASE_PATH=/data/calendarly.db` (Docker path) while `server/.env` leaves it empty (local path). When running locally via `npm run server`, the server loads `server/.env` (via `dotenv.config({ path: path.resolve(__dirname, '.env') })` in `server.js:3`) and will create/use `server/calendarly.db`. When running via Docker, the root `.env` is used and the database path is `/data/calendarly.db`. This is **intentional** but could cause confusion — a developer running `npm start` locally gets a different database than one running `docker-compose up`.

### `.env.template` missing fields:
Actual `.env` has these fields NOT in `.env.template`:
- `AGENTS_API_URL`
- `GEMINI_EXTERNAL_STATS_API`
- `GEMINI_AGENT_NAME`
- `GEMINI_TELEMETRY_ENABLED`
- `GEMINI_TELEMETRY_OTLP_ENDPOINT`

---

## `.gitignore` Coverage

**Covered:**
- `node_modules/`, `dist/`, build artifacts ✅
- `.env`, `.env.*`, `.env.*.local` ✅
- `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`, `*.sqlite`, `*.sqlite3` ✅
- `backups/`, `server/backups/` ✅
- `graphify-out/` ✅
- Editor/IDE files, OS junk ✅
- AI agent cache dirs (.claude, .cursor, .opencode, etc.) ✅

**Not covered / notes:**
- `server/opencode-cache/*` is listed but without `!server/opencode-cache/.gitkeep`

---

## Server Bootstrap (server.js)

**Middleware order (pipeline):**
1. `dotenv.config()` — load env
2. `cors({ origin: '*' })` — wide open
3. `express.json({ limit: '50mb' })`
4. `express.urlencoded({ limit: '50mb', extended: true })`
5. Request logger (console.log with ISO timestamp)
6. Route mounting (16 routers + health/integrity/mcp endpoints)
7. Global error handler

**Route mount count:** 16 routers + 3 inline endpoints (health, integrity-check, mcp)

**Startup sequence:**
1. `runBackup()` — **sync** backup before DB init
2. `initDatabase(false)` — **await** schema init (false = don't reset)
3. `app.listen(PORT)` — start listening

**Issues:**
- **HIGH:** CORS `origin: '*'` allows any website to make API calls (intentional for local dev, but problematic if exposed)
- **MEDIUM:** Body parser at 50mb on both json and urlencoded — potential memory pressure
- **MEDIUM:** No Helmet security headers
- **MEDIUM:** No rate limiting on any endpoint
- **LOW:** Backup runs synchronously before server listens — startup delay, DB locked during backup
- **LOW:** Request logger logs all URLs including `/api/settings/env` which could contain sensitive data in query params
- **INFO:** `integrity-check` endpoint lazily requires the checker module on each call (line 79) — not a bug, but unusual pattern

---

## Scripts Analysis

**`server/scripts/` (5 files):**

| File | Purpose | Notes |
|------|---------|-------|
| `backfill-event-colors.js` | Backfill color data on events | Utility script |
| `census-backups.js` | Census of backup files | Audit tool |
| `import-claude-sessions.js` | Import Claude AI sessions | Data import |
| `inspect-measure-events.js` | Inspect measure column events | Debug tool |
| `parse-description-fields.js` | Parse description fields | Data migration utility |

**Orphan migration:** No `migration-001.js` found in the codebase — earlier graph analysis was a false positive. All 5 scripts are one-off utilities, not part of the schema migration system.

---

## Graphify Cross-Reference

**Infrastructure-related nodes in graph:** 74 nodes found

**Key communities impacted:**
- Community 5 (server package.json + dependencies)
- Community 8 (client package.json + dependencies)
- Community 12 (root package.json)
- Community 0 (Docker, nginx, high-level architecture)

**Graph freshness:** Built at commit `41d70fd3`. Current HEAD is `67e633e` — graph is **stale** (needs `graphify update .` to capture latest changes).

---

## Next Stage Handoff

### Priority items for Stage 2 (Database Layer):
1. Confirm which `.env` DATABASE_PATH is authoritative for local development
2. Resolve opencode-cache write permissions issue if relevant
3. Note that CORS/security findings will be detailed in Stage 8

### Unresolved questions:
1. Are the 12 backup files in root `/backups/` still needed or can they be cleaned up?
2. Is the `libssl1.1` dependency in the server Dockerfile still required for the `node:20-bullseye` base image?
