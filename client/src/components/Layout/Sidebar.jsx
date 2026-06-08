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
  IconClock,
  IconFocus,
} from './NavIcons';

function parseNavConfig(config) {
  let savedItems, savedGroups;
  if (Array.isArray(config)) {
    savedItems = config;
    savedGroups = null;
  } else if (config?.items && config?.groups) {
    savedItems = config.items;
    savedGroups = config.groups;
  } else {
    return null;
  }

  const enabledGroupIds = savedGroups
    ? new Set(savedGroups.filter(g => g.enabled !== false).map(g => g.id))
    : null;

  const orderedItems = savedItems
    .filter(c => c.enabled !== false)
    .filter(c => !enabledGroupIds || !c.group || enabledGroupIds.has(c.group))
    .map(c => {
      const original = NAV_ITEMS.find(item => item.to === c.id);
      return original ? { ...original, label: c.label, group: c.group ?? original.group } : null;
    })
    .filter(Boolean);

  const configuredIds = new Set(savedItems.map(c => c.id));
  const missing = NAV_ITEMS.filter(item => !configuredIds.has(item.to));
  if (missing.length) {
    const settingsIdx = orderedItems.findIndex(i => i.to === '/settings');
    if (settingsIdx >= 0) orderedItems.splice(settingsIdx, 0, ...missing);
    else orderedItems.push(...missing);
  }

  const labels = {};
  if (savedGroups) savedGroups.forEach(g => { labels[g.id] = g.label; });

  return { items: orderedItems, groupLabels: labels };
}

const NAV_ITEMS = [
  { to: '/focus',        icon: IconFocus,    label: 'Workspace',           group: 'Workspace' },
  { to: '/pomodoro',     icon: IconClock,    label: 'Pomodoro',            group: 'Workspace', mobileOnly: true },
  { to: '/tasks',        icon: IconDatabase, label: 'Tasks',               group: 'Work' },
  { to: '/projects',     icon: IconProjects, label: 'Projects',            group: 'Work' },
  { to: '/team',         icon: IconUsers,    label: 'Team',                group: 'Work' },
  { to: '/gtd',          icon: IconInbox,    label: 'GTD Inbox',           group: 'Capture' },
  { to: '/kanban',       icon: IconKanban,   label: 'Kanban Board',        group: 'Capture' },
  { to: '/notes',        icon: IconExtracts, label: 'Extracts',            group: 'Capture' },
  { to: '/omni-history', icon: IconDatabase, label: 'Omni History',        group: 'Capture' },
  { to: '/habits',       icon: IconHabits,   label: 'Habits',              group: 'Life' },
  { to: '/personal-care',icon: IconHeart,    label: 'Personal Care',       group: 'Life' },

  { to: '/timeline',     icon: IconMap,      label: 'Life Map',            group: 'Life' },
  { to: '/analytics',    icon: IconAnalytics,label: 'Reflection Dashboard',group: 'System' },
  { to: '/agents',       icon: IconAgents,   label: 'Code Agents',         group: 'System' },
  { to: '/settings',     icon: IconSettings, label: 'Settings',            group: 'System' },
];

export default function Sidebar({ isMobileOpen, onClose, zenMode, onToggleZen, onOpenCapture }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [navItems, setNavItems] = useState(NAV_ITEMS);
  const [groupLabels, setGroupLabels] = useState({});
  const [previewNavItems, setPreviewNavItems] = useState(null);
  const [previewGroupLabels, setPreviewGroupLabels] = useState(null);
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
          if (data.database.navigation_config) {
            let config = data.database.navigation_config;
            if (typeof config === 'string') {
              try { config = JSON.parse(config); } catch { config = null; }
            }
            if (config) {
              const parsed = parseNavConfig(config);
              if (parsed) {
                setNavItems(parsed.items);
                setGroupLabels(parsed.groupLabels);
              }
            }
          }

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

    const handleSaved = () => {
      setPreviewNavItems(null);
      setPreviewGroupLabels(null);
      fetchUIConfig();
    };

    const handlePreview = (e) => {
      const parsed = parseNavConfig(e.detail);
      if (parsed) {
        setPreviewNavItems(parsed.items);
        setPreviewGroupLabels(parsed.groupLabels);
      }
    };

    fetchUIConfig();
    window.addEventListener('nav-settings-saved', handleSaved);
    window.addEventListener('nav-preview-changed', handlePreview);
    const interval = setInterval(fetchUIConfig, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('nav-settings-saved', handleSaved);
      window.removeEventListener('nav-preview-changed', handlePreview);
    };
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

  // Use preview (live) or saved nav items
  const activeNavItems = previewNavItems ?? navItems;
  const activeGroupLabels = previewGroupLabels ?? groupLabels;

  // Filter nav items by active context preset
  const visibleItems = activeContext
    ? activeNavItems.filter(item => activeContext.navItems.includes(item.to))
    : activeNavItems;

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
        {(() => {
          let lastGroup = null;
          return visibleItems.flatMap(item => {
            if (item.mobileOnly && !isMobile) return [];
            const nodes = [];
            if (item.group && item.group !== lastGroup) {
              const displayLabel = activeGroupLabels[item.group] ?? item.group;
              nodes.push(
                <div key={`group-${item.group}`} className="sidebar-section-label">
                  {!collapsed ? displayLabel : <span style={{ display: 'block', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 8px' }} />}
                </div>
              );
              lastGroup = item.group;
            }
            nodes.push(
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <span className="nav-icon"><item.icon /></span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            );
            return nodes;
          });
        })()}
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
