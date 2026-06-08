import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PersonalCareDashboard from './PersonalCareDashboard';
import ProfilingPeoplePage from './ProfilingPeoplePage';
import TherapyJournalPage from './TherapyJournalPage';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', path: '/personal-care/dashboard' },
  { key: 'journal',   label: 'Journal',   path: '/personal-care/journal' },
  { key: 'people',    label: 'People',    path: '/personal-care/people' },
];

export default function PersonalCarePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab from current path
  const activeTab = (() => {
    const path = location.pathname;
    if (path === '/personal-care/people' || path.startsWith('/personal-care/people/')) return 'people';
    if (path === '/personal-care/journal' || path.startsWith('/personal-care/journal/')) return 'journal';
    return 'dashboard';
  })();

  function handleTabClick(key) {
    const tab = TABS.find(t => t.key === key);
    if (tab) navigate(tab.path);
  }

  // If at /personal-care root, redirect to dashboard
  useEffect(() => {
    if (location.pathname === '/personal-care') {
      navigate('/personal-care/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="page-container">
      {/* Tab bar */}
      <div className="pc-tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`pc-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — we let the router handle sub-routes, 
          but for dashboard and people we render inline since 
          they're part of this page host. */}
      {activeTab === 'dashboard' && <PersonalCareDashboard />}
      {activeTab === 'journal' && <TherapyJournalPage />}
      {activeTab === 'people' && <ProfilingPeoplePage />}
    </div>
  );
}
