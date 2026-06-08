# Calendarly — Continuous Audit

> Living document. Each section is independently auditable.
> **Legend**: `[x]` resolved, `[ ]` open, `[~]` partial / in progress.

---

## 1. Security

### 1.1 Authentication & Authorization

- [ ] **TODO: Token lives forever in localStorage** — The API token stored via `localStorage` never expires. A single XSS or shared-browser session permanently compromises the token. Add a server-side token TTL with periodic refresh, or switch to `httpOnly` session cookies that the browser cannot read via JS.
  - Files: `client/src/utils/api/core.js`, `server/middleware/auth.js`
  - _Skipped (2026-06-05): requires an architectural decision between httpOnly session cookies and server-side TTL+refresh. Needs explicit user/team input before implementation._
- [ ] **TODO: No per-user identity** — The single shared `API_AUTH_TOKEN` cannot distinguish between users. If household/team use is a goal, add per-user accounts (even simple username + bcrypt password) so audit logs show _who_ performed each action.
  - Files: `server/middleware/auth.js`, `client/src/components/AuthGate.jsx`
  - _Skipped (2026-06-05): requires full user-account system (registration, bcrypt storage, session management). Too large and requires user decisions about scope before implementation._
- [x] **TODO: Token printed to stdout on every startup** — When the token source is `file` or `generated`, it is logged to the console in plaintext. In containerised deployments this ends up in Docker logs accessible to anyone with `docker logs` access. Mask or suppress the token after first run.
  - File: `server/server.js:234`
- [ ] **TODO: AuthGate accepts any token client-side** — `AuthGate` only checks that _a_ token exists in localStorage; it doesn't verify it against the server before rendering the app. A stale or wrong token shows the full UI until the first API call returns 401. Add a lightweight `/api/auth/verify` probe on mount.
  - File: `client/src/components/AuthGate.jsx:11`

### 1.2 Input Validation & Injection

- [ ] **TODO: No server-side input validation library** — Route handlers destructure `req.body` fields and pass them directly to SQL queries via parameterized statements (safe from SQL injection), but there is no schema validation. Malformed or oversized payloads are accepted silently. Add a lightweight validator (e.g. `zod`, `joi`, or `express-validator`) to assert types, lengths, and required fields at the boundary.
  - Files: all `server/routes/*.js`
- [ ] **TODO: `PRAGMA table_info` uses string interpolation for table names** — `addColumnIfMissing()` interpolates the `table` parameter directly into a PRAGMA statement. Although callers only pass hardcoded strings today, this is a latent SQL injection vector if the function is ever called with user input. Use a whitelist check or validate against `sqlite_master`.
  - File: `server/db.js:50`
- [ ] **TODO: Event `notes` field has no length cap** — The `notes` column on events, tasks, and daily logs accepts unbounded text. A single POST with a 50 MB JSON body (within the Express limit) can bloat the database. Add per-field max lengths server-side.
  - Files: `server/routes/events.js`, `server/routes/tasks.js`, `server/routes/dailyLogs.js`
- [ ] **TODO: YAML frontmatter in export is not escaped** — The export route writes note titles and extract bibliographies directly into YAML frontmatter without quoting. A title containing `:` or `\n` produces invalid YAML. Wrap values in quotes or use a YAML serializer.
  - File: `server/routes/export.js:53-58`

### 1.3 XSS & Client-Side Injection

- [ ] **TODO: `DayPlannerPanel` uses `innerHTML` without sanitization** — Content loaded from the API is set via `editorRef.current.innerHTML = markdownToHtml(...)`. The `markdownToHtml` function passes through raw HTML if the input starts with `<`, meaning any stored HTML (e.g. from a compromised DB or API) is rendered unsanitized. Use DOMPurify before assigning to `innerHTML`.
  - Files: `client/src/components/DayPlannerPanel.jsx:186`, `client/src/utils/mdEditor.js:21`
- [ ] **TODO: `htmlToMarkdown` creates a detached DOM node with `innerHTML`** — `document.createElement('div').innerHTML = html` executes inline event handlers in some browser contexts. Use DOMParser or DOMPurify instead.
  - File: `client/src/utils/mdEditor.js:137`

