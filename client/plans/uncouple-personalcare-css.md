# Plan: Uncouple `PersonalCarePage.jsx` from `Analytics.css`

**Goal:** Remove the cross-component CSS import `import '../components/Analytics.css'`
from `PersonalCarePage.jsx` by extracting shared design-system classes into a
neutral location.

---

## Problem

```jsx
// PersonalCarePage.jsx:4
import '../components/Analytics.css';   // ← cross-component coupling
import './PersonalDashboard.css';
```

PersonalCarePage uses **22 CSS class sets** defined in `Analytics.css`:

```
.kpi-grid           .kpi-card            .kpi-details
.kpi-title          .kpi-value           .kpi-subtext
.kpi-gauge-container  .kpi-radial-svg    .kpi-radial-bg
.kpi-radial-fill    .kpi-radial-text
.dashboard-grid     .dashboard-panel     .panel-header
.panel-title        .panel-subtitle
.no-analytics-data  .no-data-icon
.project-progress-list   .project-progress-card
.proj-card-top      .proj-card-title     .proj-card-badge
.proj-card-badge.*-phase  .proj-progress-stats
.proj-progress-bar-container  .proj-progress-bar-fill
.proj-card-footer
```

These are **not analytics-specific** — they are shared UI primitives (glass panels,
KPI cards, progress bars, empty states) used by both the Analytics component and
the Personal Care dashboard.

---

## Step 1 — Create `client/src/styles/shared-dashboard.css`

Extract the shared class definitions from `Analytics.css` into a new file.

**What moves:**

| CSS section | Classes | Lines in Analytics.css |
|---|---|---|
| KPI Grid | `.kpi-grid` | 87–91 |
| KPI Card | `.kpi-card`, `.kpi-details`, `.kpi-title`, `.kpi-value`, `.kpi-subtext` | 93–137 |
| Gauge | `.kpi-gauge-container`, `.kpi-radial-*` | 139–171 |
| Dashboard Grid | `.dashboard-grid` (not the media query) | 222–226 |
| Dashboard Panel | `.dashboard-panel` | 234–240 |
| Panel Header | `.panel-header`, `.panel-title`, `.panel-subtitle` | 242–260 |
| Empty State | `.no-analytics-data`, `.no-data-icon` | 373–386 |
| Project Progress | `.project-progress-*`, `.proj-*` | 389–476 |

**What stays in `Analytics.css`:**

| Section | Reason |
|---|---|
| `.analytics-container`, `.analytics-filter-*` | Analytics-specific layout |
| `.btn-filter-apply` | Analytics-specific button |
| `.kpi-card.sleep`, `.kpi-card.tasks`, `.kpi-card.events` | Analytics-specific glow variants |
| `.chart-*` (comparison chart bars, legend) | Only used in Analytics |
| `.project-phases-summary`, `.phase-counter` | Analytics-specific summary |
| `.task-time-*` | Only used in Analytics's TaskTimeTracker |
| `.distraction-*` | Only used in Analytics's DistractionNotesReflection |
| `.dashboard-grid` media query | Kept in `Analytics.css` and duplicated in `PersonalDashboard.css` |

**The new file** `client/src/styles/shared-dashboard.css`:

```css
/* ═══════════════════════════════════════════════════════════
   Shared Dashboard Primitives — KPI cards, panels, progress
   Used by: Analytics.jsx, PersonalCarePage.jsx
   ═══════════════════════════════════════════════════════════ */

/* ── KPI Grid ── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* ── KPI Card ── */
.kpi-card { /* ... full definition from Analytics.css lines 93-110 */ }
.kpi-details { /* ... lines 112-117 */ }
.kpi-title { /* ... lines 119-125 */ }
.kpi-value { /* ... lines 127-132 */ }
.kpi-subtext { /* ... lines 134-137 */ }

/* ── Gauge ── */
.kpi-gauge-container { /* ... lines 139-146 */ }
.kpi-radial-svg { /* ... lines 148-150 */ }
.kpi-radial-bg { /* ... lines 152-156 */ }
.kpi-radial-fill { /* ... lines 158-163 */ }
.kpi-radial-text { /* ... lines 165-171 */ }

/* ── Dashboard Grid & Panel ── */
.dashboard-panel { /* ... lines 234-240 */ }
.panel-header { /* ... lines 242-247 */ }
.panel-title { /* ... lines 249-254 */ }
.panel-subtitle { /* ... lines 256-260 */ }

/* ── Empty State ── */
.no-analytics-data { /* ... lines 373-381 */ }
.no-data-icon { /* ... lines 383-386 */ }

/* ── Project Progress Cards ── */
.project-progress-list { /* ... lines 389-396 */ }
.project-progress-card { /* ... lines 398-412 */ }
/* etc. */
```

## Step 2 — Update imports

| File | Before | After |
|---|---|---|
| `components/Analytics.jsx:3` | `import './Analytics.css'` | `import './Analytics.css'` (unchanged — Analytics.css keeps its own styles) |
| `components/Analytics.jsx` | — | `import '../styles/shared-dashboard.css'` (for the extracted shared classes) |
| `pages/PersonalCarePage.jsx:4` | `import '../components/Analytics.css'` | `import '../styles/shared-dashboard.css'` |

## Step 3 — Remove duplicated media query

`PersonalDashboard.css:269-275` already defines its own `.dashboard-grid` override:

```css
.pd-main-grid { grid-template-columns: 3fr 2fr; }
.pd-lower-grid { grid-template-columns: 3fr 2fr; }
```

The shared `.dashboard-grid` from Analytics.css defines the base (also 3fr 2fr).
After extraction, move the base class into `shared-dashboard.css` and keep the
`.pd-*` overrides in `PersonalDashboard.css`.

## Step 4 — Verification

1. `cd client && npm run build` — no missing CSS class warnings
2. Compare `/analytics` and `/personal-care` side by side — KPI cards, panels, project
   progress cards should render identically
3. Resize to mobile — both pages should stack to single column
4. Check Analytics page still has its unique styles (filter bar, comparison chart,
   task time tracker, distraction notes)

## Future-proofing

When new dashboard-like pages are added, they import `shared-dashboard.css` instead
of reaching into another component's CSS directory. The barrier to sharing is now
zero — no cross-component coupling.
