import { useState, useRef, useEffect, useCallback } from 'react';
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

const isElectron = typeof window !== 'undefined' && /electron/i.test(window.navigator.userAgent);

function WebBrowserTab() {
  const [inputValue, setInputValue] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const viewRef = useRef(null);

  const normalizeUrl = (raw) => {
    const t = raw.trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    // Looks like a bare domain (no spaces, has a dot) → prepend https
    if (/^[^\s]+\.[^\s]{2,}$/.test(t)) return `https://${t}`;
    // Otherwise treat as a search query
    return `https://www.google.com/search?q=${encodeURIComponent(t)}`;
  };

  const navigate = useCallback((raw) => {
    const url = normalizeUrl(raw);
    if (!url) return;
    setInputValue(url);
    setLoadedUrl(url);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate(inputValue);
  };

  // Webview: navigate imperatively when URL changes after first load
  useEffect(() => {
    if (!isElectron || !loadedUrl || !viewRef.current) return;
    const wv = viewRef.current;
    if (wv.loadURL) wv.loadURL(loadedUrl);
  }, [loadedUrl]);

  // Webview: keep URL bar in sync as user navigates within the webview
  useEffect(() => {
    if (!isElectron || !loadedUrl || !viewRef.current) return;
    const wv = viewRef.current;
    const onNav = (e) => { if (e.url) setInputValue(e.url); };
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    return () => {
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
    };
  }, [loadedUrl]);

  const handleReload = () => viewRef.current?.reload?.();
  const handleBack = () => viewRef.current?.goBack?.();
  const handleForward = () => viewRef.current?.goForward?.();

  return (
    <div className="workspace-browser">
      <div className="workspace-browser-bar">
        <button type="button" className="workspace-browser-btn" onClick={handleBack} title="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button type="button" className="workspace-browser-btn" onClick={handleForward} title="Forward">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
        <button type="button" className="workspace-browser-btn" onClick={handleReload} title="Reload" disabled={!loadedUrl}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
        <form className="workspace-browser-url-form" onSubmit={handleSubmit}>
          <input
            className="workspace-browser-url-input"
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search or enter URL…"
            spellCheck={false}
            autoComplete="off"
            disabled={!isElectron}
          />
          <button type="submit" className="workspace-browser-go-btn" disabled={!isElectron}>Go</button>
        </form>
        {isElectron && (
          <span className="workspace-browser-mode-badge">Electron</span>
        )}
      </div>
      <div className="workspace-browser-content">
        {!isElectron ? (
          <div className="workspace-browser-home">
            <div className="workspace-browser-home-icon">🖥️</div>
            <p>Browser requires the Electron app</p>
            <p className="workspace-browser-home-note">
              Run <code>npm run electron</code> from the <code>client/</code> directory,
              then use this tab to browse any site — Google, YouTube, codestepbystep.com, and more.
            </p>
          </div>
        ) : loadedUrl ? (
          <webview
            ref={viewRef}
            src={loadedUrl}
            className="workspace-browser-iframe"
            allowpopups="true"
          />
        ) : (
          <div className="workspace-browser-home">
            <div className="workspace-browser-home-icon">🌐</div>
            <p>Search or enter a URL above</p>
            <p className="workspace-browser-home-note workspace-browser-home-note--electron">
              Type anything to search Google, or paste a URL to navigate directly.
            </p>
          </div>
        )}
      </div>
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