### 1.4 Docker & Infrastructure

- [ ] **TODO: Chromium container runs with `seccomp:unconfined`** — This disables all Seccomp syscall filtering for the entire container. While Chromium needs some relaxed syscalls, a custom seccomp profile (e.g. Chrome's upstream `chrome.json`) would be significantly safer than blanket `unconfined`.
  - File: `docker-compose.yml:85`
- [ ] **TODO: Server Dockerfile installs as root with no user switch** — The backend container runs as PID 1 root. If an attacker achieves RCE through a Node.js vulnerability, they have root inside the container. Add `USER node` after `npm install`.
  - File: `server/Dockerfile`
- [ ] **TODO: `browser-data/` volume exposes Chromium profile to host** — The Chromium profile (cookies, history, saved passwords) is bind-mounted at `./browser-data/`. If the host filesystem is shared or backed up, browser credentials leak. Consider using a named Docker volume instead, or document the sensitivity.
  - File: `docker-compose.yml:74`
- [ ] **TODO: No network isolation between Chromium and backend** — The Chromium container is on the same Docker network as the backend. A compromised browser can reach the Express API directly (port 3000 internally). Consider putting Chromium on a separate network with only the frontend accessible.
  - File: `docker-compose.yml`

### 1.5 Secrets & Encryption

- [ ] **TODO: `DB_ENCRYPTION_KEY` passed via environment variable** — Environment variables are visible in `/proc/PID/environ`, `docker inspect`, and process listings. For production, prefer Docker secrets or a mounted file with restricted permissions.
  - Files: `docker-compose.yml`, `.env.template`
- [ ] **TODO: PRAGMA rekey uses `JSON.stringify` quoting** — The settings route constructs `PRAGMA rekey = ${JSON.stringify(newKey)}`. While `JSON.stringify` produces valid SQL string literals for most inputs, edge cases (e.g. null bytes, backslashes) could produce unexpected behavior. Use parameterized binding or explicit SQL quoting.
  - File: `server/routes/settings.js:197`
- [ ] **TODO: `.env` file is writable via API** — The `POST /api/settings/env` endpoint writes arbitrary key-value pairs to the server's `.env` file and syncs them into `process.env`. This allows an authenticated attacker to overwrite `DATABASE_PATH`, `PORT`, or any environment variable. Whitelist allowed keys.
  - File: `server/routes/settings.js:177-219`
- [ ] **TODO: Backup download endpoint has no rate limiting** — `GET /api/settings/backup/download` triggers a `runBackup()` (disk I/O) and serves the file. The general API rate limiter (500/15min) applies, but a dedicated tighter limit would prevent disk abuse.
  - File: `server/routes/settings.js:223`

### 1.6 Transport & Headers

- [ ] **TODO: CSP `frameSrc` set to `'none'` but app embeds iframe** — The Helmet CSP sets `frameSrc: ["'none'"]`, which should block the Chromium iframe at `/browser/`. This works because the CSP is only set on the Express API (port 3000), not the Nginx-served frontend. Document this explicitly or align the CSP across both servers.
  - File: `server/server.js:27`
- [ ] **TODO: No `Strict-Transport-Security` on Nginx** — The backend sets HSTS via Helmet, but the Nginx frontend (which users actually hit) does not set the header. Add `add_header Strict-Transport-Security ...` to the Nginx config for HTTPS deployments.
  - File: `client/nginx.conf`
- [ ] **TODO: `Permissions-Policy` header is overly broad** — Nginx sets `clipboard-read=*, clipboard-write=*` for all origins. Restrict to `self` to prevent third-party origins from accessing the clipboard.
  - File: `client/nginx.conf:6`

---

## 2. User Experience (UX)

### 2.1 Onboarding & First-Run

- [ ] **TODO: No guided onboarding flow** — New users land on an empty GTD inbox with no indication of what the app does. Add a first-run welcome modal or guided tour highlighting the PALM methodology, key pages, and the `G` capture shortcut.
- [ ] **TODO: Token entry UX is confusing** — The AuthGate says "Enter your access token" but doesn't explain where to find it. Add a hint like "Check your server startup logs or run `docker logs calendarly-backend`."
  - File: `client/src/components/AuthGate.jsx:47`

### 2.2 Navigation & Discovery

- [ ] **TODO: No breadcrumb navigation** — Nested pages (e.g. Project → Task → Note) have no breadcrumbs. Users rely on the back button. Add breadcrumbs to detail pages for spatial orientation.
- [ ] **TODO: Workspace tab state not visible in URL** — The active workspace tab is stored in `localStorage` but not reflected in the URL. This means browser back/forward doesn't switch tabs, and shared links don't open the right tab. Use query params or hash routing.
  - File: `client/src/pages/WorkspacePage.jsx:14`
- [ ] **TODO: No global search** — There is no unified search across tasks, notes, events, and projects. Users must navigate to each section and use its local filter. Add a global `Cmd+K` / `Ctrl+K` search palette.
- [ ] **TODO: Keyboard shortcut discoverability** — The `G` (capture) and `F` (zen) shortcuts are documented in the README but not discoverable in the app. Add a `?` shortcut that shows a keyboard shortcuts modal.

### 2.3 Forms & Data Entry

- [ ] **TODO: No form validation feedback** — Task/project/event creation forms rely on server-side 400 responses for validation. Missing required fields show a generic error or silently fail. Add inline validation (red border, helper text) before submission.
- [ ] **TODO: Task creation ID uses `Date.now()`** — Task IDs use `task-${Date.now()}-...` which can collide if two tasks are created in the same millisecond (e.g. bulk import). Use UUIDs (`crypto.randomUUID()`).
  - File: `server/routes/tasks.js:122`
- [ ] **TODO: Event creation has no duplicate detection** — Creating the same event twice (same time, title, date) produces two independent records with no warning. Add a duplicate check or upsert behavior.
  - File: `server/routes/events.js:329-354`
- [ ] **TODO: Pomodoro timer state lost on page navigation** — If a user navigates away from the Pomodoro page during an active session, the timer stops. Consider persisting timer state in localStorage or a service worker.

### 2.4 Feedback & Error States

- [ ] **TODO: No loading skeletons** — Pages show nothing while data loads, then pop in. Add skeleton screens or shimmer placeholders for the main content areas.
- [ ] **TODO: No offline indicator** — The app silently fails when the network is down. Add a connection status banner and queue writes for replay.
- [ ] **TODO: Error boundary missing** — A crash in any component takes down the entire app. Add React Error Boundaries at the page level so a broken analytics chart doesn't prevent task management.
- [ ] **TODO: Export has no progress feedback** — The "Export All Data" action downloads a zip with no progress bar. For large datasets, the user sees nothing for several seconds. Add a progress indicator or toast.

### 2.5 Accessibility

- [ ] **TODO: No ARIA landmarks on main layout** — The sidebar, main content, and panels lack `role="navigation"`, `role="main"`, and `role="complementary"` landmarks. Screen reader users cannot jump between regions.
  - Files: `client/src/components/Layout/Sidebar.jsx`, `client/src/App.jsx`
- [ ] **TODO: Color-only status indicators** — Task status dots and priority colors have no secondary indicator (icon, pattern, or label) for colorblind users. Add shape or text differentiation.
  - File: `client/src/utils/statusMap.js`
- [ ] **TODO: Focus management on modal open/close** — The CaptureModal and slide drawers don't trap focus or return focus to the trigger element on close. Users tabbing can escape behind the modal.
  - Files: `client/src/components/CaptureModal.jsx`, `client/src/components/SlideDrawer.jsx`
- [ ] **TODO: Day Planner `contentEditable` has no `aria-label`** — The rich text editor is a bare `div[contenteditable]` with no accessible name. Screen readers announce it as a generic editable region.
  - File: `client/src/components/DayPlannerPanel.jsx`

---

## 3. User Interface (UI)

### 3.1 Responsiveness & Layout

- [ ] **TODO: No mobile-optimized layout** — The app is designed for desktop. On screens < 768px, the sidebar overflows, the calendar grid is unusable, and the workspace panels stack poorly. Add responsive breakpoints and a mobile navigation pattern (bottom tab bar or hamburger).
- [ ] **TODO: Day Planner panel minimum width too narrow on small screens** — The 240px minimum is fine on desktop but on a 1366px laptop with sidebar open, the main content area can be squeezed uncomfortably.
  - File: `client/src/pages/WorkspacePage.jsx:128`
- [ ] **TODO: Browser iframe has no fallback for non-Docker deployments** — If running natively (no Docker), the Web Browser tab shows a permanent "Connecting to browser…" spinner. Detect and show a configuration hint instead.
  - File: `client/src/pages/WorkspacePage.jsx:98`

### 3.2 Visual Consistency

- [ ] **TODO: Inconsistent button styles** — Some pages use inline `style` objects, others use CSS classes. The Settings page buttons look different from the Task page buttons. Extract a shared button component or CSS utility classes.
- [ ] **TODO: Three themes but no live preview** — Users must commit to a theme change to see the result. Add a preview on hover or a split-view comparison.
- [ ] **TODO: No dark/light mode auto-detection** — The app defaults to Midnight Abyss regardless of `prefers-color-scheme`. Respect the OS setting for first-time users.

### 3.3 Data Visualization

- [ ] **TODO: Analytics charts have no empty state** — The weekly report shows empty containers when there's no data for a period. Add "No data for this week" placeholders with a suggestion to start logging.
- [ ] **TODO: No calendar month view** — The calendar only shows a weekly grid. A month overview for planning ahead is a common expectation.
- [ ] **TODO: Timeline (Life Map) has no zoom** — Large timelines require horizontal scrolling with no zoom control. Add zoom in/out or a minimap.

---

## 4. Performance & Reliability

### 4.1 Database

- [ ] **TODO: No pagination on task/event queries** — `GET /api/tasks` returns all tasks with no `LIMIT`/`OFFSET`. At 10K+ tasks this becomes slow and memory-heavy. Add cursor-based or offset pagination.
  - File: `server/routes/tasks.js:9`
- [ ] **TODO: No database indexes beyond primary keys** — Frequent queries filter on `project_id`, `status`, `date_string`, and `person_id` but these columns have no indexes. Add targeted indexes.
  - File: `server/db.js`
- [ ] **TODO: Integrity checker opens separate DB connections** — `runIntegrityCheck` opens its own connections to both the active and backup databases, bypassing the connection pool. If the check runs while the app is writing, WAL contention can cause `SQLITE_BUSY`.
  - File: `server/integrity-checker.js:110-121`
- [ ] **TODO: Backup runs synchronously on startup** — `runBackup()` copies the full database file synchronously (blocking the event loop) before the server starts listening. For large databases this adds seconds to cold-start time. Make it async or run it post-listen.
  - File: `server/server.js:215`

### 4.2 Client Performance

- [ ] **TODO: No code splitting** — All 25+ pages are bundled into a single JS chunk. Lazy-load routes with `React.lazy()` and `Suspense` to reduce initial load time.
  - File: `client/src/App.jsx`
- [ ] **TODO: Full task list re-fetched on every mutation** — `useTasks` refetches the entire task list after create/update/delete. Use optimistic updates or patch the local state instead.
  - File: `client/src/hooks/useTasks.js`
- [ ] **TODO: Calendar re-renders all events on any change** — The CalendarGrid doesn't memoize individual event blocks. Moving one event re-renders the entire week grid. Use `React.memo` on event components.

### 4.3 Reliability

- [ ] **TODO: No health check in `docker-compose.yml`** — The backend and frontend containers have no `healthcheck` directive. Docker can't auto-restart a hung process that keeps the port open.
  - File: `docker-compose.yml`
- [ ] **TODO: No graceful shutdown handler** — The Express server doesn't listen for `SIGTERM`/`SIGINT` to close the database connection cleanly. Abrupt container stops can leave WAL files unmerged.
  - File: `server/server.js`
- [ ] **TODO: Chromium keepalive can trigger infinite reconnect** — If the Chromium container is intentionally stopped, the `WorkspacePage` keepalive endlessly cycles between `loading` and `error` states every 90 seconds. Add a backoff or manual-only retry after the first failure.
  - File: `client/src/pages/WorkspacePage.jsx:54-61`

---

## 5. Feature Opportunities

### 5.1 High Value

- [ ] **TODO: Calendar ICS import/export** — Users can't sync with Google Calendar, Outlook, or Apple Calendar. Implementing RFC 5545 `.ics` import and export would unlock interop with every major calendar.
- [ ] **TODO: Recurring task support** — Events support RRULE recurrence but tasks don't. "Take medication daily" requires manual daily task creation. Add a `rrule` field to tasks with auto-materialization.
- [ ] **TODO: PWA with offline support** — The app has no Service Worker, manifest, or cache strategy. Adding a basic PWA manifest + offline cache would enable "add to home screen" on mobile and survive network outages.
- [ ] **TODO: Full-text search across all entities** — SQLite FTS5 could power a sub-millisecond search across tasks, notes, events, extracts, and journal entries. Map it to the global search palette (see UX 2.2).
- [ ] **TODO: Webhooks / event hooks** — No mechanism to trigger external actions on task completion, habit logs, or event creation. A simple webhook system (POST to a configured URL on state changes) would enable Zapier/n8n/Home Assistant integration.

### 5.2 Medium Value

- [ ] **TODO: Drag tasks onto calendar** — Tasks cannot be dragged from the task list onto a calendar time slot to create a time-blocked event. This is a core GTD → time-blocking workflow.
- [ ] **TODO: Natural language date parsing** — Due dates require manual date-picker selection. Parsing "next Thursday" or "in 3 days" from the capture input would speed up entry.
- [ ] **TODO: Habit streaks gamification** — The habit dashboard shows streaks but doesn't celebrate them. Add milestone badges (7-day, 30-day, 100-day) and visual streak fire effects.
- [ ] **TODO: Daily review / end-of-day prompt** — No automated prompt to review what was planned vs. what happened. Add an optional evening notification or modal that walks through the day's plan vs. measure delta.
- [ ] **TODO: Template events / weeks** — Users recreate the same weekly schedule manually. Allow saving a week as a template and stamping it onto future weeks.
- [ ] **TODO: Multi-device sync** — Currently single-device only. Adding CouchDB/PouchDB replication or a simple CRDT layer would enable multi-device without a cloud service.

### 5.3 Quality of Life

- [ ] **TODO: Undo for event deletion** — Events are hard-deleted with no trash or undo toast (unlike tasks, which have both). Add soft-delete and undo for events.
- [ ] **TODO: Bulk event creation** — No way to create multiple events at once (e.g. paste a schedule). Add a multi-event creation form or CSV/text import.
- [ ] **TODO: Notes linking to other notes** — Notes can link to tasks but not to other notes. Add bidirectional note linking for a Zettelkasten-style knowledge graph.
- [ ] **TODO: Project archival with data preservation** — Archived projects are soft-deleted but their tasks remain orphaned. Archive should preserve the full project tree (tasks, notes, events) as a read-only bundle.
- [ ] **TODO: Configurable backup retention** — `MAX_BACKUPS` is hardcoded to 100. Make it configurable via settings or `.env`.
  - File: `server/backup-db.js`
- [ ] **TODO: Export should include habits, therapy, and timeline** — The export ZIP only contains tasks, projects, notes, and extracts. Habits, therapy journal, personal goals, and timeline data are not exported, leaving them locked in the SQLite file.
  - File: `server/routes/export.js`

---

## Audit Log

| Date | Auditor | Sections Covered | Findings |
|------|---------|------------------|----------|
| 2026-06-05 | Claude (automated) | Full initial audit | 55 TODOs across security, UX, UI, performance, and features |
