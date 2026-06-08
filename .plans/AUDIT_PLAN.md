# Calendarly — Debugging & Integrity Audit Plan

**Source:** Graphify knowledge graph (1060 nodes, 1498 edges, 74 communities)
**Generated:** 2026-05-26
**Goal:** Systematic full-stack audit across 9 self-contained stages. Each stage is designed to fit in a single token-limited session. Output files are cumulative.

---

## How To Use This Plan

1. Each stage is **self-contained** — read its section, execute the checks, write findings to `AUDIT_STAGE_N.md`.
2. Stages build on each other — start at Stage 1 and proceed sequentially.
3. The **Output Contract** at the end of each stage defines what must be in `AUDIT_STAGE_N.md` so the next session can consume it.
4. Use Graphify to cross-reference: `graphify query "findings from Stage N"` or trace specific nodes/edges.

---

## Stage 1 — Infrastructure & Build Pipeline
**Session estimate:** 30-60 min

### Scope
Docker Compose, package.json files (root, server, client), Dockerfiles, nginx config, Vite config, `.env` files, `.gitignore`, server bootstrap.

### Files to Read
- `/docker-compose.yml`
- `/package.json`, `/server/package.json`, `/client/package.json`
- `/server/Dockerfile`, `/client/Dockerfile`
- `/client/nginx.conf`
- `/client/vite.config.js`
- `/.env`, `/.env.template`, `/server/.env`, `/server/.env.template`
- `/.gitignore`
- `/server/server.js`
- `/backups/`, `/server/backups/` (directory existence check)

### Graphify Queries to Run
- `graphify query "Docker compose configuration" --dfs`
- `graphify query "What depends on server.js?" --budget 1500`
- `graphify query "Environment variables and configuration"`

### Checklist
- [ ] Docker Compose: services, volumes, networks, env pass-through, restart policy
- [ ] All 3 package.json files: dependency versions, script completeness, peer deps
- [ ] Dockerfiles: base images, layer caching, build args, multi-stage correctness
- [ ] nginx.conf: proxy pass targets, client_max_body_size, SPA fallback
- [ ] Vite config: dev proxy, HMR settings, build output config
- [ ] `.env` vs `.env.template`: field completeness, actual vs template mismatch
- [ ] Duplicate env files: root `.env` vs `server/.env` — which is authoritative?
- [ ] `.gitignore`: coverage of sensitive files (DB, .env, backups, node_modules)
- [ ] Server bootstrap: middleware ordering, route mount order, error handler placement
- [ ] CORS configuration: origin, methods, headers
- [ ] Body parser limits: 50mb — needed or oversized?
- [ ] Startup sequence: backup → DB init → listen. Error handling at each step
- [ ] Request logging middleware format and completeness

### Output Contract: `AUDIT_STAGE_1.md`
```markdown
# Stage 1 — Infrastructure & Build Pipeline
**Session:** YYYY-MM-DD
**Status:** ✅ / ⚠️ / ❌

## Findings
- [finding 1: description, file:line, severity (HIGH/MED/LOW)]
- [finding 2: ...]

## Docker Compose
- Services: [backend, frontend]
- Volumes: [db-data, mounts]
- Issues found: [list]

## Package Dependencies
- Root: [summary]
- Server: [summary, notable deps]
- Client: [summary, notable deps]

## Configuration Drift
- .env vs .env.template differences: [list]
- Exposed secrets in .env: [YES/NO]

## Server Bootstrap
- Middleware order: [correct/issue]
- Route mount count: [N routes]
- Error handler present: [YES/NO]

## Graphify Cross-Reference
- Key nodes affected: [node IDs]
- Community impact: [communities]

## Next Stage Handoff
- High-priority items for Stage 2: [list]
- Unresolved questions: [list]
```
---

## Stage 2 — Database Layer Integrity
**Session estimate:** 45-90 min

### Scope
`server/db.js`, `server/backup-db.js`, `server/integrity-checker.js`, all 19 table schemas, migration system, query patterns, test-db.js

### Files to Read
- `/server/db.js`
- `/server/backup-db.js`
- `/server/integrity-checker.js`
- `/server/test-db.js`
- `/server/scripts/migration-001.js`
- `/server/scripts/` (all files)
- All route files that construct queries

### Checklist
- [ ] Schema completeness: all 19 tables have correct columns, types, constraints, foreign keys
- [ ] `initDatabase()`: idempotent schema creation (CREATE IF NOT EXISTS, addColumnIfMissing)
- [ ] Migration system: `addColumnIfMissing` called for every column addition
- [ ] Orphan migration: `server/scripts/migration-001.js` exists but is never loaded in `db.js`
- [ ] Soft-delete pattern: `deleted_at` column used consistently?
- [ ] Backup system: `runBackup()` path resolution, timestamp format, non-destructive guarantee
- [ ] Integrity checker: restore logic, edge cases (no backup, corrupt backup, partial restore)
- [ ] WAL mode: `PRAGMA journal_mode=WAL`, checkpoint management
- [ ] SQLCipher encryption: `PRAGMA key` call, key derivation, key rotation
- [ ] Error paths: DB connection loss, wrong key, corrupt DB on startup
- [ ] `test-db.js`: does it run? what does it test? does it pass?

