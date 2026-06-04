import { useState, useRef, useEffect } from 'react';
import FocusPage from './FocusPage';
import CalendarPage from './CalendarPage';
import DayPlannerPanel from '../components/DayPlannerPanel';
import TaskFavoritesPanel from '../components/TaskFavoritesPanel';
import './WorkspacePage.css';

const TABS = [
  { key: 'tasks',    label: 'Tasks & Projects' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'browser',  label: 'Web Browser' },
];
const LS_KEY = 'workspace-active-tab';

// ── Web Browser Tab ───────────────────────────────────────────────────────────

const CHROMIUM_URL = 'http://localhost:3010';

function WebBrowserTab() {
  return (
    <div className="workspace-browser">
      <iframe
        src={CHROMIUM_URL}
        className="workspace-browser-iframe"
        title="Chromium"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}

// ── Workspace Page ────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState(() => {
    const stored = localStorage.getItem(LS_KEY);
    return TABS.find(t => t.key === stored) ? stored : 'tasks';
  });

  const [plannerWidth, setPlannerWidth] = useState(320);
  const plannerResizeRef = useRef(null);
  const plannerColRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (!plannerResizeRef.current) return;
      const delta = plannerResizeRef.current.startX - e.clientX;
      const w = Math.min(700, Math.max(240, plannerResizeRef.current.startWidth + delta));
      plannerResizeRef.current.width = w;
      if (plannerColRef.current) plannerColRef.current.style.width = `${w}px`;
    };
    const onUp = () => {
      if (plannerResizeRef.current) {
        setPlannerWidth(plannerResizeRef.current.width ?? plannerResizeRef.current.startWidth);
        if (plannerColRef.current) plannerColRef.current.style.transition = '';
        plannerResizeRef.current = null;
      }
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleTabChange = useCallback((key) => {
    setActiveTab(key);
    localStorage.setItem(LS_KEY, key);
  }, []);

  return (
    <div className="workspace-page">
      {/* ── Horizontal tab bar ── */}
      <div className="workspace-tab-bar">
        <div className="task-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`task-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: tab content + persistent Day Planner ── */}
      <div className="workspace-body">
        <div className="workspace-tab-content">
          {activeTab === 'tasks'    && <FocusPage />}
          {activeTab === 'calendar' && <CalendarPage hideDayPlanner />}
          {activeTab === 'browser'  && <WebBrowserTab />}
        </div>

        {/* Persistent Day Planner — always open, drag-resizable */}
        <div
          ref={plannerColRef}
          className="workspace-planner-column right-panel-column rpc-expanded"
          style={{ width: plannerWidth }}
        >
          <div
            className="rpc-resize-handle"
            onMouseDown={e => {
              e.preventDefault();
              if (plannerColRef.current) plannerColRef.current.style.transition = 'none';
              plannerResizeRef.current = { startX: e.clientX, startWidth: plannerWidth };
              document.body.style.cursor = 'col-resize';
            }}
          />
          <DayPlannerPanel isOpen={true} onToggle={() => {}} />
          <TaskFavoritesPanel />
        </div>
      </div>
    </div>
  );
}
