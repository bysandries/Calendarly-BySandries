import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { checkHealth } from '../../utils/api';
import {
  IconDatabase,
  IconInbox,
  IconKanban,
  IconProjects,
  IconExtracts,
  IconCalendar,
  IconAnalytics,
  IconAgents,
  IconSettings,
  IconChevronLeft,
  IconChevronRight
} from './NavIcons';

const NAV_ITEMS = [
  { to: '/tasks', icon: IconDatabase, label: 'Database' },
  { to: '/gtd', icon: IconInbox, label: 'GTD Inbox' },
  { to: '/kanban', icon: IconKanban, label: 'Kanban Board' },
  { to: '/projects', icon: IconProjects, label: 'Projects' },
  { to: '/notes', icon: IconExtracts, label: 'Extracts' },
  { to: '/calendar', icon: IconCalendar, label: 'Calendar Tracking' },
  { to: '/analytics', icon: IconAnalytics, label: 'Reflection Dashboard' },
  { to: '/agents', icon: IconAgents, label: 'Code Agents' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
];

export default function Sidebar() {
  const [isOnline, setIsOnline] = useState(true);

  // Persist collapsed state in localStorage; default to collapsed on small screens
  const getInitialCollapsed = () => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) return stored === 'true';
    return window.innerWidth <= 1024;
  };

  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  // Auto-collapse on resize below 1024, auto-expand above 1280 (only if user hasn't manually toggled)
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      // Don't fight manual toggles: only auto-react when crossing thresholds
      if (w <= 1024 && !collapsed) setCollapsed(true);
      if (w >= 1280 && collapsed) setCollapsed(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [collapsed]);

  useEffect(() => {
    const check = async () => {
      try {
        await checkHealth();
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const ToggleIcon = collapsed ? IconChevronRight : IconChevronLeft;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <h1>C</h1>
        <span className="sidebar-logo-full">Calendarly</span>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(prev => !prev)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ToggleIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>

        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={label}
          >
            <span className="nav-icon">
              <Icon />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
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