### Output Contract: `AUDIT_STAGE_2.md`
_Same format as Stage 1, plus:_
- Schema audit per table
- Migration coverage gaps
- Backup/restore edge cases
- Test results

---

## Stage 3 — Server Route Handlers
**Session estimate:** 60-90 min

### Scope
All 17 route files under `server/routes/`, middleware, error handling patterns, response formatting.

### Files to Read
- `/server/routes/events.js`
- `/server/routes/areas.js`
- `/server/routes/projects.js`
- `/server/routes/tasks.js`
- `/server/routes/notes.js`
- `/server/routes/extracts.js`
- `/server/routes/dailyLogs.js`
- `/server/routes/settings.js`
- `/server/routes/analytics.js`
- `/server/routes/upload.js`
- `/server/routes/pomodoro.js`
- `/server/routes/distractionNotes.js`
- `/server/routes/opencode.js`
- `/server/routes/codeAgents.js`
- `/server/routes/habits.js`
- `/server/routes/habit-logs.js`
- `/server/routes/people.js`

### Checklist (per route file)
- [ ] CRUD completeness: all expected endpoints present
- [ ] Input validation: request body sanitization, type checking
- [ ] SQL injection guards: parameterized queries everywhere (no string concatenation)
- [ ] Error handling: consistent `{ error: "message" }` format
- [ ] Status codes: consistent 200/201/204/400/404/500 usage
- [ ] Soft-delete pattern consistency across tasks, projects, areas
- [ ] RRULE events: edge cases — no end date, malformed rule, DST, multi-year recurrence
- [ ] Settings route: env var editing safety, backup file operations security
- [ ] Upload route: zip-slip protection, auth gate, file size limits
- [ ] All routes currently have **no authentication middleware**
- [ ] No rate limiting on any endpoint

---

## Stage 4 — Client Data Layer
**Session estimate:** 45-60 min

### Scope
`client/src/utils/api.js`, all 6 custom hooks.

### Files to Read
- `/client/src/utils/api.js`
- `/client/src/hooks/useTasks.js`
- `/client/src/hooks/useProjects.js`
- `/client/src/hooks/usePomodoro.js`
- `/client/src/hooks/useNotes.js`
- `/client/src/hooks/useExtracts.js`
- `/client/src/hooks/useHabits.js` (or similar)

### Checklist
- [ ] `api.js` completeness: all server endpoints mapped as functions?
- [ ] Error handling in api.js: network errors, non-2xx responses
- [ ] Auth header plumbing: ready for future auth middleware
- [ ] Hook patterns: loading/error states, stale-while-revalidate
- [ ] Race conditions: concurrent requests, unmounted component state updates
- [ ] Cache invalidation: after create/update/delete mutations
- [ ] Optimistic updates in any hook
- [ ] Pagination/filtering params correctly passed

---

## Stage 5 — Core Components
**Session estimate:** 60-90 min

### Scope
CalendarGrid, TasksPage, Kanban, and their supporting components.

### Files to Read
- `/client/src/components/Calendar/CalendarGrid.jsx`
- `/client/src/components/Calendar/CreationPopover.jsx`
- `/client/src/components/Calendar/resolveOverlaps.js`
- `/client/src/pages/CalendarPage.jsx`
- `/client/src/pages/TasksPage.jsx`
- `/client/src/pages/KanbanPage.jsx`
- `/client/src/components/KanbanBoard.jsx`
- `/client/src/components/TaskCard.jsx`
- `/client/src/components/TaskDrawer.jsx`
- `/client/src/lib/taskMath.js`
- `/client/src/utils/rruleExpander.js`
- `/client/src/utils/statusMap.js`

### Checklist
- [ ] Mouse-draw event creation: edge cases — zero-width, boundary overflow, multi-week
- [ ] Drag & drop rescheduling: collision detection, overlap resolution
- [ ] RRULE expansion: DST correctness, monthly/yearly edge cases
- [ ] Dual-column (plan vs measure): clone consistency, independent editing
- [ ] Timezone: Luxon usage correct, UTC/local conversion on save/load
- [ ] Task card rendering: all 7 statuses, priority dots (0-3), urgency scoring
- [ ] Bulk selection: Shift+Click range, Cmd+Click additive, mobile Select Mode
- [ ] Kanban drag-and-drop: status transitions, optimistic update, rollback
- [ ] taskMath.js: urgency formula correctness, slack computation, overdue detection

---

## Stage 6 — Secondary Features
**Session estimate:** 60-90 min

### Scope
Habits, Pomodoro, Notes, Extracts, Daily Logs, Distraction Notes, Agents, Analytics, Settings.

