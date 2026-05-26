# Personal Care Dashboard - Implementation Plan

## Project Overview
Build a unified personal care dashboard that integrates therapy tracking, sleep monitoring, habits, goals, and personal care projects. This dashboard will help track progress toward personal care and self-development goals.

## Current System Architecture

### Database Tables (Core Systems)
- **areas** - Categories (sleep, work, coding, creative, fitness, general)
- **projects** - Major projects tied to areas with status/phase/pillar
- **tasks** - Actionable items in projects
- **events** - Calendar events with plan/measure columns and duration_mins
- **extracts** - Notes/highlights from readings with bibliography, chapter_section, position, tags
- **extract_resources** - Links extracts to projects/tasks
- **habits** - Discrete trackable actions (build vs quit goal types)
- **habit_logs** - Timestamped habit occurrences tied to date_id
- **DailyLogs** - Daily log entries tied to calendar dates
- **notes** - General note management

### Key Relationships
- **Events** have `column_type` ('plan' or 'measure') to track intention vs reality
- **Events** have `duration_mins` in the measure column for actual time tracking
- **Extracts** can link to projects/tasks but NOT to each other (yet)
- **Habits** track progress toward goals (build/quit)
- **Projects** are grouped by area and have phase tracking (Plan → Act → Measure → Learn)

---

## Feature 1: Extract Linking System

### Requirements
- Allow extracts to link to other extracts by extract_id
- Modify extract popover to enable search/selection of extracts when creating new ones
- Store relationships in database
- Display linked extracts in the extract detail view

### Database Changes
**New Table: `extract_links`**
```sql
CREATE TABLE extract_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_extract_id TEXT NOT NULL,
  target_extract_id TEXT NOT NULL,
  relationship_type TEXT DEFAULT 'references', -- can be: references, contradicts, supports, builds_on
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_extract_id) REFERENCES extracts(id) ON DELETE CASCADE,
  FOREIGN KEY(target_extract_id) REFERENCES extracts(id) ON DELETE CASCADE,
  UNIQUE(source_extract_id, target_extract_id)
);
```

### Frontend Changes
1. **Extract Popover** (`CreationPopover.jsx`)
   - Add extract search/lookup field
   - Display autocomplete of existing extracts
   - Allow selection of extract to link
   
2. **NotesPage.jsx**
   - Show "Linked Extracts" section in extract detail
   - Display extract-to-extract relationships
   - Add UI to remove links

3. **useExtracts Hook**
   - Add `linkExtracts()` method
   - Add `unlinkExtracts()` method
   - Fetch linked extracts when loading detail

### Backend API Changes
- `POST /api/extracts/:id/links` - Create link between extracts
- `DELETE /api/extracts/:id/links/:targetId` - Remove link
- Update `GET /api/extracts/:id` to include linked extracts

---

## Feature 2: Therapy-Specific Extract Tagging

### Requirements
- Add "therapy" tag to relevant extracts
- Filter extracts by therapy tag in UI
- Link therapy extracts to goals and sessions

### Implementation
- Use existing `tags` field in extracts table (comma-separated)
- Add UI filter for "therapy" tag in NotesPage
- Tag convention: therapy extracts get tags like `therapy, session-001, topic:anxiety`
- Extract detail shows therapy context (date, session number)

---

## Feature 3: Therapy Project & Homework System

### New Project: "Therapy Homework"
**Properties:**
- id: `therapy-homework`
- area: `personal-care` (new area to be added)
- status: `active`
- pillar: `Resilience`
- phase: `Act`
- description: "Tasks and homework assigned during therapy sessions"

### Database Changes
**Add new area: "personal-care"**
```sql
INSERT INTO areas (id, name, color_hex, description) 
VALUES ('personal-care', 'Personal Care', '#FF6B9D', 'Therapy, wellness, and self-care');
```

**Add project:**
```sql
INSERT INTO projects (id, title, status, area, pillar, methodology, phase, description)
VALUES ('therapy-homework', 'Therapy Homework', 'active', 'personal-care', 'Resilience', 'PALM', 'Act', 
  'Tasks and homework assigned during therapy sessions');
```

### Frontend Implementation
- Create therapy homework tasks in the personal-care project
- Link therapy goals ↔ homework tasks (manual, not automatic)
- Show task status in personal care dashboard

---

## Feature 4: Therapy Session Tracking Dashboard

### Dashboard Layout (Top Priority)

#### Section 1: Next Therapy Session
- Display date, time, and location
- Show goals from previous session (read-only)
- Quick add button: "Add note for next session"
- Calendar integration: show therapy session events

#### Section 2: Sleep Performance Widget
- Calculate 7-day rolling average from measure column in events
- Display as: `Real Average / 7 hours goal` (ratio format)
- Visual indicator: green if ≥7h, yellow if 5-7h, red if <5h
- Sparkline showing last 7 days trend

#### Section 3: Previous Session Goals
- Display goals from last therapy session
- Status indicators: achieved, in-progress, not started
- Filterable/searchable list
- Link to related habits or projects

#### Section 4: Habit Balance Ratio
- Count habits with goal_type='build' vs goal_type='quit'
- Display as ratio: e.g., "4 Build : 2 Quit"
- Visual progress: pie chart or bar
- Show weekly completion rate for each type

