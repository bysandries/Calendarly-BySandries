# Plan: Split `api.js` into domain modules

**Goal:** Decompose the 180-line, 50+ endpoint `api.js` into per-domain API modules,
eliminating its role as a god module with 31 consumers across the client.

---

## Step 1 — Create `client/src/utils/api/` directory with per-domain files

Move each group of exports into its own file. Every file re-exports the shared
`request` primitive so consumers never need to import from a "core" file directly.

### 1a. `api/core.js` — shared transport

```js
const API_BASE = '/api';

export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  const response = await fetch(url, config);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }
  return response.json();
}
```

### 1b. `api/index.js` — barrel re-export

```js
export { request } from './core';
export * from './tasks';
export * from './projects';
export * from './notes';
export * from './extracts';
export * from './areas';
export * from './events';
export * from './dailyLogs';
export * from './habits';
export * from './habitLogs';
export * from './people';
export * from './pomodoro';
export * from './distractionNotes';
export * from './codeAgents';
export * from './analytics';
export * from './personalCare';
export * from './opencode';
export * from './health';
```

### 1c. Per-domain files

| File | Exports | Consumers |
|---|---|---|
| `api/tasks.js` | `fetchTasks`, `createTask`, `updateTask`, `deleteTask` | `useTasks.js`, `TasksPage.jsx`, `ProjectDetailPage.jsx`, `ProjectsPage.jsx`, `ProjectDrawer.jsx`, `PomodoroPanel.jsx`, `SlideDrawer.jsx`, `PomodoroTaskCard.jsx`, `TaskSearchPopover.jsx` |
| `api/projects.js` | `fetchProjects`, `createProject`, `updateProject`, `deleteProject`, `fetchProjectSettings`, `updateProjectSettings` | `useProjects.js`, `ProjectDetailPage.jsx` |
| `api/notes.js` | `fetchNotes`, `fetchNote`, `createNote`, `updateNote`, `deleteNote` | `useNotes.js` |
| `api/extracts.js` | `fetchExtracts`, `fetchExtract`, `createExtract`, `updateExtract`, `deleteExtract`, `linkExtractResource`, `unlinkExtractResource`, `fetchExtractLinks`, `addExtractLink`, `removeExtractLink` | `useExtracts.js`, `NotesPage.jsx` |
| `api/areas.js` | `fetchAreas`, `createArea`, `updateArea`, `deleteArea`, `updateAreaColor`, `archiveArea`, `unarchiveArea` | `NotesPage.jsx`, `ProjectDetailPage.jsx`, `ProjectsPage.jsx`, `ProjectDrawer.jsx`, `TaskDetailPage.jsx`, `TasksPage.jsx`, `PersonDetailPage.jsx`, `PomodoroPanel.jsx`, `SlideDrawer.jsx`, `HabitEditDrawer.jsx`, `AreaPicker.jsx` |
| `api/events.js` | `fetchEventsRange`, `fetchEvents`, `syncEventBlock`, `logMeasure`, `clonePlan`, `deleteEvent`, `updateEvent`, `fetchEventTasks`, `linkTaskToEvent`, `unlinkTaskFromEvent` | `CalendarGrid.jsx`, `SlideDrawer.jsx`, `GTDInbox.jsx` |
| `api/dailyLogs.js` | `fetchDailyLogsRange`, `fetchDailyLog`, `upsertDailyLog` | (grep: no current consumers beyond api.js itself) |
| `api/habits.js` | `fetchHabits`, `fetchHabit`, `createHabit`, `updateHabit`, `deleteHabit` | `HabitEditDrawer.jsx` |
| `api/habitLogs.js` | `fetchHabitLogs`, `fetchHabitsTodaySummary`, `fetchHabitsWeeklySummary`, `logHabit`, `createHabitLog`, `updateHabitLog`, `deleteHabitLog` | `HabitsPage.jsx`, `HabitEditDrawer.jsx`, `HabitLogDrawer.jsx`, `HabitDayDrawer.jsx` |
| `api/people.js` | `fetchPeople`, `createPerson`, `updatePerson`, `deletePerson` | `usePeople.js` |
| `api/pomodoro.js` | `fetchPomodoroSessions`, `fetchPomodoroSession`, `createPomodoroSession`, `updatePomodoroSession`, `deletePomodoroSession`, `fetchPomodoroTimeByTask` | `usePomodoro.js`, `TaskTimeTracker.jsx` |
| `api/distractionNotes.js` | `fetchDistractionNotes`, `fetchDistractionNotesWithTasks`, `createDistractionNote`, `createDistractionNotesBatch`, `deleteDistractionNote` | `DistractionNotesReflection.jsx` |
| `api/codeAgents.js` | `fetchCodeAgentSessions`, `fetchCodeAgentStats`, `createCodeAgentSession`, `updateCodeAgentSession`, `deleteCodeAgentSession` | `AgentsPage.jsx` |
| `api/analytics.js` | `fetchWeeklyReport` | `Analytics.jsx` |
| `api/personalCare.js` | `fetchPersonalCareSummary` | `PersonalCarePage.jsx` |
| `api/opencode.js` | `fetchOpenCodeSessions`, `fetchOpenCodeStats`, `syncOpenCode` | (grep: no current consumers) |
| `api/health.js` | `checkHealth` | `Sidebar.jsx` |

---

## Step 2 — Update every consumer (31 files)

Scripted find-and-replace per file. Example transformations:

| Before | After |
|---|---|
| `import { fetchTasks, createTask } from '../utils/api'` | `import { fetchTasks, createTask } from '../utils/api/tasks'` |
| `import { fetchPeople, createPerson } from '../utils/api'` | `import { fetchPeople, createPerson } from '../utils/api/people'` |
| `import { checkHealth } from '../../utils/api'` | `import { checkHealth } from '../../utils/api/health'` |

For files that import from multiple domains (e.g. `SlideDrawer.jsx`, `ProjectDrawer.jsx`,
`HabitEditDrawer.jsx`), split into separate import lines:

```js
import { fetchAreas } from '../utils/api/areas';
import { fetchTasks, fetchEventTasks, linkTaskToEvent, unlinkTaskFromEvent } from '../utils/api/events';
```

---

## Step 3 — Delete the old monolithic `api.js`

After Step 2 is complete and verified, remove `client/src/utils/api.js`.

---

## Step 4 — Verification

1. `cd client && npm run build` — no import errors
2. `cd client && npm run lint` — no unused-import warnings
3. Click through every page in the running app — no 404s on API calls

---

## Migration strategy

**Option A (recommended):** Do Steps 1, 2, 3 in a single commit with a script.
The barrel `api/index.js` is optional — consumers import from per-domain files
directly, making `api.js`'s web of dependencies explicit in every file header.

**Option B (gradual):** Keep `api.js` as a barrel at first:

```js
// api.js (barrel only, after Step 1)
export * from './api/tasks';
export * from './api/projects';
// ...
```

Migrate consumers one at a time, then delete `api.js` when nothing imports it.
