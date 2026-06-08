import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Layout/Sidebar';
import CaptureModal from './components/CaptureModal';
import TasksPage from './pages/TasksPage';
import GTDPage from './pages/GTDPage';
import KanbanPage from './pages/KanbanPage';
import TeamPage from './pages/TeamPage';
import PersonDetailPage from './pages/PersonDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import NotesPage from './pages/NotesPage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SecretUploadPage from './pages/SecretUploadPage';
import AgentsPage from './pages/AgentsPage';
import HabitsPage from './pages/HabitsPage';
import PersonalCarePage from './pages/PersonalCarePage';
import TherapyJournalPage from './pages/TherapyJournalPage';
import TherapyEntryDetailPage from './pages/TherapyEntryDetailPage';
import TherapyEntryNewPage from './pages/TherapyEntryNewPage';
import TherapyPatternPage from './pages/TherapyPatternPage';
import PersonalGoalDetailPage from './pages/PersonalGoalDetailPage';
import GoalsHistoryPage from './pages/GoalsHistoryPage';
import OmniHistoryPage from './pages/OmniHistoryPage';
import TaskDetailPage from './pages/TaskDetailPage';
import PomodoroPage from './pages/PomodoroPage';
import WorkspacePage from './pages/WorkspacePage';
import TimelinePage from './pages/TimelinePage';
import { IconMenu } from './components/Layout/NavIcons';
import AuthGate from './components/AuthGate';

function MainLayout() {
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [zenMode, setZenMode] = useState(() => localStorage.getItem('zen-mode') === 'true');
  const [showCapture, setShowCapture] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Apply saved theme on app mount
  useEffect(() => {
    const applyTheme = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.database?.theme) {
          const theme = data.database.theme;
          const root = document.documentElement;
          root.classList.remove('midnight-abyss', 'slate-minimal', 'classic-light');
          if (['midnight-abyss', 'slate-minimal', 'classic-light'].includes(theme)) {
            root.classList.add(theme);
          }
        }
      } catch (err) {
        console.error('Failed to load theme:', err);
      }
    };
    applyTheme();
  }, []);

  // Persist zen mode
  useEffect(() => {
    localStorage.setItem('zen-mode', String(zenMode));
    document.body.classList.toggle('zen-mode', zenMode);
  }, [zenMode]);

  const toggleZen = useCallback(() => {
    setZenMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
  }, []);

  // Sync state when user exits fullscreen via ESC
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setZenMode(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Open capture modal when ?capture=true is in the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('capture') === 'true') {
      setShowCapture(true);
    }
  }, [location.search]);

  const closeCapture = useCallback(() => {
    setShowCapture(false);
    // Strip the query param without re-navigating away from current page
    const params = new URLSearchParams(location.search);
    if (params.has('capture')) {
      params.delete('capture');
      const newSearch = params.toString();
      navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
    }
  }, [location, navigate]);

  // Global keyboard shortcuts (skip when focus is inside an input/textarea)
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
      if (isTyping) return;

      // F — toggle Zen mode
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleZen();
      }

      // G — global quick-capture (same as ?capture=true)
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowCapture(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app-layout ${zenMode ? 'zen-mode' : ''}`}>
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="mobile-brand">
          <h1>C</h1>
          <span>Calendarly</span>
        </div>
        <button
          className="hamburger-btn"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
        >
          <IconMenu />
        </button>
      </header>

      {/* Overlay for mobile sidebar */}
      <div
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        zenMode={zenMode}
        onToggleZen={toggleZen}
        onOpenCapture={() => setShowCapture(true)}
      />

      {/* Zen mode exit strip */}
      {zenMode && (
        <button
          onClick={toggleZen}
          title="Exit Zen Mode (F)"
          style={{
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 100,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px', padding: '6px 14px', cursor: 'pointer',
            fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.06em',
          }}
        >
          exit zen · F
        </button>
      )}

      <main className={`main-content ${location.pathname === '/focus' ? 'main-content--workspace' : ''}`}>
        <Routes>
          <Route path="/focus" element={<WorkspacePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/gtd" element={<GTDPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/team/:id" element={<PersonDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/personal-care" element={<PersonalCarePage />} />
          <Route path="/personal-care/journal" element={<TherapyJournalPage />} />
          <Route path="/personal-care/journal/new" element={<TherapyEntryNewPage />} />
          <Route path="/personal-care/journal/pattern/:patternId" element={<TherapyPatternPage />} />
          <Route path="/personal-care/journal/:id" element={<TherapyEntryDetailPage />} />
          <Route path="/personal-care/goals" element={<GoalsHistoryPage />} />
          <Route path="/personal-care/goals/:id" element={<PersonalGoalDetailPage />} />
          <Route path="/omni-history" element={<OmniHistoryPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/pomodoro" element={<PomodoroPage />} />
          <Route path="/secret-upload" element={<SecretUploadPage />} />
          <Route path="*" element={<Navigate to="/focus" replace />} />
        </Routes>
      </main>

      {showCapture && <CaptureModal onClose={closeCapture} />}
    </div>
  );
}

function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </AuthGate>
  );
}

export default App;
