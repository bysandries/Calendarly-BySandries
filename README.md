# Calendarly

> **Sleek, Local-First Performance Tracking & Retrospective Scheduler**
>
> Built on a Glassmorphic Pure Black Canvas with vibrant Neon Accents. Designed for high-agency engineers to organize, execute, and reflect on productivity using the **PALM Methodology** (Plan, Act, Measure, Learn).
>
> Architecturally designed for **Twice-Exceptional (2e) users**: low-friction capture, modular views, full state reversibility, sensory-aware aesthetics, and zero vendor lock-in.

---

## Table of Contents

1. [What is Calendarly?](#what-is-calendarly)
2. [Core Philosophy](#core-philosophy)
3. [Feature Overview](#feature-overview)
   - [Workspace](#workspace)
4. [2e Accessibility & Neurodivergent Design](#2e-accessibility--neurodivergent-design)
5. [Architecture](#architecture)
6. [Quick Start](#quick-start)
   - [Option A: Docker Compose](#option-a-docker-compose-recommended)
   - [Option B: Native Local Development](#option-b-native-local-development)
   - [Option C: Home Server / VPS](#option-c-home-server--vps-deployment)
   - [Option D: DietPI Chromebook](#option-d-dietpi-chromebook-server-low-power-appliance)
7. [Remote Access (Tailscale)](#remote-access-without-port-forwarding-tailscale)
8. [API Reference](#api-reference)
9. [Database Management](#database-management)
10. [Security Checklist](#security-checklist)
11. [Development Guide](#development-guide)
12. [Mobile App Porting Guide](#mobile-app-porting-guide)
13. [Roadmap](#roadmap--contributing)

---

## What is Calendarly?

Calendarly is a **local-first**, self-hosted productivity operating system. It combines a time-blocking calendar, GTD/Kanban task management, project tracking, knowledge extraction, and deep analytics into a single cohesive workspace. Your data lives on your own hardware, encrypted at rest, with no cloud dependencies or subscription fees.

Whether you run it on your laptop for personal focus, on a home server for household coordination, or on a repurposed Chromebook running DietPI for a dedicated low-power appliance, Calendarly gives you complete ownership of your productivity stack.

---

## Core Philosophy

### PALM Methodology
Every feature in Calendarly supports the PALM cycle:

- **P**lan — Schedule intent with time-blocked events, set due dates, and define project phases
- **A**ct — Execute tasks, run Pomodoro focus sessions, and log what actually happened
- **M**easure — Compare Plan vs. Measure columns, review weekly KPIs, and track alignment
- **L**earn — Write daily logs, capture research extracts, reflect on distractions, and evolve your workflow

### Four Pillars
All projects align to one of four pillars that guide prioritization:
- **Kindness** — Impact on others and relationships
- **Authenticity** — Alignment with personal values and identity
- **Resilience** — Building systems that withstand disruption
- **Innovation** — Creating something new or improving existing systems

### Local-First, Privacy-First
- Your database is a single encrypted SQLite file on disk
- No accounts, no tracking, no cloud sync required
- Optional Tailscale mesh VPN for secure remote access without port forwarding
- Transparent SQLCipher encryption with user-controlled keys

---

## Feature Overview

### Calendar & Time Blocking
- **Dual-Column Weekly Grid** — Separate Plan (intent) and Measure (reality) columns for honest retrospection
- **Mouse-Draw Event Creation** — Drag on the grid to create events naturally
- **Drag & Drop Rescheduling** — Move events fluidly between days and times
- **Resize Events** — Drag the bottom edge to adjust duration
- **15-Minute Snap Grid** — Precision time blocking
- **Current-Time Indicator** — Always know where you are in the day
- **Inline Daily Logs** — Journal entry editor attached to each calendar day
- **Reflection Slide-Drawer** — Review and annotate individual events
- **Recurrence Rules** — RFC 5545-compatible repeating events (`rrule`)
- **Timezone Aware** — Full Luxon-powered timezone handling across client and server
- **Clone Plan to Measure** — Copy your intended schedule to the reality column for editing

### Task Management (GTD + Kanban)
- **GTD Inbox** — Rapid capture bar for tasks, projects, or events with instant triage
- **Energy Quadrant Tagging** — Tag captured tasks with Performance / Survival / Renewal / Burnout state
- **Triage Undo Toast** — Every triage action (2m / Next / Someday) shows a 5-second undo window
- **7-Status Pipeline** — `01 - Inbox` → `02 - Next Step` → `03 - In Progress` → `04 - Waiting` → `05 - Someday` → `06 - Cancelled` → `07 - Done`
- **Soft-Delete Trash Bin** — Deleted tasks move to Trash instead of being permanently removed
- **Undo Toast on Delete** — 5-second undo window appears when a task is deleted from the task table
- **Trash Tab** — Browse, restore, or permanently delete trashed tasks; "Empty Trash" bulk action
- **Kanban Board** — Visual 4-column drag-and-drop board (Next Steps, In Progress, Waiting, Completed)
- **Task Mathematics** — Urgency scoring based on days-left vs. estimated completion time (ECT), priority dots (0-3), slack computation, and overdue highlighting
- **Bulk Actions** — Multi-select and bulk-update tasks
- **Smart Date Handling** — Auto-sets `finished_date` when transitioning to Done, auto-sets `received_date` on creation
- **Project Linking** — Associate tasks with projects for rolled-up analytics
- **Event Linking** — Attach tasks to calendar events for time-blocked execution

### Project Tracking
- **Project Dashboard** — Per-project view with aggregated task stats (total, complete, estimated minutes)
- **Phase & Pillar Constraints** — Projects align to PALM phases and one of the Four Pillars
- **Progression Tracking** — Visual completion percentages and status transitions
- **Two-Stage Delete** — Archive first, then permanent delete to prevent accidents

### Focus & Productivity
- **Pomodoro Timer** — Configurable focus sessions with break cycles
  - Task-linked sessions for time-per-task analytics
  - Pause/resume with overlay prompt
  - Auto-transitions task status from Inbox/Next Step to In Progress
- **Distraction Notes** — Capture interruptions during focus sessions for later pattern review
- **Task Time Tracker** — Aggregated actual minutes spent per task across all Pomodoro sessions
- **Due Soon Section** — FocusPage automatically surfaces non-starred tasks due within 7 days (excludes cancelled, done, and someday statuses) as a dedicated "Due Soon" section alongside starred items

### Workspace
- **Multi-Tab Workspace Layout** — Unified workspace with three switchable tabs (persisted across sessions):
  - **Tasks & Projects** — Full FocusPage view (starred items, due-soon tasks, project panel, task detail)
  - **Calendar** — Full dual-column weekly calendar embedded in the workspace
  - **Web Browser** — Dockerized Chromium browser embedded via `iframe` at `/browser/`
- **Day Planner Panel** — Resizable (240–700 px) right-hand panel visible in all workspace tabs:
  - Rich markdown editor with toolbar: headings (H1–H4), bold, italic, underline, strikethrough
  - Text and highlight color pickers with per-area color palette integration
  - CSS-only checkbox rendering (`- [ ]` / `- [x]`) without JavaScript state
  - Live markdown shortcut: pressing `-` at the start of a line auto-inserts a checkbox bullet
  - Content autosaved to `localStorage` per day
- **Embedded Chromium Browser** — `ghcr.io/linuxserver/chromium` Docker sidecar proxied through Nginx at `/browser/`:
  - Kiosk-mode: no caption buttons, always-maximized via `autostart-wayland` script enforced on every restart
  - Startup polling and keepalive — auto-reconnects if Chromium restarts or crashes
  - Retry button shown if the browser container is unavailable after 90 seconds

### Knowledge Management
- **Markdown Notes** — Full markdown editor with live preview, linkable to tasks
- **Research Extracts** — Structured capture of bibliography, chapter/section, position, and highlight colors
- **Resource Linking** — Extracts can link to projects or tasks for contextual research
- **Tagging** — Comma-separated tags on notes and extracts for emergent categorization

### Analytics & Reflection
- **Weekly Report** — Comprehensive dashboard including:
  - Area hours (planned vs. measured) with radial gauges
  - Sleep alignment percentage
  - Task KPIs (planned vs. completed hours & count)
  - Event summary aggregates
  - Project progression with completion percentages
  - Phase distribution across your portfolio
- **Distraction Reflection** — Review captured distractions alongside task context
- **Time Alignment Scoring** — Quantify how well your execution matched your intention

### Habit Tracking
- **Habit Dashboard** — Per-habit day grid with streak indicators and goal tracking
- **Build / Quit Intents** — Track habits you're forming and ones you're breaking
- **Quick Log** — One-tap daily habit logging with optional time input
- **Reminders** — Multiple time-of-day reminders per habit
- **Weekly Summary** — Per-day log counts with streak computation

### Areas of Life
- **7 Default Areas** — Sleep, Work, Math, Coding, Creative, Fitness, General
- **Custom Areas** — Create your own life categories with hex color coding
- **Color Cascading** — Area color changes propagate to all associated events
- **Event Categorization** — Every time block belongs to an area for analytics grouping

### Personal Care Dashboard
- **Sleep Tracking** — Sparkline panel showing rolling 7-day sleep logs with quality scoring, duration, and a radial KPI gauge
- **Dimension Assessments** — Periodic self-assessment across life dimensions (energy, mood, cognition, social)
- **Therapy Journal** — Structured journal entries with linked patterns, therapy goals, configurable questions, and quick-entry mode
  - Pattern Detection — Tag entries with recurring patterns; review pattern frequency and trend over time
  - Therapy Goals — Ordered goal list with reorder support; per-entry progress linkage
  - Quick Entries — Timestamped sub-entries within a session for rapid in-session logging
- **Personal Goals** — Long-form goal tracking with archive/complete lifecycle, linked resources, and a history view
- **Sleep & Habit Cross-Links** — Therapy entries can pull in available sleep logs and habit logs for that day

### Life Map (Timeline)
- **Life Timeline** — Chronological lane-based view of life events, milestones, and reflections
- **Mood Tracking** — Per-item mood emoji tagging with color coding
- **Drag & Drop Reorder** — Resequence timeline items within and across lanes
- **Item Links** — Connect timeline items to tasks, projects, or other items
- **Export / Import** — Timeline data exports to JSON and re-imports for backup or migration

### Activity Energy Log
- **Per-Task Energy Tagging** — Attach an energy quadrant (Performance / Survival / Renewal / Burnout) to any captured task in the GTD Inbox
- **Energy Summary** — Aggregate view of energy states across tasks and entities for self-awareness tracking

### AI Agent Tracking
- **Session Logging** — Track Claude, OpenCode, Gemini, and Antigravity sessions
- **Token & Cost Metrics** — Input, output, cache read/write tokens + USD cost per session
- **Aggregated Stats** — Total sessions, tokens, time, and cost per agent
- **Automatic Cost Calculation** — Claude pricing auto-applied based on token counts

### Data Integrity & Security
- **SQLCipher Transparent Encryption** — Database encrypted at rest via `PRAGMA key`
- **Golden Backup Recovery** — Automatic non-destructive backup on every server boot
- **Integrity Check Service** — Background validation at `/api/health/integrity-check` with auto-restore from highest-integrity backup
- **Multiple Database Profiles** — Upload, activate, rename, and delete backup `.db` files through the UI
- **Git Security Shield** — Backend validates that `.env`, `*.db`, and `backups/` are protected by `.gitignore`
- **Upload Password Gate** — Password-protected archive upload endpoint for importing data
- **Path Traversal Prevention** — Archive extraction validated against zip-slip attacks

### Customization
- **Three Themes** — Midnight Abyss (default), Slate Minimal, Classic Light
- **Timezone Selector** — 8 major timezones
- **Time Format** — 12-hour or 24-hour
- **First Day of Week** — Sunday or Monday
- **Default Slot Duration** — 15, 30, 45, or 60 minutes
- **Customizable Pillar Labels** — Rename the Four Pillars to match your personal framework
- **Sidebar Navigation Customization** — Drag-to-reorder and per-item toggle for all nav sections
- **Focus Context Presets** — Named nav subsets (e.g. "Deep Work", "Wellness") that filter the sidebar instantly

---

## 2e Accessibility & Neurodivergent Design

Calendarly is audited against a **Twice-Exceptional (2e) productivity framework** that treats the app as modular infrastructure rather than a task list. Each pillar addresses a specific failure mode of the 2e executive function profile.

### Quick Capture (Pillar 1 — Prefrontal Bottleneck)

**Global Quick Capture — keyboard shortcut `G`**

Press `G` anywhere in the app (when not typing in a field) to open the Quick Capture overlay. The input is immediately focused. Type, hit Enter, and the thought is in your inbox. No navigation required.

**URL scheme — `?capture=true`**

Any tool (macOS Shortcuts, Raycast, shell scripts, Alfred) can open a capture session directly by launching:

```
http://localhost:5173?capture=true
```

This works as a system-level keyboard shortcut: bind a hotkey in your OS to run `open "http://localhost:5173?capture=true"` and you have a capture injection that works from a locked screen, over another application, or mid-focus-session.

The GTD Inbox is the **default route** — a cold open of the app lands directly at the capture surface with `autoFocus` on the input. Capture is always decoupled from organization: everything dumps to `01 - Inbox` and gets triaged later.

---

### Zen Mode (Pillar 4 — Sensory Signal-to-Noise)

**Keyboard shortcut `F`**

Press `F` (when not in a text field) to toggle Zen Mode. The sidebar is fully removed from the DOM — not just collapsed, but gone. The main content expands to full width. A small "exit zen · F" pill remains in the bottom-right corner as the only visible UI chrome.

Zen mode state persists across page reloads via `localStorage`.

Use it when:
- Starting a deep Pomodoro session
- Writing in the Daily Log
- Processing the GTD Inbox without distraction

---

### Focus Context Presets (Pillar 2 — Workspace Isolation)

In **Settings → Interface & Navigation**, you can save named nav subsets called **Context Presets**.

A preset like "Deep Work" might include only: Tasks, GTD Inbox, Pomodoro.  
A preset like "Wellness" might include only: Habits, Personal Care, Life Map.

The sidebar shows preset chips. Clicking one filters the navigation to only those routes — all other sections disappear until you switch back to "All." This provides lightweight workspace isolation without requiring a separate database or full context switch.

Presets are saved to the settings database alongside navigation config and persist across sessions.

---

### State Reversibility (Pillar 3 — Undo & Version Safety)

**Triage Undo Toast (GTD Inbox)**

Every triage action in the GTD Inbox — moving a task to Done (2m), Next Steps, or Someday — shows a 5-second undo toast at the bottom of the screen. Click Undo to return the task to `01 - Inbox`. No data is lost during a late-night hyperfocus triage session.

**Delete Undo Toast (Task Table)**

Deleting a task from the Tasks page no longer uses a `window.confirm()` dialog. Instead, the task is soft-deleted and a 5-second undo toast appears. Click Undo to restore the task instantly. After 5 seconds the soft-delete is committed.

**Soft-Delete Trash Bin**

All deleted tasks move to a Trash bin rather than being permanently removed. The Trash is accessible as a tab in the Tasks page. From Trash you can:
- **Restore** — returns the task to its original status
- **Permanently delete** — hard-removes it
- **Empty Trash** — hard-removes all trashed tasks at once

The backend uses the existing `deleted_tasks` table, extended to support `DELETE /api/tasks/:id` (now a soft-delete), `GET /api/tasks/trash`, `POST /api/tasks/trash/restore/:id`, `DELETE /api/tasks/trash/:id`, and `DELETE /api/tasks/trash`.

---

### Data Portability Export (Pillar 5 — Decommissioning Safety)

In **Settings → Database Backups**, alongside the SQLite backup download, there is now a one-click **Export All Data** button that downloads a dated `.zip` archive containing:

| File | Format | Contents |
|------|--------|----------|
| `tasks.csv` | CSV | All tasks with all columns |
| `projects.json` | JSON | Full project tree |
| `notes/*.md` | Markdown | Each note as a named `.md` file with YAML frontmatter |
| `extracts/*.md` | Markdown | Each extract as a `.md` file with bibliography frontmatter |

This format is human-readable, diff-able in git, importable into Obsidian/Notion/Logseq, and fully migration-safe. Your data is never locked into a binary SQLite file.

The export is served from `GET /api/export` (authenticated, streamed as `application/zip`).

---

### Reduced Motion (Pillar 4 — Sensory Sensitivity)

Calendarly fully respects the OS-level `prefers-reduced-motion` setting. When a user has enabled "Reduce Motion" in their system accessibility settings, all CSS transitions, animations, and spring physics are zeroed out:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

No configuration required — it responds to the OS signal automatically.

---

### Keyboard Shortcuts Reference

| Key | Context | Action |
|-----|---------|--------|
| `G` | Any page, not typing | Open Quick Capture overlay |
| `F` | Any page, not typing | Toggle Zen Mode |
| `Esc` | Quick Capture overlay | Dismiss without saving |
| `Enter` | Quick Capture overlay | Submit and close |
| `Shift+Click` | Task table | Range-select tasks |
| `Cmd/Ctrl+Click` | Task table | Additive task selection |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (port 5173)                          │
│  React 19  ·  Vite 8  ·  React Router DOM 7  ·  Luxon          │
│  Glassmorphic UI  ·  Custom Hooks  ·  React Markdown           │
└────────────────┬──────────────────────────┬─────────────────────┘
                 │ HTTP REST (JSON)          │ iframe /browser/
                 ▼                           ▼
┌────────────────────────────┐  ┌───────────────────────────────┐
│      SERVER (port 3000)    │  │  CHROMIUM (port 3010)         │
│  Node.js  ·  Express 4     │  │  linuxserver/chromium Docker  │
│  23 route groups           │  │  Kiosk mode  ·  Nginx proxy   │
│  RRULE engine              │  │  autostart-wayland enforced   │
│  Background backup svc     │  └───────────────────────────────┘
└────────────────┬───────────┘
                 │ @journeyapps/sqlcipher
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE (SQLite + SQLCipher)                  │
│  34 tables  ·  WAL mode  ·  Soft-delete  ·  PRAGMA key encrypt │
│  Auto-migration (addColumnIfMissing)  ·  Golden backup system  │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 19 |
| Build Tool | Vite | 8 |
| Routing | React Router DOM | 7 |
| Date/Time | Luxon | 3 |
| Markdown | React Markdown | 10 |
| Backend | Node.js + Express | 4 |
| HTTP | CORS | 2.8 |
| Database | SQLite + SQLCipher | `@journeyapps/sqlcipher` 5.3 |
| ZIP Export | Archiver | 8 |
| File Upload | Multer | 2.0 |
| Proxy | Nginx | (production) |
| Browser Sidecar | linuxserver/chromium | `ghcr.io/linuxserver/chromium:latest` |
| Container | Docker + Docker Compose | — |

### Project Structure

```
calendarly/
├── client/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Calendar/       # CalendarGrid, CreationPopover, resolveOverlaps
│   │   │   ├── Layout/         # Sidebar (with zen mode + context presets), NavIcons
│   │   │   ├── DayPlannerPanel.jsx  # Resizable markdown day-planner (Workspace right panel)
│   │   │   └── CaptureModal.jsx  # Global quick-capture overlay (?capture=true / G key)
│   │   ├── pages/              # 25 route-level pages (tasks, projects, habits, personal-care, timeline, etc.)
│   │   │   ├── WorkspacePage.jsx   # Multi-tab workspace (Tasks, Calendar, Browser) + Day Planner panel
│   │   │   ├── FocusPage.jsx       # Starred items + Due Soon section + project/task detail panels
│   │   │   └── TasksPage.jsx   # Includes Trash tab + undo toast
│   │   ├── hooks/              # Custom React hooks (useTasks with trash ops, etc.)
│   │   ├── utils/              # api/tasks.js (trash/restore/export), statusMap.js
│   │   ├── lib/                # taskMath.js (urgency scoring)
│   │   └── App.jsx             # Root router, zen mode (F), capture modal (G/?capture=true)
│   ├── public/                 # Static assets
│   └── index.html
├── server/
│   ├── routes/                 # Express route handlers (one file per resource)
│   │   ├── tasks.js            # Soft-delete + trash CRUD
│   │   └── export.js           # GET /api/export — ZIP of CSV/JSON/Markdown
│   ├── hooks/                  # Claude & Gemini session-stop hooks
│   ├── scripts/                # Migration and utility scripts
│   ├── db.js                   # Database connection, schema, migrations
│   ├── server.js               # Express app bootstrap (mounts all routers)
│   ├── backup-db.js            # Golden backup service
│   └── integrity-checker.js
├── graphify-out/               # Knowledge graph (AI-readable project map)
├── browser-config/             # Chromium kiosk configuration
│   ├── autostart-wayland       # Sets kiosk prefs + keep-maximized watcher on every restart
│   └── labwc-template.xml      # labwc window manager config (no title bar)
├── browser-data/               # Chromium profile volume (gitignored)
├── docker-compose.yml
├── .env.template
├── UI_DESIGN_SYSTEM.md
└── README.md
```

### Database Schema (34 Tables)

#### Core

| Table | Purpose |
|-------|---------|
| `areas` | Life area categories with hex colors |
| `people` | Team members for assignment and person-view |
| `projects` | PALM-phase projects with pillar alignment |
| `project_settings` | Per-project configuration overrides |
| `tasks` | GTD inbox and kanban cards |
| `events` | Dual-column calendar blocks (plan/measure) with RRULE |
| `CalendarDays` | Pre-seeded date dimension (2025–2030) |
| `DailyLogs` | Per-day journal entries attached to calendar days |
| `settings` | Global key/value config (includes nav config, context presets) |

#### Knowledge & Notes

| Table | Purpose |
|-------|---------|
| `notes` | Markdown notes linkable to tasks |
| `extracts` | Research bibliography captures |
| `extract_resources` | Many-to-many extracts ↔ projects/tasks |
| `extract_links` | Cross-extract relationship links |

#### Focus & Productivity

| Table | Purpose |
|-------|---------|
| `pomodoro_sessions` | Focus timer sessions |
| `pomodoro_session_tasks` | Many-to-many sessions ↔ tasks |
| `distraction_notes` | Interruptions captured during Pomodoro |

#### Habits

| Table | Purpose |
|-------|---------|
| `habits` | Habit definitions (build/quit intent) |
| `habit_reminders` | Time-of-day reminders per habit |
| `habit_logs` | Daily habit occurrence records |

#### Personal Care

| Table | Purpose |
|-------|---------|
| `therapy_entries` | Structured therapy/reflection journal entries |
| `therapy_patterns` | Named recurring patterns linked to entries |
| `therapy_entry_patterns` | Many-to-many entries ↔ patterns |
| `therapy_goals` | Ordered therapy goal list with reorder support |
| `therapy_questions` | Configurable reflection questions per entry |
| `quick_journal_entries` | Quick timestamped sub-entries within a session |
| `personal_goals` | Long-form personal goals with archive/complete lifecycle |
| `personal_goal_links` | Links from goals to tasks, projects, or other resources |
| `activity_energy_log` | Per-entity energy quadrant tags (Performance/Survival/Renewal/Burnout) |

#### Life Map

| Table | Purpose |
|-------|---------|
| `timeline_items` | Life events, milestones, and reflections with mood |
| `timeline_item_links` | Links between timeline items and other entities |

#### Relationships & Archives

| Table | Purpose |
|-------|---------|
| `event_task_links` | Many-to-many events ↔ tasks |
| `deleted_tasks` | Soft-delete archive — restored via Trash tab or undo toast |
| `deleted_projects` | Soft-delete archive for projects |
| `code_agent_sessions` | AI agent session tracking (Claude/OpenCode/Gemini) |

---

## Quick Start

### Option A: Docker Compose (Recommended)

#### 1. Set Up Environment Variables

```bash
cp .env.template .env
```

Edit `.env` and set a high-entropy encryption passphrase:

```env
DB_ENCRYPTION_KEY="your-secure-high-entropy-passphrase-here"
```

#### 2. Launch the Stack

```bash
docker-compose up --build -d
```

#### 3. Open the Dashboard

Navigate to [http://localhost:5173](http://localhost:5173).

The stack starts three containers:

| Container | Port | Purpose |
|-----------|------|---------|
| `calendarly-frontend` | 5173 | React app (Vite) |
| `calendarly-backend` | 3000 | Express API |
| `calendarly-chromium` | 3010 | Chromium browser (proxied at `/browser/`) |

---

### Option B: Native Local Development

#### Prerequisites
- Node.js 20+
- SQLite development libraries (for SQLCipher compilation)

#### 1. Clone and Install

```bash
git clone https://github.com/your-username/calendarly.git
cd calendarly
```

#### 2. Configure Environment

```bash
cp .env.template .env
# Edit .env and set DB_ENCRYPTION_KEY
```

#### 3. Start the Backend

```bash
cd server
npm install
npm run dev
# Server runs on http://localhost:3000
```

#### 4. Start the Frontend

```bash
cd client
npm install
npm run dev
# Dev server runs on http://localhost:5173
```

---

### Option C: Home Server / VPS Deployment

Any Debian/Ubuntu-based system works:

```bash
git clone https://github.com/your-username/calendarly.git /opt/calendarly
cd /opt/calendarly
cp .env.template .env
docker-compose up -d
```

For HTTPS, put Nginx in front:

```nginx
server {
    listen 443 ssl;
    server_name calendarly.yourdomain.com;
    location / { proxy_pass http://localhost:5173; }
    location /api/ { proxy_pass http://localhost:3000; }
}
```

---

### Option D: DietPI Chromebook Server (Low-Power Appliance)

Convert an old Chromebook into a dedicated, always-on Calendarly server running **DietPI**.

#### Steps

1. Enable Developer Mode on the Chromebook (`Esc + Refresh + Power`, then `Ctrl + D`)
2. Flash DietPI to a USB drive and boot from it
3. Install Docker via `dietpi-software` → Software Optimized
4. Clone and launch:

```bash
git clone https://github.com/your-username/calendarly.git /opt/calendarly
cd /opt/calendarly
cp .env.template .env && nano .env
docker-compose up -d
```

Total power draw under 5W — suitable as a 24/7 productivity appliance.

---

## Remote Access Without Port Forwarding (Tailscale)

```bash
# Server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Install Tailscale on client devices. Access from anywhere:

```
http://100.x.y.z:5173
```

All traffic is end-to-end encrypted. No open ports, no DDNS, no certificate management.

For the `?capture=true` URL scheme to work from a mobile device over Tailscale, use the Tailscale IP:

```
http://100.x.y.z:5173?capture=true
```

---

## API Reference

All endpoints are served from `http://localhost:3000/api/*`. Authentication uses a Bearer token (`Authorization: Bearer <token>`) or `x-api-key` header. The token is printed to the server console on first run and persisted to a file next to the database.

---

### Tasks `/api/tasks`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks` | List tasks; filters: `?project_id=`, `?status=`, `?unassigned=true`, `?q=search` |
| `POST` | `/api/tasks` | Create task `{ title, status?, project_id?, priority?, estimated_minutes? }` |
| `PATCH` | `/api/tasks/:id` | Update task; auto-sets `finished_date` on transition to Done |
| `DELETE` | `/api/tasks/:id` | **Soft-delete** — moves task to `deleted_tasks` table (recoverable) |
| `GET` | `/api/tasks/trash` | List all soft-deleted tasks |
| `POST` | `/api/tasks/trash/restore/:id` | Restore task from trash back to `tasks` table |
| `DELETE` | `/api/tasks/trash/:id` | Permanently hard-delete a single trashed task |
| `DELETE` | `/api/tasks/trash` | Empty entire trash (permanently hard-delete all) |

---

### Export `/api/export`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export` | Stream a `.zip` archive containing `tasks.csv`, `projects.json`, `notes/*.md`, `extracts/*.md` |

The zip is dated (`calendarly-export-YYYY-MM-DD.zip`) and can be triggered from **Settings → Database Backups → Export All Data**.

---

### Areas `/api/areas`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/areas` | List all areas (active first, archived last) |
| `POST` | `/api/areas` | Create area `{ name, color_hex, description? }` |
| `PATCH` | `/api/areas/:id` | Update area name, color, or archived flag |
| `DELETE` | `/api/areas/:id` | Archive (soft-delete) area |

---

### Events `/api/events`

Supports RFC 5545 RRULE recurrence and scope-aware updates (`single` / `series` / `forward`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | Fetch events for `?date=YYYY-MM-DD` or `?from=&to=` range; returns `{ plan: [], measure: [] }` |
| `POST` | `/api/events/sync-block` | Upsert single or recurring event |
| `PATCH` | `/api/events/:id` | Update event; `?scope=single\|series\|forward` |
| `POST` | `/api/events/log-measure` | Quick-log a measure column event |
| `POST` | `/api/events/clone-plan` | Clone plan event to measure column |
| `DELETE` | `/api/events/:id` | Delete event; `?scope=single\|series` |
| `GET` | `/api/events/:id/tasks` | List tasks linked to event |
| `POST` | `/api/events/:id/tasks` | Link task to event `{ task_id }` |
| `DELETE` | `/api/events/:id/tasks/:taskId` | Unlink task from event |

---

### Projects `/api/projects`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List all projects with task counts and pomodoro aggregates |
| `POST` | `/api/projects` | Create project `{ title, area, pillar, phase, ... }` |
| `PATCH` | `/api/projects/:id` | Update project fields |
| `DELETE` | `/api/projects/:id` | First call archives; second call permanently deletes |

---

### Notes `/api/notes`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notes` | List notes; filters: `?task_id=`, `?type=`, `?tags=`, `?q=search` |
| `GET` | `/api/notes/:id` | Get single note with linked task title |
| `POST` | `/api/notes` | Create note `{ title, content, type?, tags?, linked_task_id? }` |
| `PATCH` | `/api/notes/:id` | Update note |
| `DELETE` | `/api/notes/:id` | Delete note |

---

### Extracts `/api/extracts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/extracts` | List extracts; filters: `?project_id=`, `?task_id=`, `?tags=`, `?q=`, `?bibliography=` |
| `GET` | `/api/extracts/:id` | Get single extract with full resource list |
| `POST` | `/api/extracts` | Create extract `{ content, bibliography?, chapter_section?, position?, tags? }` |
| `PATCH` | `/api/extracts/:id` | Update extract |
| `DELETE` | `/api/extracts/:id` | Delete extract |
| `POST` | `/api/extracts/:id/resources` | Link project or task |
| `DELETE` | `/api/extracts/:id/resources` | Unlink project or task |

---

### Daily Logs `/api/daily-logs`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/daily-logs` | Fetch logs; `?date=YYYY-MM-DD` or `?from=&to=` |
| `POST` | `/api/daily-logs` | Upsert daily journal entry `{ date_id, content }` |

---

### Pomodoro Sessions `/api/pomodoro-sessions`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/pomodoro-sessions` | List sessions; filters: `?task_id=`, `?status=`, `?date_from=`, `?date_to=` |
| `GET` | `/api/pomodoro-sessions/by-task` | Aggregate actual minutes per task |
| `POST` | `/api/pomodoro-sessions` | Create session `{ task_id, planned_duration_minutes }` |
| `PATCH` | `/api/pomodoro-sessions/:id` | Update session |
| `DELETE` | `/api/pomodoro-sessions/:id` | Delete session |

---

### Habits `/api/habits` & `/api/habit-logs`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/habits` | List habits; `?area=`, `?include_archived=true` |
| `POST` | `/api/habits` | Create habit with optional reminders array |
| `PATCH` | `/api/habits/:id` | Update habit |
| `DELETE` | `/api/habits/:id` | Delete habit |
| `GET` | `/api/habit-logs/today-summary` | All habits with today's log counts and streaks |
| `GET` | `/api/habit-logs/weekly-summary` | Habits with per-day logs for current week |
| `POST` | `/api/habit-logs/quick/:habit_id` | One-tap quick log |
| `POST` | `/api/habit-logs` | Create log with metadata |
| `DELETE` | `/api/habit-logs/:id` | Delete log |

---

### People `/api/people`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/people` | List all people |
| `POST` | `/api/people` | Create person `{ name }` |
| `PATCH` | `/api/people/:id` | Update person |
| `DELETE` | `/api/people/:id` | Delete person |

---

### Personal Care `/api/personal-care`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/personal-care/summary` | Aggregated personal care dashboard data (sleep, mood, energy) |

---

### Therapy Journal `/api/therapy`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/therapy/entries` | List journal entries; filters: `?from=`, `?to=`, `?pattern_id=` |
| `GET` | `/api/therapy/entries/:id` | Get single entry with linked patterns |
| `POST` | `/api/therapy/entries` | Create entry with optional questions, mood, sleep, and habit links |
| `PATCH` | `/api/therapy/entries/:id` | Update entry |
| `DELETE` | `/api/therapy/entries/:id` | Delete entry |
| `GET` | `/api/therapy/patterns` | List all patterns |
| `GET` | `/api/therapy/patterns/:id` | Get pattern with linked entry count |
| `POST` | `/api/therapy/patterns` | Create pattern `{ name, description? }` |
| `PATCH` | `/api/therapy/patterns/:id` | Update pattern |
| `POST` | `/api/therapy/entries/:id/patterns` | Link pattern to entry |
| `DELETE` | `/api/therapy/entries/:id/patterns/:patternId` | Unlink pattern from entry |
| `GET` | `/api/therapy/goals` | List therapy goals (ordered) |
| `POST` | `/api/therapy/goals` | Create goal |
| `PATCH` | `/api/therapy/goals/:id` | Update goal |
| `POST` | `/api/therapy/goals/reorder` | Reorder goals `{ ordered_ids: [] }` |
| `PATCH` | `/api/therapy/questions/:id` | Update a reflection question |
| `GET` | `/api/therapy/quick-entries` | List quick sub-entries; filter: `?entry_id=` |
| `POST` | `/api/therapy/quick-entries` | Create quick entry `{ entry_id, content }` |
| `PATCH` | `/api/therapy/quick-entries/:id` | Update quick entry |
| `DELETE` | `/api/therapy/quick-entries/:id` | Delete quick entry |
| `GET` | `/api/therapy/available-sleep` | Sleep logs available for linking on a given `?date=` |
| `GET` | `/api/therapy/available-habits` | Habit logs available for linking on a given `?date=` |

---

### Personal Goals `/api/personal-goals`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/personal-goals` | List goals; filters: `?status=`, `?scope=` |
| `POST` | `/api/personal-goals` | Create goal `{ title, scope, description?, target_date? }` |
| `GET` | `/api/personal-goals/:id` | Get single goal with links |
| `PUT` | `/api/personal-goals/:id` | Update goal fields |
| `POST` | `/api/personal-goals/:id/archive` | Archive goal |
| `POST` | `/api/personal-goals/:id/complete` | Mark goal complete |
| `DELETE` | `/api/personal-goals/:id` | Delete goal |
| `GET` | `/api/personal-goals/:id/links` | List linked resources |
| `POST` | `/api/personal-goals/:id/links` | Add link `{ entity_type, entity_id }` |
| `DELETE` | `/api/personal-goals/:id/links/:linkId` | Remove link |

---

### Activity Energy Log `/api/activity-energy-log`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/activity-energy-log` | List logs; filters: `?entity_type=`, `?entity_id=`, `?from=`, `?to=` |
| `GET` | `/api/activity-energy-log/summary` | Aggregate energy counts grouped by quadrant |
| `POST` | `/api/activity-energy-log` | Create log `{ entity_type, entity_id, energy_level, emotion_type }` |
| `DELETE` | `/api/activity-energy-log/:id` | Delete log |

---

### Life Map `/api/timeline`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/timeline` | List timeline items; filters: `?lane=`, `?from=`, `?to=` |
| `GET` | `/api/timeline/export` | Export all items as JSON |
| `POST` | `/api/timeline/import` | Import items from JSON |
| `POST` | `/api/timeline/reorder` | Reorder items within a lane `{ ordered_ids: [] }` |
| `GET` | `/api/timeline/:id` | Get single item with links |
| `POST` | `/api/timeline` | Create item `{ title, lane, date?, mood?, notes? }` |
| `PUT` | `/api/timeline/:id` | Full update of a timeline item |
| `DELETE` | `/api/timeline/:id` | Delete item |
| `POST` | `/api/timeline/:id/links` | Link item to task/project/goal |
| `DELETE` | `/api/timeline/:id/links/:linkId` | Remove a link |

---

### Settings `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Fetch all settings (includes `navigation_config`, `context_presets`) |
| `POST` | `/api/settings` | Save settings (any key/value, objects auto-serialized as JSON) |
| `POST` | `/api/settings/env` | Update `.env` variables |
| `GET` | `/api/settings/backup/download` | Download active database as `.db` file |
| `POST` | `/api/settings/backup/upload` | Upload `.db` backup profile |
| `POST` | `/api/settings/backup/activate` | Activate a backup profile |
| `POST` | `/api/settings/backup/rename` | Rename a backup profile file |
| `DELETE` | `/api/settings/backup/:filename` | Delete a backup profile |
| `GET` | `/api/settings/gitignore-status` | Check `.gitignore` security coverage |

---

### Health & Utilities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check (unauthenticated) |
| `GET` | `/api/health/integrity-check` | Database integrity validation with auto-restore |
| `GET` | `/api/mcp` | Serve `OPENCLAW_MCP.md` for AI agents |
| `GET` | `/api/export` | Download full data export as `.zip` |
| `POST` | `/api/upload/graphify` | Upload zip/tar to `graphify-out/` |

---

## Database Management

### Automatic Backups
Every server start creates a timestamped backup in `server/backups/`. These are used for automatic recovery on corruption detection. The backup service also writes to two additional locations when available:

| Destination | Path | Notes |
|-------------|------|-------|
| Local | `server/backups/` | Always written; used for integrity auto-restore |
| iCloud Drive | `~/Library/Mobile Documents/com~apple~CloudDocs/CalendarlyBackups/` | macOS only; silently skipped if unavailable |
| USB Flash Drive | `/mnt/calendarly-backups/CalendarlyBackups/server/backups/` | Linux persistent mount; silently skipped if not mounted |

### Manual Backup
Download from Settings → Database Backups, or copy directly:

```bash
cp server/backups/calendarly-backup-*.db /your/safe/location/
```

### Export All Data (Migration-Safe)
From Settings → Database Backups → **Export All Data**: downloads a `.zip` with your full dataset in human-readable formats (CSV, JSON, Markdown). Safe to import into any other tool.

### Restore from Backup
1. Settings → Database Backups
2. Upload a `.db` file or select an existing profile
3. Click **Activate**

### Integrity Check
`GET /api/health/integrity-check` validates the database and auto-restores from the highest-integrity backup if issues are found.

---

## Security Checklist

- [ ] Set a strong `DB_ENCRYPTION_KEY` in `.env`
- [ ] Verify `.gitignore` protects `.env`, `*.db`, and `backups/`
- [ ] Set `SECRET_UPLOAD_PASSWORD` if using the archive upload feature
- [ ] Run behind Tailscale or a firewall
- [ ] Keep backups in a separate location from the running server

---

## Development Guide

### Running Tests

```bash
cd server
node scripts/test-db.js
```

### Database Migrations

The schema is managed idempotently via `addColumnIfMissing` in `db.js`. New columns are added automatically on server startup.

### Adding a New Route

1. Create `server/routes/myresource.js`
2. Mount in `server/server.js`:
   ```js
   const myRouter = require('./routes/myresource');
   app.use('/api/myresource', myRouter);
   ```
3. Add table DDL to `db.js → initDatabase()`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_ENCRYPTION_KEY` | Recommended | SQLCipher passphrase |
| `DATABASE_PATH` | Yes | Absolute path to `.db` file |
| `PORT` | No (3000) | Express server port |
| `NODE_ENV` | No | `development` or `production` |
| `SECRET_UPLOAD_PASSWORD` | No | Archive upload gate |
| `GEMINI_API_KEY` | No | Gemini AI integration |

---

## Mobile App Porting Guide

### Quick Capture from Mobile

The `?capture=true` URL scheme works on mobile via Tailscale. Create a mobile home screen shortcut to `http://100.x.y.z:5173?capture=true` for instant capture from any screen.

### Authentication

```js
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Mobile-Optimized Endpoints

| Endpoint | Mobile Use Case |
|----------|----------------|
| `GET /api/habit-logs/today-summary` | Home screen widget |
| `POST /api/habit-logs/quick/:habit_id` | One-tap habit log from widget |
| `POST /api/tasks` with `status: '01 - Inbox'` | Capture shortcut |
| `GET /api/analytics/weekly-report` | Dashboard overview |
| `GET /api/events?date=YYYY-MM-DD` | Daily calendar view |

### React Native / Expo

- Use the Tailscale IP for API base URL
- Store the auth token in `SecureStore`
- Deep link scheme: `calendarly://capture` → open capture overlay
- Use `expo-notifications` for habit reminder push (maps to `habit_reminders` table)

---

## Roadmap & Contributing

Planned directions:
- Mobile-optimized PWA with offline support and Service Worker mutation queuing
- React Native / Expo mobile app
- Calendar import/export (ICS)
- Graph visualization for Extract links (Zettelkasten map view)
- Plugin system for custom analytics widgets
- AI-assisted weekly reflection summaries

Contributions, issues, and feature requests are welcome. This is a local-first app — your data stays yours.

---

## License

MIT — use it, fork it, run it on a Chromebook in your closet.
