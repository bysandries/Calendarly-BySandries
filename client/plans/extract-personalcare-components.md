# Plan: Extract inline sub-components from `PersonalCarePage.jsx`

**Goal:** Split the 445-line `PersonalCarePage.jsx` into one file per component under
`components/PersonalCare/`, eliminating its 9 inline sub-components and shared helpers.

---

## Current structure

```
pages/PersonalCarePage.jsx  (445 lines)
├── Constants: ACCENT, STROKE
├── Helpers:   getDashoffset(), fmtDur(), sleepColor(), goalStatus()
├── <KpiGauge />              — SVG radial gauge (used by all 4 KPIs)
├── <SleepKPI />              — Sleep score card
├── <BuildKPI />              — Build habits card
├── <QuitKPI />               — Quit habits card
├── <ProjectsKPI />           — Care projects card
├── <SleepSparklinePanel />   — 7-day sleep bar chart
├── <NextSessionPanel />      — Upcoming therapy session
├── <HabitBalancePanel />     — Build vs quit weekly split
├── <GoalsPanel />            — Therapy goal extracts
├── <CareProjectsPanel />     — Project progress cards
└── <PersonalCarePage />      — Page shell (data fetching, layout)
```

## Shared dependencies

| Helper | Used by |
|---|---|
| `getDashoffset(pct)` | KpiGauge |
| `fmtDur(mins)` | SleepKPI, SleepSparklinePanel, NextSessionPanel |
| `sleepColor(minutes, goal)` | SleepKPI, SleepSparklinePanel |
| `goalStatus(tags)` | GoalsPanel |
| `ACCENT` ('#FF6B9D') | ProjectsKPI, CareProjectsPanel |
| `STROKE` (188.5) | KpiGauge |
| `KpiGauge` component | SleepKPI, BuildKPI, QuitKPI, ProjectsKPI |

---

## Step 1 — Create `components/PersonalCare/` directory

```
client/src/components/PersonalCare/
├── helpers.js         — getDashoffset, fmtDur, sleepColor, goalStatus, ACCENT, STROKE
├── KpiGauge.jsx       — SVG radial gauge
├── SleepKPI.jsx       — Sleep score card
├── BuildKPI.jsx       — Build habits card
├── QuitKPI.jsx        — Quit habits card
├── ProjectsKPI.jsx    — Care projects card
├── SleepSparklinePanel.jsx  — 7-day sleep bar chart
├── NextSessionPanel.jsx     — Upcoming therapy session
├── HabitBalancePanel.jsx    — Build vs quit split
├── GoalsPanel.jsx           — Therapy goal extracts
└── CareProjectsPanel.jsx    — Project progress cards
```

### 1a. `helpers.js` — shared constants & pure functions

```js
export const ACCENT = '#FF6B9D';
export const STROKE = 188.5; // 2π × r=30

export function getDashoffset(pct) {
  const p = Math.min(Math.max(pct, 0), 100);
  return STROKE - (p / 100) * STROKE;
}

export function fmtDur(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

export function sleepColor(minutes, goal) {
  if (minutes >= goal) return '#2ECC71';
  if (minutes >= 300)  return '#F1C40F';
  if (minutes > 0)     return '#E74C3C';
  return 'var(--text-dimmed)';
}

export function goalStatus(tags) {
  const t = (tags || '').toLowerCase();
  if (t.includes('status:done') || t.includes('done')) return { icon: '✓', color: '#2ECC71', label: 'Done' };
  if (t.includes('status:wip')  || t.includes('wip'))  return { icon: '◔', color: '#F1C40F', label: 'WIP' };
  return { icon: '○', color: 'var(--text-dimmed)', label: 'Open' };
}
```

### 1b. Per-component files

Each file receives its props via a single prop object (same shape as current inline usage).

| File | Imported helpers | Props |
|---|---|---|
| `KpiGauge.jsx` | `STROKE`, `getDashoffset` | `{ pct, fillClass }` |
| `SleepKPI.jsx` | `fmtDur`, `sleepColor`, `KpiGauge` | `{ sleep }` |
| `BuildKPI.jsx` | `KpiGauge` | `{ ratio }` |
| `QuitKPI.jsx` | `KpiGauge` | `{ ratio }` |
| `ProjectsKPI.jsx` | `ACCENT`, `KpiGauge` | `{ projects }` |
| `SleepSparklinePanel.jsx` | `fmtDur`, `sleepColor` | `{ sleep }` |
| `NextSessionPanel.jsx` | `fmtDur` (and `Link` from react-router-dom) | `{ session }` |
| `HabitBalancePanel.jsx` | (and `Link` from react-router-dom) | `{ ratio }` |
| `GoalsPanel.jsx` | `goalStatus` (and `Link` from react-router-dom) | `{ goals }` |
| `CareProjectsPanel.jsx` | `ACCENT` (and `Link` from react-router-dom) | `{ projects }` |

---

## Step 2 — Shrink `PersonalCarePage.jsx` to ~50 lines

After extraction, the page file becomes:

```jsx
import { useEffect, useState } from 'react';
import { fetchPersonalCareSummary } from '../utils/api/personalCare';
import { SleepKPI, BuildKPI, QuitKPI, ProjectsKPI } from '../components/PersonalCare/SleepKPI';
// ... 8 more imports

export default function PersonalCarePage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchPersonalCareSummary()
      .then(d => { if (!cancelled) { setSummary(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const { next_session, sleep_7d, previous_goals = [], habit_ratio, personal_care_projects = [] } = summary || {};

  // ... render with imported components, loading skeleton, error state
}
```

Remove these from the file:
- Lines 7–34 (constants & helpers) → `helpers.js`
- Lines 37–48 (KpiGauge) → `KpiGauge.jsx`
- Lines 51–125 (SleepKPI, BuildKPI, QuitKPI, ProjectsKPI) → 4 files
- Lines 128–362 (SleepSparklinePanel, NextSessionPanel, HabitBalancePanel, GoalsPanel, CareProjectsPanel) → 5 files

---

## Step 3 — Verification

1. `cd client && npm run build` — no import errors
2. Navigate to `/personal-care` in the running app — all KPI cards and panels render correctly
3. Check sleep data renders, habits render, therapy session renders, error state renders, loading skeleton renders

---

## Migration strategy

**Atomic (recommended):** Create all 11 files, update the import in `PersonalCarePage.jsx`,
verify with build, done in one commit.

**Key risk:** If any component's prop shape changes in the future, only the individual
component file needs updating — no risk of touching the page shell or other components.
