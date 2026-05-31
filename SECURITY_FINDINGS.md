# Security Audit & Remediation — CalendarlyStarter

**Date:** 2026-05-31
**Scope:** Full recursive audit of the repository (server routes, client, docs, git history, env handling, Docker) with a focus on preventing exposure of personal data (therapy journals, people, personal-care, notes, daily logs).

---

## Summary

The repository's **git hygiene was already solid** — no secrets or databases were ever committed, and `.env`/DBs/backups/agent caches are correctly ignored. The real risk was at **runtime**: the API served deeply personal data with **no authentication**. That is now fixed.

---

## Findings & Remediation

### 1. 🔴 CRITICAL — No authentication on any API route *(FIXED)*
Every endpoint (`/api/therapy`, `/api/people`, `/api/personal-care`, `/api/daily-logs`, `/api/notes`, `/api/activity-energy-log`, …) was fully readable/writable by anyone who could reach the port. The "local-first" assumption fails the moment the app is exposed via Docker port-mapping, nginx, LAN, or a `0.0.0.0` bind.

**Fix:**
- Added `server/middleware/auth.js` — a shared-token gate (`Authorization: Bearer <token>` or `x-api-key`), constant-time compare via `crypto.timingSafeEqual`, **fails closed** (503) if `API_AUTH_TOKEN` is unset.
- Applied `app.use('/api', requireApiToken)` ahead of all routers in `server/server.js`.
- Client attaches the token (`client/src/utils/api/core.js`); a new `AuthGate` (`client/src/components/AuthGate.jsx`) prompts for it once and stores it in `localStorage` — **the token is never baked into the bundle**, so loading the page does not grant access. A `401` clears the token and re-prompts.

### 2. 🟠 HIGH — Information disclosure via `/api/mcp` and `/api/health` *(FIXED)*
`/api/mcp` publicly served the full API catalog and advertised "runs without authentication"; `/api/health` leaked `NODE_ENV`.

**Fix:** `/api/mcp` is now behind the auth gate. The public liveness probe returns only `{status, timestamp}` (no env). `OPENCLAW_MCP.md` updated to document the new auth requirement.

### 3. 🟠 HIGH — Unauthenticated destructive endpoint *(FIXED)*
`GET /api/health/integrity-check` could trigger a DB restore/overwrite from backup and echoed DB internals.

**Fix:** Now sits behind the auth gate (declared after `app.use('/api', requireApiToken)`).

### 4. 🟡 MEDIUM — Upload zip-slip check ran *after* extraction *(FIXED)*
`decompress()` wrote every entry to disk before the path-traversal check, so a malicious entry could escape `graphify-out/` before detection.

**Fix:** `server/routes/upload.js` now uses a `decompress` `filter` that rejects out-of-bounds entries **before** they are written, with a post-extraction re-check as defense-in-depth.

### 5. 🟡 MEDIUM — Error/credential handling in upload *(FIXED)*
Returned `error.message` (filesystem path disclosure); password compared with timing-unsafe `!==`.

**Fix:** Generic `{ error: 'Failed to extract archive.' }`; password now uses `safeEqual` (timing-safe).

### 6. 🟡 MEDIUM — Default upload password *(FIXED)*
`SECRET_UPLOAD_PASSWORD` was the literal placeholder `change-me-in-production`.

**Fix:** Replaced with a generated high-entropy value in `.env` (local only).

### 7. ⚪ LOW — Permissive dev CORS *(FIXED)*
Dev CORS reflected every origin (`*`).

**Fix:** Dev now only allows loopback origins (`localhost`/`127.0.0.1`, any port); production keeps the explicit `ALLOWED_ORIGINS` allowlist.

---

## Verified clean (no action needed)
- **Git history:** no `.env`, `.db`, `.sqlite`, `.key`, or `.pem` ever committed; `.env.template` uses placeholders only.
- **SQL:** parameterized throughout; dynamic `UPDATE`/`WHERE` clauses built from hardcoded column allowlists — not user input.
- **`child_process` (`opencode.js`):** binary path comes from a fixed candidate list, not user input.
- **Docker:** backend bound to `127.0.0.1:3000`; `cap_drop: ALL`, `no-new-privileges`.
- **Headers:** `helmet` with CSP, HSTS, strict referrer policy; rate limiting on all `/api` and stricter on uploads.

---

## Operational notes
- Set `API_AUTH_TOKEN` in every environment (server `.env`). Generate with:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- On first load each browser/device must enter the token once (stored in `localStorage`).
- **DB encryption key** (`DB_ENCRYPTION_KEY`) lives only in the gitignored `.env`. If it ever leaks, rotate it and re-encrypt the database.

## Recommended follow-ups (not yet done)
- Consider moving planning docs that describe the personal-data model (`PERSONAL_CARE_DASHBOARD_PLAN.md`) out of the tracked tree if the repo may ever be made public.
- Add a pre-commit secret scanner (e.g. `gitleaks`) to prevent future `.env`/key commits.
- If the app is ever exposed beyond loopback, terminate TLS at nginx and set `ALLOWED_ORIGINS` explicitly.
