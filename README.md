# Calendarly

> **Sleek, Local-First Performance Tracking & Retrospective Scheduler**
>
> Built on a Glassmorphic Pure Black Canvas with vibrant Neon Accents. Designed for high-agency engineers to organize, execute, and reflect on productivity using the **PALM Methodology** (Plan, Act, Measure, Learn).

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

### Areas of Life
- **7 Default Areas** — Sleep, Work, Math, Coding, Creative, Fitness, General
- **Custom Areas** — Create your own life categories with hex color coding
- **Color Cascading** — Area color changes propagate to all associated events
- **Event Categorization** — Every time block belongs to an area for analytics grouping

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
Calendarly
├── client/          # React 19 + Vite frontend
│   ├── React Router DOM for SPA routing
│   ├── Luxon for timezone-aware dates
│   ├── React Markdown for note preview
│   └── Glassmorphic UI on pure black canvas
│
├── server/          # Node.js + Express backend
│   ├── SQLite with SQLCipher encryption
│   ├── Idempotent schema migrations
│   ├── RESTful API routes for all entities
│   └── Background backup & integrity services
│
└── docker-compose.yml  # One-command full stack deployment
```

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, React Router DOM 7, Luxon |
| Backend | Node.js, Express 4, CORS |
| Database | SQLite with SQLCipher (`@journeyapps/sqlcipher`) |
| Proxy | Nginx (production static serving) |
| Container | Docker + Docker Compose |

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

## API Endpoints

Calendarly exposes a comprehensive REST API:

| Resource | Base Route | Key Operations |
|----------|------------|----------------|
| Events | `/api/events` | CRUD, sync-block, clone-plan, log-measure, task linking |
| Areas | `/api/areas` | CRUD, color cascading |
| Projects | `/api/projects` | CRUD, two-stage delete, stats aggregation |
| Tasks | `/api/tasks` | CRUD, search, filter, bulk actions |
| Notes | `/api/notes` | CRUD, task linking, tags |
| Extracts | `/api/extracts` | CRUD, resource linking, bibliography |
| Daily Logs | `/api/daily-logs` | Upsert journal entries by date |
| Analytics | `/api/analytics` | Weekly reports, KPIs |
| Pomodoro | `/api/pomodoro-sessions` | Session CRUD, task aggregation |
| Distractions | `/api/distraction-notes` | Capture & review interruptions |
| Settings | `/api/settings` | Preferences, env vars, backup management |
| Upload | `/api/upload` | Password-protected archive import |
| Health | `/api/health` | Liveness, integrity check, auto-restore |

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

---

## Development

### Project Structure

```
calendarly/
├── client/
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/          # Route-level page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # API clients and helpers
│   │   └── App.jsx         # Root router and layout
│   ├── public/             # Static assets
│   └── index.html
├── server/
│   ├── routes/             # Express route handlers
│   ├── scripts/            # Migration and utility scripts
│   ├── db.js               # Database connection & migrations
│   ├── server.js           # Express app bootstrap
│   └── backup-db.js        # Golden backup service
├── docker-compose.yml
├── .env.template
└── README.md
```

### Running Tests

```bash
cd server
node scripts/test-db.js
```

### Database Migrations

The schema is managed idempotently via `addColumnIfMissing` in `db.js`. New columns are added automatically on server startup. For structural changes, modify the initialization SQL in `initDatabase()`.

---

## Roadmap & Contributing

Calendarly is a personal operating system that grows with its user. Planned directions include:

- Mobile-optimized PWA with offline support
- Calendar import/export (ICS)
- Plugin system for custom analytics widgets
- Collaborative mode for household/team use
- AI-assisted weekly reflection summaries

Contributions, issues, and feature requests are welcome. This is a local-first app — your data stays yours.

---

## License

MIT — use it, fork it, run it on a Chromebook in your closet.