### All Relevant Files
- `/client/src/pages/HabitsPage.jsx` (or similar)
- `/client/src/components/*` (habit-related components)
- `/client/src/pages/AnalyticsPage.jsx`
- `/client/src/pages/NotesPage.jsx`
- `/client/src/pages/SettingsPage.jsx`
- `/client/src/pages/AgentsPage.jsx`
- Client pomodoro components and hooks
- Distraction notes components
- Server routes for all of the above (cross-ref with Stage 3)

### Checklist
- [ ] Habits: quick-log optimization, reminder engine, streak computation correctness
- [ ] Pomodoro state machine: active → paused → completed, auto-task status transition
- [ ] Notes/Extracts: markdown rendering, tagging, resource linking consistency
- [ ] Analytics weekly report: area hours plan vs measure, sleep alignment, task KPIs
- [ ] Settings page: save/load round-trip, env var editing safety
- [ ] Code Agent tracking: cost auto-calculation accuracy (Claude pricing per model)
- [ ] Distraction notes: capture during pomodoro, review with context

---

## Stage 7 — UI/UX & Design System
**Session estimate:** 30-60 min

### Scope
Design system document, CSS components, theme system, responsive breakpoints.

### Files to Read
- `/UI_DESIGN_SYSTEM.md`
- App-level CSS and component-level CSS files
- Theme switching logic

### Checklist
- [ ] Theme switching: all 3 themes (Midnight Abyss, Slate Minimal, Classic Light) work across all components
- [ ] Glassmorphic card pattern: consistent CSS across cards, modals, drawers
- [ ] Responsive breakpoints: tablet (768px), iPhone Pro Max (430px)
- [ ] Component library alignment: buttons, badges, tabs, inputs, modals match design spec
- [ ] Empty states: all list views show helpful empty state
- [ ] Skeleton loaders: present during data fetch
- [ ] Toast notifications: after create/update/delete operations
- [ ] Accessible color contrast ratios

---

## Stage 8 — Security Audit
**Session estimate:** 30-45 min

### Scope
Full attack surface analysis, configuration review.

### Files to Read (cross-ref all previous stages)
- Server bootstrap (Stage 1)
- Database encryption (Stage 2)
- Upload route (Stage 3)
- CORS config, Helmet/security middleware absence

### Checklist
- [ ] No authentication on any endpoint (intentional for local-first — verify this is acceptable)
- [ ] SQLCipher encryption: key management, `PRAGMA key` correctness, key in env var
- [ ] Archive upload: zip-slip path traversal prevention validation
- [ ] Upload password gate: `SECRET_UPLOAD_PASSWORD` compared correctly
- [ ] `.env` exposure through Settings API (does it mask values?)
- [ ] CORS: `origin: '*'` allows any site to make API calls
- [ ] Express body parser: 50mb limit — potential DoS vector
- [ ] No rate limiting on any endpoint
- [ ] No Helmet or other security headers
- [ ] No input sanitization middleware
- [ ] `.gitignore` check: race conditions with git add

---

## Stage 9 — Performance & Optimization
**Session estimate:** 30-45 min

### Scope
Bundle analysis, render performance, query efficiency, N+1 problems.

### Checklist
- [ ] Vite build analysis: `vite build` output size, chunk splitting
- [ ] Code splitting: React.lazy + Suspense for route-level components
- [ ] React optimization: `React.memo`, `useMemo`, `useCallback` usage in heavy components (CalendarGrid, TasksPage)
- [ ] API response sizes: are there endpoints returning unnecessary data?
- [ ] Pagination: which list endpoints have limit/offset support?
- [ ] Database query performance: missing indexes on foreign keys, date range queries
- [ ] Analytics report: recalculated from raw data each time — query complexity
- [ ] Bundle dependencies: are all server deps actually used? (csv-parse, decompress, etc.)

---

## Priority Matrix

| Stage | Impact | Effort | Recommended Order |
|-------|--------|--------|-------------------|
| 1 — Infrastructure | HIGH | LOW | 1 |
| 2 — Database | CRITICAL | MEDIUM | 2 |
| 3 — Server Routes | HIGH | MEDIUM | 3 |
| 4 — Client Data Layer | HIGH | MEDIUM | 4 |
| 5 — Core Components | HIGH | HIGH | 5 |
| 6 — Secondary Features | MEDIUM | MEDIUM | 6 |
| 7 — UI/UX | LOW | LOW | 7 |
| 8 — Security | CRITICAL | LOW | 8 |
| 9 — Performance | MEDIUM | LOW | 9 |

---

## Session Handoff Protocol

When starting a new session for stage N:
1. Read `AUDIT_PLAN.md` for the stage N section
2. Read `AUDIT_STAGE_{N-1}.md` for the Next Stage Handoff section
3. Execute all checklist items for stage N
4. Write `AUDIT_STAGE_N.md` including the Output Contract
5. Run `graphify query "Stage N findings"` to cross-reference

When resuming a partial stage N:
1. Read `AUDIT_STAGE_N.md` (will have partial checks)
2. Tick off completed items, resume from last incomplete
3. Overwrite file when done
