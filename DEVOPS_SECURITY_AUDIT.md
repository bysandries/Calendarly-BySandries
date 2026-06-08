# DevOps Security & Configuration Audit Report

**Project:** Calendarly-BySandries  
**Auditor:** Senior DevOps Security Engineer (OpenCode)  
**Date:** 2026-06-08  
**Scope:** Full repository — secrets, configuration modularization, IaC (Docker/Compose), Git hygiene, reversibility.

---

## Executive Summary

| Category | Critical | High | Medium | Low/Info |
|----------|----------|------|--------|----------|
| Secret Scanning | 3 | 0 | 1 | 1 |
| Config Modularization | 0 | 0 | 5 | 1 |
| IaC Sanity | 2 | 3 | 2 | 0 |
| Git Hygiene | 0 | 0 | 1 | 5 |

**Overall Risk:** **HIGH** — Two critical IaC/container issues (`seccomp:unconfined`, excessive capabilities) and active plaintext secrets in the working directory create immediate exposure risk if the host is compromised or an image is accidentally pushed to a registry.

**Good news:** Git hygiene is excellent. No real secrets were ever committed to the repository history. `.gitignore`, `.dockerignore`, and `.gitleaks.toml` are all present and largely correct.

---

## 1. Secret Scanning

### 🔴 CRITICAL-1 — Real `DB_ENCRYPTION_KEY` in working-directory `.env` files

**Finding:** Both `/root/Calendarly-BySandries/.env` and `/root/Calendarly-BySandries/server/.env` contain a 512-byte hex `DB_ENCRYPTION_KEY`. While these files are correctly listed in `.gitignore` and are **not tracked by git**, they sit as plaintext on disk and are mounted into Docker containers via `env_file: - .env` in `docker-compose.yml`. This means:

- Any user or process with host filesystem access can read the encryption key.
- The secret is injected at container runtime (not baked into the image), which is good, but it is still stored unencrypted on the host.
- There is no `.env` rotation history or secret-management integration (e.g., Docker Secrets, HashiCorp Vault, AWS Secrets Manager).

**Remediation (Reversible):**

1. Rotate the key immediately:
   ```bash
   # BACKUP current .env files
   cp .env .env.$(date +%Y%m%d_%H%M%S).bak
   cp server/.env server/.env.$(date +%Y%m%d_%H%M%S).bak

   # Generate a new high-entropy key
   node -e "console.log(require('crypto').randomBytes(256).toString('hex'))"

   # Replace DB_ENCRYPTION_KEY in both .env files with the new value
   # Then re-encrypt the database (export → create new encrypted DB → import)
   ```

2. Revert if the app breaks:
   ```bash
   # Restore from backup
   cp .env.<timestamp>.bak .env
   cp server/.env.<timestamp>.bak server/.env
   docker-compose restart backend
   ```

**Note:** `.env` files were **never committed** to git history (verified with `git log --all --full-history -- .env`). No `git rm --cached` or history rewriting is required.

---

### 🔴 CRITICAL-2 — Persisted API token on disk (`server/.api_auth_token`)

**Finding:** `server/.api_auth_token` contains a real 64-character hex token. It is correctly ignored by `.gitignore` (`**/.api_auth_token`), but it is readable on disk (`mode` is not enforced in the current working directory, though the auth middleware writes it with `0o600` at creation time).

**Remediation (Reversible):**

1. Rotate the token:
   ```bash
   # Backup
   cp server/.api_auth_token server/.api_auth_token.bak

   # Delete the old file; the server will auto-generate a new one on next start
   rm server/.api_auth_token

   # Or set an explicit API_AUTH_TOKEN in .env and delete the persisted file
   ```

2. Revert:
   ```bash
   cp server/.api_auth_token.bak server/.api_auth_token
   docker-compose restart backend
   ```

3. Harden persistence:
   ```bash
   chmod 600 server/.api_auth_token
   ```

---

### 🔴 CRITICAL-3 — `SECRET_UPLOAD_PASSWORD` uses known placeholder in root `.env`

**Finding:** `/root/Calendarly-BySandries/.env` sets:
```
SECRET_UPLOAD_PASSWORD=change-me-in-production
```
This is a documented, known placeholder string. If the upload endpoint (`/api/upload/graphify`) is reachable, an attacker can guess this password. The `.env.template` uses the same placeholder, but the **live `.env`** should never retain it.

**Remediation (Reversible):**

