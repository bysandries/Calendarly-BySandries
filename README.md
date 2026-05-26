# Calendarly

> **Sleek, Local-First Performance Tracking & Retrospective Scheduler**
>
> Built on a Glassmorphic Pure Black Canvas with vibrant Neon Accents. Designed for high-agency engineers to organize, execute, and reflect on productivity using the **PALM Methodology** (Plan, Act, Measure, Learn).

---

## Table of Contents

1. [What is Calendarly?](#what-is-calendarly)
2. [Core Philosophy](#core-philosophy)
3. [Feature Overview](#feature-overview)
4. [Architecture](#architecture)
5. [Quick Start](#quick-start)
   - [Option A: Docker Compose](#option-a-docker-compose-recommended)
   - [Option B: Native Local Development](#option-b-native-local-development)
   - [Option C: Home Server / VPS](#option-c-home-server--vps-deployment)
   - [Option D: DietPI Chromebook](#option-d-dietpi-chromebook-server-low-power-appliance)
6. [Remote Access (Tailscale)](#remote-access-without-port-forwarding-tailscale)
7. [API Reference](#api-reference)
8. [Database Management](#database-management)
9. [Security Checklist](#security-checklist)
10. [Development Guide](#development-guide)
11. [Mobile App Porting Guide](#mobile-app-porting-guide)
12. [Roadmap](#roadmap--contributing)

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
- **7-Status Pipeline** — `01 - Inbox` → `02 - Next Step` → `03 - In Progress` → `04 - Waiting` → `05 - Someday` → `06 - Cancelled` → `07 - Done`
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

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (port 5173)                          │
│  React 19  ·  Vite 8  ·  React Router DOM 7  ·  Luxon          │
│  Glassmorphic UI  ·  Custom Hooks  ·  React Markdown           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST (JSON)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER (port 3000)                          │
│  Node.js  ·  Express 4  ·  CORS  ·  Multer  ·  Luxon           │
│  16 route groups  ·  RRULE engine  ·  Background backup svc    │
└────────────────────────────┬────────────────────────────────────┘
                             │ @journeyapps/sqlcipher
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE (SQLite + SQLCipher)                  │
│  19 tables  ·  WAL mode  ·  Soft-delete  ·  PRAGMA key encrypt │
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
| File Upload | Multer | 2.0 |
| Proxy | Nginx | (production) |
| Container | Docker + Docker Compose | — |

### Project Structure

```
calendarly/
├── client/
│   ├── src/
│   │   ├── components/     # Reusable UI components (25 files)
│   │   │   ├── Calendar/   # CalendarGrid, CreationPopover, resolveOverlaps
│   │   │   └── Layout/     # Sidebar, NavIcons
│   │   ├── pages/          # Route-level pages (13 files)
│   │   ├── hooks/          # Custom React hooks (useProjects, useTasks, etc.)
│   │   ├── utils/          # api.js, rruleExpander.js, statusMap.js
│   │   ├── lib/            # taskMath.js (urgency scoring)
│   │   └── App.jsx         # Root router and layout
│   ├── public/             # Static assets (icons.svg, favicon.svg)
│   └── index.html
├── server/
│   ├── routes/             # Express route handlers (one file per resource)
│   ├── hooks/              # Claude & Gemini session-stop hooks
│   ├── scripts/            # Migration and utility scripts
│   ├── db.js               # Database connection, schema, migrations
│   ├── server.js           # Express app bootstrap (mounts all routers)
│   ├── backup-db.js        # Golden backup service
│   └── integrity-checker.js
├── graphify-out/           # Knowledge graph (AI-readable project map)
├── docker-compose.yml
├── .env.template
├── UI_DESIGN_SYSTEM.md     # Figma design system reference
└── README.md
```

### Database Schema (19 Tables)

| Table | Purpose |
|-------|---------|
| `areas` | Life area categories with hex colors |
| `projects` | PALM-phase projects with pillar alignment |
| `tasks` | GTD inbox and kanban cards |
| `events` | Dual-column calendar blocks (plan/measure) with RRULE |
| `notes` | Markdown notes linkable to tasks |
| `extracts` | Research bibliography captures |
| `pomodoro_sessions` | Focus timer sessions |
| `distraction_notes` | Interruptions captured during Pomodoro |
| `habits` | Habit definitions (build/quit intent) |
| `habit_reminders` | Time-of-day reminders per habit |
| `habit_logs` | Daily habit occurrence records |
| `code_agent_sessions` | AI agent session tracking (Claude/OpenCode/Gemini) |
| `settings` | Global key/value config |
| `CalendarDays` | Pre-seeded date dimension (2025–2030) |
| `deleted_tasks` | Soft-delete archive for tasks |
| `deleted_projects` | Soft-delete archive for projects |
| `event_task_links` | Many-to-many events ↔ tasks |
| `pomodoro_session_tasks` | Many-to-many sessions ↔ tasks |
| `extract_resources` | Many-to-many extracts ↔ projects/tasks |

### Task Page Architecture

The Tasks page (`client/src/pages/TasksPage.jsx`) provides a robust, interactive interface for managing the GTD/Kanban task pipeline.

#### Core Features
- **Dynamic Views**: Organizes tasks into status-based tabs (Actionable, Waiting, Scheduled, etc.) with a mobile-responsive dropdown menu.
- **Customizable Data Table**: 
  - **Column Management**: Toggle visibility of columns (Urgency, Priority, Project, Assignee, ECT, etc.).
  - **Interactive Layout**: Drag-and-drop column reordering and real-time column resizing.
  - **Advanced Sorting**: Multi-key sorting (Status weight, Priority level, Slack/Urgency calculation).
- **Selection & Bulk Editing**:
  - Desktop: Supports range selection (Shift + Click) and additive selection (Cmd/Ctrl + Click).
  - Mobile: Dedicated "Select Mode" toggle for easier multi-select on touch devices.
  - **Slide Drawer**: Integrated `TaskDrawer.jsx` for single-task detail editing and bulk updates (status, priority, project, assignee).
- **Inline Capture**: Quick task creation form at the top of the table.

#### Component Hierarchy
- **`TasksPage.jsx`**: Orchestrates state (selection, column config, sorting) and data fetching via `useTasks` hook.
- **`TaskCard.jsx`**: Renders individual rows with contextual styles (priority dots, urgency badges, overdue highlighting).
- **`TaskDrawer.jsx`**: A shared slide-out panel for modifying selected tasks. It supports single-task deep editing and bulk property updates.
- **`TaskSearchPopover.jsx`**: (Integrated in Pomodoro/Sidebar) Provides fuzzy search and quick creation of actionable tasks.

#### Logic & Data
- **`useTasks.js`**: A custom React hook that abstracts API calls for task CRUD operations, providing centralized loading and error states.
- **`taskMath.js`**: Utility library for calculating "Urgency" scores based on slack (due date - ECT) and formatting time durations.

---

## Quick Start

### Option A: Docker Compose (Recommended)

The fastest way to run Calendarly anywhere — local machine, home server, or cloud VPS.

#### 1. Set Up Environment Variables

```bash
cp .env.template .env
```

Edit `.env` and set a high-entropy encryption passphrase:

```env
DB_ENCRYPTION_KEY="your-secure-high-entropy-passphrase-here"
```

The template sets `DATABASE_PATH=/data/calendarly.db` so your database persists in a Docker named volume (`db-data`) and **survives container rebuilds**.

#### 2. Launch the Stack

```bash
docker-compose up --build -d
```

This builds and launches:
- **`calendarly-backend`** — Node.js Express API on port `3000`
- **`calendarly-frontend`** — Vite-built React app served by Nginx on port `5173`

#### 3. Open the Dashboard

Navigate to [http://localhost:5173](http://localhost:5173).

---

### Option B: Native Local Development

For developers who want to run the stack directly without Docker.

#### Prerequisites
- Node.js 20+
- npm or yarn
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

In a new terminal:

```bash
cd client
npm install
npm run dev
# Dev server runs on http://localhost:5173
```

---

### Option C: Home Server / VPS Deployment

Calendarly is designed to run as a persistent home server appliance.

#### 1. Provision a Server

Any Debian/Ubuntu-based system works:
- Raspberry Pi 4/5 with Raspberry Pi OS
- Intel NUC or old laptop with Ubuntu Server
- Cloud VPS (DigitalOcean, Hetzner, AWS Lightsail)

#### 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change
```

#### 3. Deploy Calendarly

```bash
git clone https://github.com/your-username/calendarly.git /opt/calendarly
cd /opt/calendarly
cp .env.template .env
# Edit .env with your encryption key
docker-compose up -d
```

#### 4. (Optional) Set Up a Reverse Proxy

For HTTPS and custom domains, put Nginx or Traefik in front:

```nginx
server {
    listen 443 ssl;
    server_name calendarly.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

---

### Option D: DietPI Chromebook Server (Low-Power Appliance)

Convert an old or secondary Chromebook into a dedicated, ultra-low-power **Calendarly home server** running **DietPI** — an optimized, lightweight Debian-based distribution.

#### Why DietPI + Chromebook?
- Chromebooks are inexpensive, silent, and power-efficient
- DietPI strips away bloat for maximum performance on minimal hardware
- Total power draw often under 5W — cheaper than leaving a desktop on 24/7
- Perfect for a always-on personal productivity server

#### Step 1: Install DietPI on the Chromebook

1. **Enable Developer Mode** on your Chromebook:
   - Hold `Esc + Refresh` and press the Power button
   - At the recovery screen, press `Ctrl + D` to enable Developer Mode
   - Wait for the transition (this wipes local data)

2. **Disable Verified Boot** and enable legacy boot if needed (varies by model)

3. **Flash DietPI** to a bootable USB drive or SD card:
   - Download the DietPI image for your Chromebook architecture (usually ARM or x86)
   - Flash with [Rufus](https://rufus.ie/) (Windows) or [BalenaEtcher](https://www.balena.io/etcher) (cross-platform)

4. **Boot from external media**:
   - Insert the USB/SD card
   - Press `Ctrl + U` at the ChromeOS developer mode screen to boot USB
   - Or install permanently by flashing the internal storage via DietPI's tools

5. **Complete DietPI first-run setup**:
   - Connect ethernet or WiFi
   - Change default passwords when prompted
   - Update system packages:
     ```bash
     dietpi-update
     ```

#### Step 2: Install Docker and Git via DietPI Software Center

DietPI has a custom, optimized software installation engine:

```bash
dietpi-software
```

1. Navigate to **Software Optimized**
2. Browse or search to select **Docker** and **Git**
3. Select **Install** and reboot when prompted

#### Step 3: Clone and Launch Calendarly

```bash
git clone https://github.com/your-username/calendarly.git /opt/calendarly
cd /opt/calendarly
cp .env.template .env
# Edit your DB_ENCRYPTION_KEY!
nano .env
docker-compose up -d
```

Your Calendarly server is now running on the Chromebook's local IP.

---

## Remote Access Without Port Forwarding (Tailscale)

Instead of exposing your server to the public internet, use **Tailscale** to create a zero-config, encrypted WireGuard mesh network.

### 1. Install Tailscale on the Server

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Click the authentication link to register the device. Note the assigned private IP (e.g., `100.x.y.z`).

### 2. Install Tailscale on Client Devices

Install Tailscale on your phone, laptop, and tablet. Once connected, all devices share a private encrypted network.

### 3. Access Calendarly Securely

From anywhere in the world:

```
http://100.x.y.z:5173
```

All traffic is end-to-end encrypted. No open ports. No DDNS. No certificate management.

---

## API Reference

All endpoints are served from `http://localhost:3000/api/*`. The API is REST/JSON with no authentication by default — see [Security Checklist](#security-checklist).

**Common patterns:**
- List endpoints accept query params for filtering (e.g., `?status=active`, `?date=2026-05-25`)
- All responses are `application/json`
- Errors follow `{ error: "message" }` with appropriate HTTP status codes
- Soft-deleted resources return `404` on subsequent reads

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
| `POST` | `/api/events/sync-block` | Upsert single or recurring event (pass `rrule` for recurrence) |
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

### Tasks `/api/tasks`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks` | List tasks; filters: `?project_id=`, `?status=`, `?unassigned=true`, `?q=search` |
| `POST` | `/api/tasks` | Create task `{ title, status?, project_id?, priority?, estimated_minutes? }` |
| `PATCH` | `/api/tasks/:id` | Update task; auto-sets `finished_date` on transition to Done |
| `DELETE` | `/api/tasks/:id` | Delete task |

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
| `GET` | `/api/extracts` | List extracts with resource links; filters: `?project_id=`, `?task_id=`, `?tags=`, `?q=`, `?bibliography=` |
| `GET` | `/api/extracts/:id` | Get single extract with full resource list |
| `POST` | `/api/extracts` | Create extract `{ content, bibliography?, chapter_section?, position?, tags? }` |
| `PATCH` | `/api/extracts/:id` | Update extract |
| `DELETE` | `/api/extracts/:id` | Delete extract |
| `POST` | `/api/extracts/:id/resources` | Link project or task `{ project_id? \| task_id? }` |
| `DELETE` | `/api/extracts/:id/resources` | Unlink project or task `{ project_id? \| task_id? }` |

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
| `GET` | `/api/pomodoro-sessions/:id` | Get single session |
| `POST` | `/api/pomodoro-sessions` | Create session (auto-status: active) `{ task_id, planned_duration_minutes }` |
| `PATCH` | `/api/pomodoro-sessions/:id` | Update session; auto-computes `actual_duration_minutes` |
| `DELETE` | `/api/pomodoro-sessions/:id` | Delete session |

---

### Distraction Notes `/api/distraction-notes`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/distraction-notes` | List distractions; filters: `?task_id=`, `?session_id=`, `?date_from=`, `?date_to=` |
| `GET` | `/api/distraction-notes/with-tasks` | Distractions joined with task titles |
| `POST` | `/api/distraction-notes` | Create distraction note `{ content, task_id?, pomodoro_session_id? }` |
| `POST` | `/api/distraction-notes/batch` | Batch insert multiple notes in a single transaction |
| `DELETE` | `/api/distraction-notes/:id` | Delete distraction note |

---

### Habits `/api/habits`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/habits` | List habits; `?area=`, `?include_archived=true` |
| `GET` | `/api/habits/:id` | Get habit with reminders array |
| `POST` | `/api/habits` | Create habit `{ name, area?, goal_type, min_per_day?, max_per_day?, reminders?: [{time_of_day}] }` |
| `PATCH` | `/api/habits/:id` | Update habit; reminders array fully synced if provided |
| `DELETE` | `/api/habits/:id` | Delete habit |

---

### Habit Logs `/api/habit-logs`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/habit-logs` | List logs; filters: `?habit_id=`, `?date=`, `?date_from=`, `?date_to=`, `?source=` |
| `GET` | `/api/habit-logs/today-summary` | All habits with today's log counts and streaks |
| `GET` | `/api/habit-logs/weekly-summary` | Habits with per-day logs and streaks for the current week |
| `POST` | `/api/habit-logs` | Create log `{ habit_id, logged_at?, count?, notes?, source? }` |
| `POST` | `/api/habit-logs/quick/:habit_id` | One-tap quick log (no body required) |
| `PATCH` | `/api/habit-logs/:id` | Update log |
| `DELETE` | `/api/habit-logs/:id` | Delete log |

---

### Code Agents `/api/code-agents`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/code-agents/stats` | Aggregated stats per agent (sessions, tokens, cost, time) |
| `GET` | `/api/code-agents` | List sessions; filters: `?agent=`, `?date_from=`, `?date_to=`; limit 200 |
| `POST` | `/api/code-agents` | Create session `{ agent, started_at, ended_at?, input_tokens?, output_tokens?, model? }` |
| `PATCH` | `/api/code-agents/:id` | Update session; cost auto-recomputed |
| `DELETE` | `/api/code-agents/:id` | Delete session |

---

### Analytics `/api/analytics`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/weekly-report` | Full weekly report: area hours plan vs measure, sleep alignment, task KPIs, project progression |

---

### Settings `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Fetch all settings, environment info, and backup file list |
| `POST` | `/api/settings` | Save database settings (timezone, theme, time format, etc.) |
| `POST` | `/api/settings/env` | Update `.env` variables (supports DB re-key for `DB_ENCRYPTION_KEY`) |
| `GET` | `/api/settings/backup/download` | Download latest backup as file |
| `POST` | `/api/settings/backup/upload` | Upload `.db` backup profile (with optional immediate activation) |
| `POST` | `/api/settings/backup/activate` | Activate a backup profile as the running database |
| `POST` | `/api/settings/backup/rename` | Rename a backup profile file |
| `DELETE` | `/api/settings/backup/:filename` | Delete a backup profile |
| `GET` | `/api/settings/gitignore-status` | Check `.gitignore` security coverage |

---

### Upload `/api/upload`

Requires `x-upload-password` header matching `SECRET_UPLOAD_PASSWORD` env var.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload/graphify` | Upload zip/tar/tar.gz archive, extract to `graphify-out/` |
| `GET` | `/api/upload/graphify/status` | Check extraction status |

---

### OpenCode `/api/opencode`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/opencode/sessions` | Cached OpenCode session list |
| `GET` | `/api/opencode/stats` | Parsed OpenCode usage stats |
| `GET` | `/api/opencode/sync` | Trigger live sync if OpenCode CLI is available |

---

### Health `/api/health`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check with timestamp and environment |
| `GET` | `/api/health/integrity-check` | Database integrity validation; auto-restores from golden backup on failure |
| `GET` | `/api/mcp` | Serve `OPENCLAW_MCP.md` specification for AI agents |

---

## Database Management

### Automatic Backups
Every time the server starts, it creates a timestamped backup in `server/backups/`. These "Golden Backups" are used for automatic recovery if corruption is detected.

### Manual Backup
Download the latest backup from the Settings page, or copy the file directly:

```bash
cp server/backups/calendarly-backup-*.db /your/safe/location/
```

### Restore from Backup
In the Settings UI:
1. Go to **Backup & Restore**
2. Upload a `.db` file or select an existing backup profile
3. Click **Activate** — the server swaps to the selected database

### Integrity Check
Visit `/api/health/integrity-check` to validate the database. If issues are found, the system can auto-restore from the highest-integrity Golden Backup.

---

## Security Checklist

- [ ] Set a strong `DB_ENCRYPTION_KEY` in `.env`
- [ ] Verify `.gitignore` protects `.env`, `*.db`, and `backups/`
- [ ] Set `SECRET_UPLOAD_PASSWORD` if using the archive upload feature
- [ ] Run behind Tailscale or a firewall — the app has no built-in authentication
- [ ] Keep backups in a separate location from the running server

> **For production or mobile app deployments:** Add JWT or API-key middleware to Express before exposing the API to a public network or mobile client. See [Mobile App Porting Guide](#mobile-app-porting-guide).

---

## Development Guide

### Running Tests

```bash
cd server
node scripts/test-db.js
```

### Database Migrations

The schema is managed idempotently via `addColumnIfMissing` in `db.js`. New columns are added automatically on server startup. For structural changes, modify the initialization SQL in `initDatabase()`.

### Adding a New Route

1. Create `server/routes/myresource.js` following the pattern of existing route files
2. Mount it in `server/server.js`:
   ```js
   const myResourceRoutes = require('./routes/myresource');
   app.use('/api/myresource', myResourceRoutes);
   ```
3. Add the table DDL to `db.js → initDatabase()`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_ENCRYPTION_KEY` | Yes (recommended) | SQLCipher passphrase for encryption at rest |
| `DATABASE_PATH` | Yes | Absolute path to the `.db` file |
| `PORT` | No (default: 3000) | Express server port |
| `NODE_ENV` | No | `development` or `production` |
| `SECRET_UPLOAD_PASSWORD` | No | Password for archive upload endpoint |
| `GEMINI_API_KEY` | No | Gemini AI integration (masked in Settings UI) |

---

## Mobile App Porting Guide

The Calendarly API is REST/JSON and fully mobile-ready. This section documents what needs to be done before exposing it to a mobile client.

### 1. Add Authentication

The API currently has **no authentication**. Before mobile deployment:

```js
// Recommended: JWT middleware in server.js
const jwt = require('jsonwebtoken');

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

// Apply to all routes except health
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/health')) return next();
  return authMiddleware(req, res, next);
});
```

### 2. CORS Configuration

Restrict CORS origins for production:

```js
// server/server.js
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://calendarly.yourdomain.com',
    // Add your mobile app's origin or Capacitor/Expo URL
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
```

### 3. Mobile-Optimized Endpoints

These endpoints are particularly well-suited for mobile use cases:

| Endpoint | Mobile Use Case |
|----------|----------------|
| `GET /api/habit-logs/today-summary` | Home screen widget — shows today's habit status |
| `GET /api/habit-logs/weekly-summary` | Habit streak card |
| `POST /api/habit-logs/quick/:habit_id` | One-tap habit logging from widget |
| `GET /api/analytics/weekly-report` | Dashboard overview screen |
| `GET /api/events?date=YYYY-MM-DD` | Daily calendar view |
| `GET /api/tasks?status=03+-+In+Progress` | Active task focus screen |
| `POST /api/pomodoro-sessions` | Start a focus session |
| `PATCH /api/pomodoro-sessions/:id` | End/pause session |

### 4. Offline Support (PWA)

For a Progressive Web App:

1. Add a `manifest.json` to `client/public/`
2. Register a Service Worker in `client/src/main.jsx`
3. Cache `GET` responses for events, tasks, habits using the Cache API
4. Queue mutations (POST/PATCH/DELETE) during offline and replay on reconnect

```json
// client/public/manifest.json
{
  "name": "Calendarly",
  "short_name": "Calendarly",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

### 5. React Native / Expo Port

The backend API requires no changes for React Native. Key considerations:

- Use `axios` or `fetch` with the server's Tailscale/LAN IP
- Store the JWT token in `SecureStore` (Expo) or `Keychain` (React Native)
- Use `react-navigation` bottom tab navigator matching the 5 primary tabs (Calendar, Tasks, Analytics, Habits, Settings)
- Deep link scheme: `calendarly://` for widget → app navigation
- Use `expo-notifications` for habit reminder push notifications (map to `habit_reminders` table)

### 6. Recommended Deep Link Structure

```
calendarly://calendar?date=2026-05-25
calendarly://task/:id
calendarly://habit/:id/log
calendarly://pomodoro/start?task_id=:id
```

---

## Roadmap & Contributing

Calendarly is a personal operating system that grows with its user. Planned directions include:

- Mobile-optimized PWA with offline support
- React Native / Expo mobile app
- Calendar import/export (ICS)
- Plugin system for custom analytics widgets
- Collaborative mode for household/team use
- AI-assisted weekly reflection summaries

Contributions, issues, and feature requests are welcome. This is a local-first app — your data stays yours.

---

## License

MIT — use it, fork it, run it on a Chromebook in your closet.
