import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { checkHealth } from '../../utils/api/health';
import {
  IconDatabase,
  IconInbox,
  IconKanban,
  IconProjects,
  IconExtracts,
  IconCalendar,
  IconAnalytics,
  IconUsers,
  IconAgents,
  IconHabits,
  IconHeart,
  IconMap,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconClock
} from './NavIcons';

const NAV_ITEMS = [
  { to: '/tasks', icon: IconDatabase, label: 'Tasks' },
  { to: '/projects', icon: IconProjects, label: 'Projects' },
  { to: '/team', icon: IconUsers, label: 'Team' },
  { to: '/gtd', icon: IconInbox, label: 'GTD Inbox' },
  { to: '/kanban', icon: IconKanban, label: 'Kanban Board' },
  { to: '/notes', icon: IconExtracts, label: 'Extracts' },
  { to: '/habits', icon: IconHabits, label: 'Habits' },
  { to: '/personal-care', icon: IconHeart, label: 'Personal Care' },
  { to: '/calendar', icon: IconCalendar, label: 'Calendar Tracking' },
  { to: '/timeline', icon: IconMap, label: 'Life Map' },
  { to: '/pomodoro', icon: IconClock, label: 'Pomodoro', mobileOnly: true },
  { to: '/analytics', icon: IconAnalytics, label: 'Reflection Dashboard' },
  { to: '/agents', icon: IconAgents, label: 'Code Agents' },
  { to: '/settings', icon: IconSettings, label: 'Settings' },
];

export default function Sidebar({ isMobileOpen, onClose, zenMode, onToggleZen, onOpenCapture }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [navItems, setNavItems] = useState(NAV_ITEMS);
  const [contextPresets, setContextPresets] = useState([]);
  const [activeContext, setActiveContext] = useState(null); // null = "All"

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch UI Config + context presets on mount
  useEffect(() => {
    const fetchUIConfig = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.database) {
          // Navigation config
          if (data.database.navigation_config) {
            let config = data.database.navigation_config;
            if (typeof config === 'string') {
              try { config = JSON.parse(config); } catch { config = null; }
            }
            if (config && Array.isArray(config)) {
              const orderedItems = config
                .filter(c => c.enabled)
                .map(c => {
                  const original = NAV_ITEMS.find(item => item.to === c.id);
                  return original ? { ...original, label: c.label } : null;
                })
                .filter(Boolean);

              const configuredIds = new Set(config.map(c => c.id));
              const missing = NAV_ITEMS.filter(item => !configuredIds.has(item.to));
              if (missing.length) {
                const settingsIdx = orderedItems.findIndex(i => i.to === '/settings');
                if (settingsIdx >= 0) orderedItems.splice(settingsIdx, 0, ...missing);
                else orderedItems.push(...missing);
              }
              setNavItems(orderedItems);
            }
          }

          // Context presets
          if (data.database.context_presets) {
            let presets = data.database.context_presets;
            if (typeof presets === 'string') {
              try { presets = JSON.parse(presets); } catch { presets = []; }
            }
            if (Array.isArray(presets)) setContextPresets(presets);
          }
        }
      } catch (err) {
        console.error('Failed to load sidebar UI config', err);
      }
    };
    fetchUIConfig();
    const interval = setInterval(fetchUIConfig, 30000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
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

  // Filter nav items by active context preset
  const visibleItems = activeContext
    ? navItems.filter(item => activeContext.navItems.includes(item.to))
    : navItems;

  const ToggleIcon = collapsed ? IconChevronRight : IconChevronLeft;

  // Hide sidebar completely in zen mode (except on mobile where it's an overlay)
  if (zenMode && !isMobile) return null;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <h1>C</h1>
        <span className="sidebar-logo-full">Calendarly</span>

        {/* Mobile Close Button */}
        <button
          className="mobile-close-btn"
          onClick={onClose}
          aria-label="Close menu"
        >
          <IconX />
        </button>

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

      {/* Quick Capture Button */}
      <button
        type="button"
        onClick={onOpenCapture}
        title="Quick Capture (G)"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          margin: '0 12px 4px', padding: collapsed ? '10px' : '10px 14px',
          background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.25)',
          borderRadius: '8px', cursor: 'pointer', color: 'var(--accent-primary)',
          fontSize: '13px', fontWeight: 600, justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,152,219,0.18)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(52,152,219,0.1)'}
      >
        <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
        {!collapsed && <span>Capture</span>}
        {!collapsed && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-dimmed)', fontWeight: 400 }}>G</span>}
      </button>

      {/* Context Preset Switcher */}
      {!collapsed && contextPresets.length > 0 && (
        <div style={{ margin: '0 12px 4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveContext(null)}
            style={{
              fontSize: '10px', padding: '3px 8px', borderRadius: '12px', cursor: 'pointer',
              border: `1px solid ${!activeContext ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
              background: !activeContext ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: !activeContext ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: !activeContext ? 600 : 400,
            }}
          >
            All
          </button>
          {contextPresets.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setActiveContext(activeContext?.id === preset.id ? null : preset)}
              style={{
                fontSize: '10px', padding: '3px 8px', borderRadius: '12px', cursor: 'pointer',
                border: `1px solid ${activeContext?.id === preset.id ? 'rgba(52,152,219,0.5)' : 'rgba(255,255,255,0.08)'}`,
                background: activeContext?.id === preset.id ? 'rgba(52,152,219,0.15)' : 'transparent',
                color: activeContext?.id === preset.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontWeight: activeContext?.id === preset.id ? 600 : 400,
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>

        {visibleItems.map(({ to, icon: Icon, label, mobileOnly }) => {
          if (mobileOnly && !isMobile) return null;
          return (
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
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {/* Zen Mode Toggle */}
        <button
          type="button"
          onClick={onToggleZen}
          title={zenMode ? 'Exit Zen Mode (F)' : 'Enter Zen Mode (F)'}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: collapsed ? '8px' : '8px 12px', justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'none', border: 'none', cursor: 'pointer',
            color: zenMode ? 'var(--accent-primary)' : 'var(--text-muted)',
            fontSize: '12px', borderRadius: '6px', marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '14px' }}>{zenMode ? '◉' : '◎'}</span>
          {!collapsed && <span>Zen Mode</span>}
          {!collapsed && <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-dimmed)' }}>F</span>}
        </button>

        <div className="connection-status" title={isOnline ? 'API Connected' : 'API Offline'}>
          <div className={`connection-dot ${isOnline ? '' : 'offline'}`} />
          <span className="connection-text">{isOnline ? 'API Connected' : 'API Offline'}</span>
        </div>
      </div>
    </aside>
  );
}