1. Generate and set a strong password:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   # Paste the output into .env as SECRET_UPLOAD_PASSWORD
   ```

2. Revert:
   ```bash
   # Restore from a backup of .env (see CRITICAL-1)
   ```

---

### 🟡 MEDIUM-1 — Self-signed SSL material in working directory

**Finding:** `browser-data/ssl/cert.key` and `browser-data/ssl/cert.pem` exist. This directory is correctly ignored by `.gitignore` (`browser-data/`), so the files are not tracked. They are local browser container artifacts.

**Action:** No action required unless the repository is cloned to a shared host. If so, add `browser-data/ssl/*.key` to `.gitignore` (already covered by `browser-data/`) and ensure the directory has `chmod 700`.

---

### 🟢 LOW-1 — Git history is clean of real secrets

**Verification:**
```bash
git log --all --full-history -S "823f05b3b3397e8eecf1615247eecac99b4aaf77"
# No commits found — the current real key was never committed.

git log --all -p -S "DB_ENCRYPTION_KEY" -- "*.env" "*.template"
# Only shows the placeholder value "your-super-secure-high-entropy-passphrase".
```

**Gitleaks:** The repository already has `.gitleaks.toml` with sensible allowlists. Run:
```bash
npm run secrets:scan
```

---

## 2. Config Modularization

### 🟡 MEDIUM-2 — Hardcoded Vite dev server port and host

**File:** `client/vite.config.js`
```js
server: {
  port: 5173,
  host: true,
  // ...
}
```

**Impact:** Cannot run multiple client instances or override port without editing source.

**Refactored snippet:**
```js
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_DEV_PORT, 10) || 5173,
      host: env.VITE_DEV_HOST || '127.0.0.1',
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
```

**Update `.env.template`:**
```bash
# --- Vite Dev Server ---
VITE_DEV_PORT=5173
VITE_DEV_HOST=127.0.0.1
```

**Revert:** Restore the original `vite.config.js` from git:
```bash
git checkout -- client/vite.config.js
```

---

### 🟡 MEDIUM-3 — Hardcoded Nginx listen port

**File:** `client/nginx.conf`
```
listen 5173;
server_name localhost;
```

**Impact:** Cannot configure via environment at runtime because nginx config is static in the image.

**Refactored snippet (use envsubst at container startup):**

Replace `client/nginx.conf` with `client/nginx.conf.template`:
```nginx
server {
    listen ${NGINX_PORT};
    server_name ${NGINX_HOST};
    ...
}
```

Update `client/Dockerfile`:
```dockerfile
# Stage 2
FROM nginx:alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
EXPOSE ${NGINX_PORT}
CMD ["/bin/sh", "-c", "envsubst '\$NGINX_PORT \$NGINX_HOST \$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```

Add to `client/.env` / `docker-compose.yml`:
```yaml
environment:
  - NGINX_PORT=5173
  - NGINX_HOST=localhost
  - BACKEND_URL=http://backend:3000
```

**Revert:**
```bash
git checkout -- client/Dockerfile client/nginx.conf
```

---

### 🟡 MEDIUM-4 — Hardcoded rate limits and body-parser limits

**File:** `server/server.js`
```js
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, ... });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, ... });
app.use(express.json({ limit: '50mb' }));
```

**Refactored snippet:**
```js
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 500,
  ...
});
const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.UPLOAD_LIMIT_WINDOW_MS, 10) || 60 * 60 * 1000,
  max: parseInt(process.env.UPLOAD_LIMIT_MAX, 10) || 20,
  ...
});
app.use(express.json({ limit: process.env.BODY_JSON_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: process.env.BODY_URLENCODED_LIMIT || '50mb', extended: true }));
```

**Revert:**
```bash
git checkout -- server/server.js
```

---

### 🟡 MEDIUM-5 — Hardcoded SQLite pragmas

**File:** `server/db.js`
```js
await db.run('PRAGMA journal_mode = WAL');
await db.run('PRAGMA synchronous = NORMAL');
await db.run('PRAGMA busy_timeout = 5000');
await db.run('PRAGMA wal_autocheckpoint = 1000');
```

**Refactored snippet:**
```js
await db.run(`PRAGMA journal_mode = ${process.env.DB_JOURNAL_MODE || 'WAL'}`);
await db.run(`PRAGMA synchronous = ${process.env.DB_SYNCHRONOUS || 'NORMAL'}`);
await db.run(`PRAGMA busy_timeout = ${parseInt(process.env.DB_BUSY_TIMEOUT, 10) || 5000}`);
await db.run(`PRAGMA wal_autocheckpoint = ${parseInt(process.env.DB_WAL_AUTOCHECKPOINT, 10) || 1000}`);
```

**Revert:**
```bash
git checkout -- server/db.js
```

---

### 🟢 LOW-2 — Hardcoded personal URL in Chromium container startup

**File:** `docker-compose.yml`
```yaml
CHROME_CLI=--no-first-run ... --start-maximized https://github.com/bysandries
```

**Impact:** Personal branding URL baked into the Docker Compose manifest. Not a secret, but not environment-agnostic.

**Remediation:**
```yaml
environment:
  - CHROME_CLI=${CHROME_CLI:-"--no-first-run --no-default-browser-check --disable-sync --start-maximized about:blank"}
```

**Revert:**
```bash
git checkout -- docker-compose.yml
```

---

## 3. Infrastructure as Code (IaC) Sanity

### 🔴 CRITICAL-4 — `seccomp:unconfined` on Chromium browser container

**File:** `docker-compose.yml`
```yaml
chromium:
  security_opt:
    - seccomp:unconfined
```

**Impact:** Disables the seccomp syscall filter sandbox for the browser. This is one of the most dangerous Compose flags. A compromised Chromium process has unrestricted kernel access.

**Remediation:**
```yaml
chromium:
  security_opt:
    - seccomp:/path/to/chromium-seccomp.json  # use a custom, permissive-but-not-empty profile
```

Or, if the browser genuinely cannot start without it, document the risk and restrict the Compose profile:
```yaml
profiles: ["browser"]   # only start when explicitly requested
```

**Revert:**
```bash
git checkout -- docker-compose.yml
```

---

### 🔴 CRITICAL-5 — Excessive Linux capabilities granted to backend and frontend

**File:** `docker-compose.yml`
```yaml
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - DAC_OVERRIDE
  - FOWNER
  - SETUID
  - SETGID
  - NET_BIND_SERVICE
```

**Impact:** `CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `SETUID`, and `SETGID` are extremely powerful. They allow the container to change file ownership, bypass permission checks, and escalate privileges. A Node.js app binding to port 3000/5173 does **not** need any of these.

**Remediation:**
```yaml
cap_drop:
  - ALL
cap_add:
  # Node runs as non-root and binds to high ports; nothing needed.
  # If you ever bind to <1024 inside the container, add only NET_BIND_SERVICE.
```

**Revert:**
```bash
git checkout -- docker-compose.yml
```

---

### 🟠 HIGH-1 — Backend and frontend containers run as root

**Files:** `server/Dockerfile`, `client/Dockerfile`

**Finding:** Neither Dockerfile specifies a `USER` directive. The server image runs Node as root. The client image uses `nginx:alpine`, which in recent versions does drop to the `nginx` user, but it is not explicit.

**Remediation for `server/Dockerfile`:**
```dockerfile
FROM --platform=linux/amd64 node:20-bullseye

RUN apt-get update && \
    apt-get install -y --no-install-recommends libssl1.1 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create a non-root user
RUN groupadd -r calendarly && useradd -r -g calendarly calendarly
RUN chown -R calendarly:calendarly /usr/src/app
USER calendarly

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
```

**Remediation for `client/Dockerfile`:**
```dockerfile
# Stage 2
FROM nginx:alpine
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
USER nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Revert:**
```bash
git checkout -- server/Dockerfile client/Dockerfile
```

---

### 🟠 HIGH-2 — Frontend port exposed on all interfaces

**File:** `docker-compose.yml`
```yaml
frontend:
  ports:
    - "5173:5173"
```

**Finding:** Unlike the backend (`127.0.0.1:3000:3000`), the frontend binds to `0.0.0.0:5173`. On a multi-homed host or if Docker exposes ports to the LAN, this bypasses the intended localhost-only access.

**Remediation:**
```yaml
frontend:
  ports:
    - "127.0.0.1:5173:5173"
```

**Revert:**
```bash
git checkout -- docker-compose.yml
```

---

### 🟠 HIGH-3 — No container resource limits

**File:** `docker-compose.yml`

**Finding:** No `mem_limit`, `cpus`, or `deploy.resources` constraints are defined. A memory leak or runaway process can destabilize the Docker host.

**Remediation:**
```yaml
services:
  backend:
    mem_limit: 512m
    cpus: '1.0'
  frontend:
    mem_limit: 256m
    cpus: '0.5'
  chromium:
    mem_limit: 2g
    cpus: '1.0'
```

**Revert:**
```bash
git checkout -- docker-compose.yml
```

---

### 🟡 MEDIUM-6 — Large base image for backend (`node:20-bullseye`)

**File:** `server/Dockerfile`

**Finding:** `node:20-bullseye` is a full Debian image (~1 GB). It includes many packages not needed for a Node/Express app, increasing the CVE surface area.

**Recommendation:** Evaluate migrating to `node:20-alpine` or `node:20-slim` after testing `libssl` compatibility with `@journeyapps/sqlcipher`.

**Revert:**
```bash
git checkout -- server/Dockerfile
```

---

## 4. Git Hygiene

### 🟢 GOOD — `.gitignore` is comprehensive

**Verified clean:**
- `.env`, `.env.*.local` — ignored and **not tracked** (verified via `git ls-files`).
- `node_modules/` — ignored and **not tracked**.
- `dist/`, `build/`, `.cache/` — ignored and **not tracked**.
- `*.db`, `*.sqlite`, `*.sqlite3` — ignored and **not tracked**.
- `backups/`, `server/backups/` — ignored. The `backups/` directory contains `.db.bak` files but they are correctly excluded.
- `graphify-out/`, `browser-data/`, `.claude/`, `server/opencode-cache/`, `server/attachments/` — all ignored and **not tracked**.

### 🟢 GOOD — `package-lock.json` files are tracked

All three `package-lock.json` files (`root`, `client`, `server`) are tracked. This is correct for reproducible builds.

### 🟢 GOOD — `.dockerignore` present and correct

Both `client/.dockerignore` and `server/.dockerignore` exclude:
- `node_modules`
- `.env`, `.env.*`
- `*.db`, `*.sqlite*`
- `dist/`, `build/`

This prevents secrets and local build artifacts from being baked into images.

### 🟡 MEDIUM-7 — Unnecessary planning documents tracked

**Finding:** `PERSONAL_CARE_DASHBOARD_PLAN.md`, `UI_DESIGN_SYSTEM.md`, `OPENCLAW_MASTER_PROMPT.md`, and `OPENCLAW_MCP.md` describe the personal-data model, schema, and internal API design. If this repository is ever made public, these documents leak architectural details.

**Remediation:** If transitioning to a public repo, move these to a private wiki or docs repo:
```bash
mkdir -p ../calendarly-private-docs
git mv PERSONAL_CARE_DASHBOARD_PLAN.md UI_DESIGN_SYSTEM.md OPENCLAW_MASTER_PROMPT.md OPENCLAW_MCP.md ../calendarly-private-docs/
# Commit the deletions
git commit -m "docs: move internal planning docs to private repo"
```

**Revert:**
```bash
git revert HEAD
```

---

## 5. Reversibility Command Reference

| Change | Revert Command |
|--------|---------------|
| Rotate `.env` secrets | `cp .env.<timestamp>.bak .env && cp server/.env.<timestamp>.bak server/.env` |
| Delete `server/.api_auth_token` | `cp server/.api_auth_token.bak server/.api_auth_token` |
| Modify `client/vite.config.js` | `git checkout -- client/vite.config.js` |
| Modify `client/nginx.conf` / `Dockerfile` | `git checkout -- client/nginx.conf client/Dockerfile` |
| Modify `server/server.js` | `git checkout -- server/server.js` |
| Modify `server/db.js` | `git checkout -- server/db.js` |
| Modify `docker-compose.yml` | `git checkout -- docker-compose.yml` |
| Modify `server/Dockerfile` | `git checkout -- server/Dockerfile` |
| Move planning docs out | `git revert <commit-sha>` |

---

## 6. Immediate Action Checklist

1. [ ] Rotate `DB_ENCRYPTION_KEY` and re-encrypt the database.
2. [ ] Rotate `API_AUTH_TOKEN` (or delete `server/.api_auth_token` to force regeneration).
3. [ ] Change `SECRET_UPLOAD_PASSWORD` from `change-me-in-production` to a strong random string.
4. [ ] Remove `seccomp:unconfined` from the `chromium` service or restrict it to an explicit profile.
5. [ ] Strip all unnecessary `cap_add` capabilities from `backend` and `frontend` in `docker-compose.yml`.
6. [ ] Bind frontend port to `127.0.0.1:5173:5173`.
7. [ ] Add `USER` directives and `HEALTHCHECK` to `server/Dockerfile`.
8. [ ] Add resource limits (`mem_limit`, `cpus`) to `docker-compose.yml`.
9. [ ] Run `npm run secrets:scan` to verify no new leaks.
10. [ ] Evaluate moving internal planning `.md` files to a private documentation repository before any public release.

---

*End of Report*