#### Section 5: Personal Care Projects
- Filter projects where area='personal-care'
- Show status, phase, and progress
- Display due dates
- Mini-project cards with task count

### Component Structure
```
PersonalCareDashboard/
├── NextSessionWidget.jsx
├── SleepPerformanceWidget.jsx
├── PreviousGoalsWidget.jsx
├── HabitRatioWidget.jsx
├── PersonalCareProjectsWidget.jsx
└── PersonalCareDashboard.css
```

### Database Queries Needed
1. Get next therapy session from events (area='therapy', column_type='plan')
2. Get therapy session notes from extracts (tagged 'therapy')
3. Calculate sleep average from events (area='sleep', column_type='measure', last 7 days)
4. Get previous session goals from extracts
5. Count build vs quit habits
6. Get personal-care projects with task counts

---

## Feature 5: Reminders via Line Bot

### Requirements (Investigation Phase)
- Send reminders to add therapy session notes via Line Bot
- No OpenClaw token dependency
- Allow setting reminder time/frequency
- Store reminder configuration

### Database Changes
**New Table: `therapy_reminders`**
```sql
CREATE TABLE therapy_reminders (
  id TEXT PRIMARY KEY,
  user_line_id TEXT,
  reminder_type TEXT, -- 'before-session', 'after-session', 'homework'
  enabled INTEGER DEFAULT 1,
  reminder_hour INTEGER, -- 0-23
  reminder_minute INTEGER, -- 0-59
  reminder_day_offset INTEGER, -- days before/after session
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_line_id) REFERENCES users(line_id)
);
```

### Implementation Phases
1. **Phase 1: Core Structure**
   - Add therapy_reminders table
   - Create Line Bot webhook receiver
   - Store Line user_id mapping

2. **Phase 2: Reminder Logic**
   - Set up scheduled job to check reminders
   - Send Line message for due reminders
   - Track reminder sent status

3. **Phase 3: User Configuration**
   - UI to configure reminders in Settings
   - Allow on/off per reminder type
   - Adjust timing

---

## Feature 6: Extract Search in Popovers

### Current Issue
- When creating new extracts, no way to search for existing extracts to link
- Popover only has project/task linking

### Solution
Add extract search field to CreationPopover:
```
[Input] Search extracts... 🔍
[List of matching extracts with preview]
```

### Implementation
1. Enhance `CreationPopover.jsx`
   - Add search input for extracts
   - Implement fuzzy search on content/tags
   - Show extract preview (first 100 chars)
   - Allow multi-select to link multiple

2. Update extraction creation logic
   - Accept array of extract_ids to link
   - Call new linkExtracts API

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add "personal-care" area
- [ ] Add "Therapy Homework" project
- [ ] Create extract_links table
- [ ] Implement extract-to-extract linking API

### Phase 2: Dashboard (Week 2)
- [ ] Build NextSessionWidget
- [ ] Build SleepPerformanceWidget
- [ ] Build PreviousGoalsWidget
- [ ] Create PersonalCareDashboard page/route

### Phase 3: Habits & Projects (Week 3)
- [ ] Build HabitRatioWidget
- [ ] Build PersonalCareProjectsWidget
- [ ] Update projects filtering by area
- [ ] Add dashboard styling

### Phase 4: Line Bot Investigation (Week 4)
- [ ] Research Line Bot SDK/API
- [ ] Prototype webhook receiver
- [ ] Test message sending
- [ ] Determine token-free auth approach

### Phase 5: Polish (Week 5)
- [ ] Add extract search to popovers
- [ ] Connect therapy notes to dashboard
- [ ] Testing & refinement
- [ ] Documentation

---

## Key Questions for Refinement

1. **Therapy Session Tracking**: Should therapy sessions be tracked in the calendar (events) or as a separate therapy_sessions table?
2. **Goal Storage**: Store previous session goals as extracts with therapy tag, or in a separate goals table?
3. **Sleep Data**: Should we also accept Apple Health / Oura Ring imports, or only calendar measure column for now?
4. **Line Bot**: Do you have a Line Bot already set up, or is this completely new?
5. **Habits Linking**: Should therapy homework tasks automatically create/link to habits, or always manual?

---

## API Endpoint Summary (To Create)

### Extracts
- `GET /api/extracts/:id/links` - Get linked extracts
- `POST /api/extracts/:id/links` - Link extract to another
- `DELETE /api/extracts/:id/links/:targetId` - Unlink

### Personal Care Dashboard
- `GET /api/personal-care/next-session` - Next therapy session
- `GET /api/personal-care/sleep-stats?days=7` - Sleep performance
- `GET /api/personal-care/session-goals` - Previous session goals
- `GET /api/personal-care/habit-ratio` - Build vs quit count
- `GET /api/personal-care/projects` - Personal care projects

### Line Bot (Investigation)
- `POST /api/line/webhook` - Receive Line messages
- `POST /api/line/send-reminder` - Send reminder to user

---

## Notes
- Prioritize the dashboard first (most user-facing value)
- Extract linking is a prerequisite for dashboard accuracy
- Line Bot is secondary - can be phased in later
- Keep therapy tag convention consistent across extracts
- Personal care area is new and should be visually distinct
