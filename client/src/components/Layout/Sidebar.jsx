import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { checkHealth } from '../../utils/api';

export default function Sidebar() {
  const [isOnline, setIsOnline] = useState(true);

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

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Calendarly</h1>
        <div className="subtitle">Scheduling Engine</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Data Management</div>

        <NavLink
          to="/tasks"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">✓</span>
          <span className="nav-label">Database</span>
        </NavLink>

        <NavLink
          to="/gtd"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📥</span>
          <span className="nav-label">GTD Inbox</span>
        </NavLink>

        <NavLink
          to="/kanban"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">📋</span>
          <span className="nav-label">Kanban Board</span>
        </NavLink>

        <NavLink
          to="/projects"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">◆</span>
          <span className="nav-label">Projects</span>
        </NavLink>

        <NavLink
          to="/notes"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">▤</span>
          <span className="nav-label">Extracts</span>
        </NavLink>

        <div className="sidebar-section-label">Visualization</div>

        <NavLink
          to="/calendar"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">▦</span>
          <span className="nav-label">Calendar Tracking</span>
        </NavLink>

        <NavLink
          to="/analytics"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">◐</span>
          <span className="nav-label">Reflection Dashboard</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="connection-status">
          <div className={`connection-dot ${isOnline ? '' : 'offline'}`} />
          <span>{isOnline ? 'API Connected' : 'API Offline'}</span>
        </div>
      </div>
    </aside>
  );
}
