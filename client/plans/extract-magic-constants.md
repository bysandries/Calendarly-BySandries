# Plan: Move Magic Constants & Helpers Out of Render Code

**Goal:** Eliminate inline constants and duplicated helpers in
`PersonalCarePage.jsx` and `Analytics.jsx` by extracting them to
shared utility modules.

**Targets:**

| Symbol | Defined In | Duplicated In | Destination |
|---|---|---|---|
| `STROKE = 188.5` | PersonalCarePage.jsx:8 | Analytics.jsx:87 | `lib/chartHelpers.js` |
| `getDashoffset()` | PersonalCarePage.jsx:10-13 | Analytics.jsx:88-91 | `lib/chartHelpers.js` |
| `fmtDur()` | PersonalCarePage.jsx:15-20 | `lib/taskMath.js` `formatDuration()` | **Replace with import** |
| `sleepColor()` | PersonalCarePage.jsx:22-27 | — | `utils/personalCareHelpers.js` |
| `goalStatus()` | PersonalCarePage.jsx:29-34 | — | `utils/personalCareHelpers.js` |
| `ACCENT = '#FF6B9D'` | PersonalCarePage.jsx:7 | — | `utils/personalCareHelpers.js` |

---

## Step 1 — Create `lib/chartHelpers.js`

Extract the shared SVG stroke constant and dashoffset function used by both
the Analytics dashboard and the Personal Care dashboard.

```js
// Shared chart/math helpers for radial gauges
// (consumed by Analytics.jsx and PersonalCarePage.jsx)

export const RADIAL_STROKE = 188.5; // 2π × r=30

export function getDashoffset(percent) {
  const pct = Math.min(Math.max(percent, 0), 100);
  return RADIAL_STROKE - (pct / 100) * RADIAL_STROKE;
}
```

**Why `lib/` and not `utils/`:** The project already has `lib/taskMath.js` for
pure domain math — this follows the same convention for chart math.

---

## Step 2 — Create `utils/personalCareHelpers.js`

PersonalCare-specific helpers and constants (no other consumer).

```js
// Personal Care domain helpers
// (consumed only by PersonalCarePage.jsx)

export const ACCENT = '#FF6B9D';

export function sleepColor(minutes, goal) {
  if (minutes >= goal) return '#2ECC71';
  if (minutes >= 300)  return '#F1C40F';
  if (minutes > 0)     return '#E74C3C';
  return 'var(--text-dimmed)';
}

export function goalStatus(tags) {
  const t = (tags || '').toLowerCase();
  if (t.includes('status:done') || t.includes('done'))
    return { icon: '✓', color: '#2ECC71', label: 'Done' };
  if (t.includes('status:wip')  || t.includes('wip'))
    return { icon: '◔', color: '#F1C40F', label: 'WIP' };
  return { icon: '○', color: 'var(--text-dimmed)', label: 'Open' };
}
```

---

## Step 3 — Refactor `PersonalCarePage.jsx`

Remove lines 7-34 entirely (ACCENT, STROKE, getDashoffset, fmtDur, sleepColor,
goalStatus). Add three imports at the top:

```js
import { formatDuration }  from '../lib/taskMath';          // replaces fmtDur
import { getDashoffset, RADIAL_STROKE } from '../lib/chartHelpers';
import { ACCENT, sleepColor, goalStatus } from '../utils/personalCareHelpers';
```

Inline replacements:
- `STROKE` → `RADIAL_STROKE`
- `fmtDur(x)` → `formatDuration(x)` (identical behavior)

---

## Step 4 — Refactor `Analytics.jsx`

Remove the inline `strokeDasharray` (line 87) and `getDashoffset` (lines 88-91).
Add one import:

```js
import { getDashoffset, RADIAL_STROKE } from '../lib/chartHelpers';
```

Replace:
- `const strokeDasharray = 188.5;` → removed, use `RADIAL_STROKE` where needed
- `const getDashoffset = (percent) => { ... };` → removed, use imported

---

## Step 5 — Clean up dead code

After Step 3, verify that `PersonalCarePage.jsx` has no remaining references to
`STROKE`, `ACCENT`, `sleepColor`, `goalStatus`, or `fmtDur` outside the imports.
Run `npm run build` to confirm zero undefined variable warnings.

---

## Lines saved

| File | Lines removed | Lines added | Net |
|---|---|---|---|
| `lib/chartHelpers.js` | 0 | 9 | +9 |
| `utils/personalCareHelpers.js` | 0 | 24 | +24 |
| `PersonalCarePage.jsx` | 28 | 3 | -25 |
| `Analytics.jsx` | 5 | 1 | -4 |
| **Total** | | | **+4** (net) |

The 4-line increase is the price of eliminating duplication — both
`getDashoffset` and `RADIAL_STROKE` now live in one canonical location instead
of two. Future chart code imports from `lib/chartHelpers.js` instead of
redefining the same 188.5 constant.
