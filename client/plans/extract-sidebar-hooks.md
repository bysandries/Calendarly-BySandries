# Plan: Replace manual polling in `Sidebar.jsx` with dedicated hooks

**Goal:** Extract health polling and UI config polling into standalone hooks,
reducing `Sidebar.jsx` from 186 lines to ~100 and separating concerns.

---

## Current state

`Sidebar.jsx` mixes 5 responsibilities:

| Concern | Lines | Description |
|---|---|---|
| Responsive layout | 45–49 | `isMobile` + resize listener |
| UI config polling | 51–88 | Fetches `/api/settings` every 30s, rebuilds nav items |
| Collapsed state | 90–113 | localStorage persistence + auto-collapse on resize |
| Health polling | 115–127 | `checkHealth()` every 30s, sets `isOnline` |
| Render | 129–186 | Nav items, toggle, connection indicator |

---

## Step 1 — Create `hooks/useHealthCheck.js`

```js
import { useState, useEffect, useCallback } from 'react';
import { checkHealth } from '../utils/api/health';

const POLL_INTERVAL = 30000;

export function useHealthCheck() {
  const [isOnline, setIsOnline] = useState(true);

  const check = useCallback(async () => {
    try {
      await checkHealth();
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [check]);

  return isOnline;
}
```

**Design decisions:**
- No `loading` or `error` state — the sidebar only needs a boolean for the green/red dot
- 30s poll interval is a module constant, easy to override
- `useCallback` on `check` prevents unnecessary effect re-runs

---

## Step 2 — Create `hooks/useUIConfig.js`

```js
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const POLL_INTERVAL = 30000;

const DEFAULT_NAV_ITEMS = [
  { to: '/tasks', label: 'Tasks' },
  { to: '/projects', label: 'Projects' },
  { to: '/team', label: 'Team' },
  { to: '/gtd', label: 'GTD Inbox' },
  { to: '/kanban', label: 'Kanban Board' },
  { to: '/notes', label: 'Extracts' },
  { to: '/habits', label: 'Habits' },
  { to: '/personal-care', label: 'Personal Care' },
  { to: '/calendar', label: 'Calendar Tracking' },
  { to: '/pomodoro', label: 'Pomodoro' },
  { to: '/analytics', label: 'Reflection Dashboard' },
  { to: '/agents', label: 'Code Agents' },
  { to: '/settings', label: 'Settings' },
];

export function useUIConfig() {
  const [navItems, setNavItems] = useState(DEFAULT_NAV_ITEMS);

  const fetchUIConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.database && data.database.navigation_config) {
        let config = data.database.navigation_config;
        if (typeof config === 'string') {
          try { config = JSON.parse(config); } catch { config = null; }
        }
        if (config && Array.isArray(config)) {
          const ordered = config
            .filter(c => c.enabled)
            .map(c => {
              const original = DEFAULT_NAV_ITEMS.find(item => item.to === c.id);
              return original ? { ...original, label: c.label } : null;
            })
            .filter(Boolean);
          setNavItems(ordered);
        }
      }
    } catch (err) {
      console.error('Failed to load sidebar UI config', err);
    }
  }, []);

  useEffect(() => {
    fetchUIConfig();
    const interval = setInterval(fetchUIConfig, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUIConfig]);

  return navItems;
}
```

**Design decisions:**
- `DEFAULT_NAV_ITEMS` is now module-level and decoupled from icon imports in the sidebar
- The hook returns only `navItems` — the sidebar maps them to icon components via its own lookup
- Polling interval is consistent with health check (both 30s)

---

## Step 3 — Refactor `Sidebar.jsx`

**Before:** 186 lines with 5 responsibilities interleaved.

**After:** ~100 lines — only keeps layout and persistence logic.

```jsx
import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useHealthCheck } from '../../hooks/useHealthCheck';
import { useUIConfig } from '../../hooks/useUIConfig';
import {
  IconDatabase, IconInbox, IconKanban, IconProjects,
  IconExtracts, IconCalendar, IconAnalytics, IconUsers,
  IconAgents, IconHabits, IconHeart, IconSettings,
  IconChevronLeft, IconChevronRight, IconX, IconClock
} from './NavIcons';

const ICON_MAP = {
  '/tasks': IconDatabase, '/projects': IconProjects, '/team': IconUsers,
  '/gtd': IconInbox, '/kanban': IconKanban, '/notes': IconExtracts,
  '/habits': IconHabits, '/personal-care': IconHeart, '/calendar': IconCalendar,
  '/pomodoro': IconClock, '/analytics': IconAnalytics, '/agents': IconAgents,
  '/settings': IconSettings,
};

export default function Sidebar({ isMobileOpen, onClose }) {
  const isOnline = useHealthCheck();
  const configItems = useUIConfig();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getInitialCollapsed = () => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) return stored === 'true';
    return window.innerWidth <= 1024;
  };

  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w <= 1024 && !collapsed) setCollapsed(true);
      if (w >= 1280 && collapsed) setCollapsed(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [collapsed]);

  // Build nav items from config, merge with icon map
  const navItems = configItems
    .map(item => ({ ...item, icon: ICON_MAP[item.to], mobileOnly: item.to === '/pomodoro' }))
    .filter(item => item.icon);

  const ToggleIcon = collapsed ? IconChevronRight : IconChevronLeft;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <h1>C</h1>
        <span className="sidebar-logo-full">Calendarly</span>
        <button className="mobile-close-btn" onClick={onClose} aria-label="Close menu">
          <IconX />
        </button>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(prev => !prev)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ToggleIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map(({ to, icon: Icon, label, mobileOnly }) => {
          if (mobileOnly && !isMobile) return null;
          return (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={label}
            >
              <span className="nav-icon"><Icon /></span>
              <span className="nav-label">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="connection-status" title={isOnline ? 'API Connected' : 'API Offline'}>
          <div className={`connection-dot ${isOnline ? '' : 'offline'}`} />
          <span className="connection-text">{isOnline ? 'API Connected' : 'API Offline'}</span>
        </div>
      </div>
    </aside>
  );
}
```

**Key changes:**
- `useHealthCheck()` replaces 13 lines of inline state + effect (lines 41, 115–127)
- `useUIConfig()` replaces 38 lines of inline state + fetch + poll (lines 43, 51–88)
- `ICON_MAP` replaces the raw `NAV_ITEMS` array as a declarative lookup — config returns `{ to, label }`, sidebar picks the icon
- Render logic is unchanged

---

## Step 4 — Verification

1. `cd client && npm run build` — no import errors
2. Load the app — sidebar nav items render correctly
3. Stop the server — connection dot turns red within 30s
4. Restart the server — connection dot turns green within 30s
5. Update nav item labels in settings — sidebar reflects changes within 30s
6. Resize to mobile — sidebar collapses, hamburger menu works
7. Toggle collapse — state persists across page reload

---

## Summary

| File | Before | After | Saved |
|---|---|---|---|
| `Sidebar.jsx` | 186 lines | ~100 lines | 86 |
| `hooks/useHealthCheck.js` | — | 22 lines | — |
| `hooks/useUIConfig.js` | — | 45 lines | — |
| **Total** | 186 | 167 | 19 lines of Sidebar, but 2 reusable hooks created |
