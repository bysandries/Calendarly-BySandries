import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
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
import TaskDetailPage from './pages/TaskDetailPage';
import PomodoroPage from './pages/PomodoroPage';
import TimelinePage from './pages/TimelinePage';
import { IconMenu } from './components/Layout/NavIcons';

function MainLayout() {
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout">
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
      />

      <main className="main-content">
        <Routes>
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
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/pomodoro" element={<PomodoroPage />} />
          <Route path="/secret-upload" element={<SecretUploadPage />} />
          <Route path="*" element={<Navigate to="/gtd" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MainLayout />
    </BrowserRouter>
  );
}

export default App;
