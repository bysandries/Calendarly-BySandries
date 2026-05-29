# Plan: Add React Error Boundaries

**Goal:** Prevent unhandled render exceptions from crashing the entire app.
Replace silent `.catch(() => {})` patterns and uncaught render errors with
a consistent fallback UI.

---

## Current error handling

| Pattern | Files | Problem |
|---|---|---|
| `.catch(() => {})` | PersonDetailPage, TasksPage, TaskDetailPage, ProjectsPage, NotesPage | Errors silently swallowed, user sees blank/loading forever |
| `try/catch` → `setError()` | PersonalCarePage, HabitsPage, agents, settings | Errors displayed but only for *async* failures — render errors still crash |
| `.catch(err => console.error(...))` | ProjectDetailPage, SettingsPage | Only logged to console, no user feedback |
| **Error Boundary** | **None** | **Render-time crashes (null refs, bad .map(), undefined props) crash the whole tab** |

**What Error Boundaries catch** that try/catch cannot:
- `TypeError: Cannot read properties of null` in render
- `undefined` is not a function in JSX callbacks
- Errors in lifecycle methods / `useEffect` (React 16+)
- Errors in constructors

---

## Step 1 — Create `components/ErrorBoundary.jsx`

```jsx
import { Component } from 'react';

const FALLBACK_STYLES = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: '16px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--accent-danger, #E74C3C)',
  },
  message: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    maxWidth: '480px',
    lineHeight: 1.5,
  },
  detail: {
    fontSize: '12px',
    color: 'var(--text-dimmed)',
    fontFamily: 'monospace',
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '6px',
    maxWidth: '100%',
    overflow: 'auto',
  },
  button: {
    padding: '8px 20px',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    background: 'var(--glass-bg)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary] ${this.props.name || 'Unknown'}:`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={FALLBACK_STYLES.container}>
          <div style={FALLBACK_STYLES.title}>
            {this.props.title || 'Something went wrong'}
          </div>
          <div style={FALLBACK_STYLES.message}>
            {this.props.message || 'This section encountered an unexpected error. Try refreshing the page.'}
          </div>
          {this.props.showDetail && this.state.error && (
            <div style={FALLBACK_STYLES.detail}>
              {this.state.error.message}
            </div>
          )}
          <button style={FALLBACK_STYLES.button} onClick={this.handleReset}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**API:**

| Prop | Default | Purpose |
|---|---|---|
| `name` | `'Unknown'` | Labels the boundary in logs |
| `fallback` | — | Custom fallback element (overrides default UI) |
| `title` | `'Something went wrong'` | Fallback heading |
| `message` | `'This section encountered...'` | Fallback description |
| `showDetail` | `false` | Show `error.message` in monospace (dev mode) |
| `onError` | — | Callback fired with `(error, info)` |

**Why a class component:** Error boundaries require `getDerivedStateFromError` and
`componentDidCatch`, which are not available in function components.

---

## Step 2 — Wrap route pages in `App.jsx`

**Strategy:** Wrap each `<Route element={...}>` individually so one broken page
does not take down the sidebar, header, or other routes.

```jsx
// App.jsx
import ErrorBoundary from './components/ErrorBoundary';

function MainLayout() {
  // ...

  return (
    <div className="app-layout">
      <header className="mobile-header">...</header>
      <div className="sidebar-overlay ..." />
      <Sidebar ... />

      <main className="main-content">
        <Routes>
          <Route path="/tasks" element={
            <ErrorBoundary name="TasksPage" showDetail={process.env.NODE_ENV === 'development'}>
              <TasksPage />
            </ErrorBoundary>
          } />
          <Route path="/tasks/:id" element={
            <ErrorBoundary name="TaskDetailPage">
              <TaskDetailPage />
            </ErrorBoundary>
          } />
          <Route path="/gtd" element={
            <ErrorBoundary name="GTDPage">
              <GTDPage />
            </ErrorBoundary>
          } />
          {/* ... same pattern for all 16 routes ... */}
          <Route path="*" element={<Navigate to="/gtd" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

**Alternative (less granular):** Wrap the entire `<Routes>` block in a single
`<ErrorBoundary>`. Simpler but one page crash blanks the entire content area.

**Recommended: per-route.** The 30s extra to wrap each route is worth the
isolation — a crashing CalendarPage doesn't hide your Tasks.

---

## Step 3 — Replace silent `.catch(() => {})` with user-visible fallbacks

For files like `PersonDetailPage.jsx:25`, `TasksPage.jsx:129`, etc.:

```jsx
// Before
fetchAreas().then(setAreas).catch(() => {});

// After
fetchAreas().then(setAreas).catch(err => {
  console.warn('Failed to load areas:', err);
  setAreas([]); // or setError(...) if the page has error state
});
```

This is not required for Error Boundaries to work — it's a separate hygiene fix.
Error Boundaries catch render crashes; `.catch(() => {})` swallows async errors.

---

## Step 4 — Verification

1. **Simulate a render crash:** temporarily add `throw new Error('test')` inside a page.
   - Without boundary: white screen, console error, app dead
   - With boundary: fallback UI, sidebar/nav still works, other pages still work
2. **Simulate an async error:** in a page's `useEffect`, call `fetch('/nonexistent')`.
   - Without boundary: loading spinner hangs forever (if no error state)
   - With boundary: boundary does NOT catch async errors (by React design) — this
     confirms boundaries only cover render/lifecycle, not async
3. **Test "Try again" button:** after a boundary catches, clicking "Try again"
   resets state and remounts the children.
4. `cd client && npm run build` — no import errors

---

## What Error Boundaries do NOT replace

Error Boundaries do not catch:
- Async errors in `useEffect` / `fetch` / `setTimeout` callbacks
- Errors inside event handlers (`onClick`, `onSubmit`)
- SSR errors

These still require `try/catch` + `setError()` in the component, or the
`useQuery` abstraction from `plan #3` which already handles them.
