import PomodoroPanel from '../components/PomodoroPanel';

export default function PomodoroPage() {
  return (
    <div className="page-container" style={{ padding: '0' }}>
      <div className="page-header" style={{ padding: '24px 16px' }}>
        <h2>Focus</h2>
        <p className="page-description">Pomodoro timer and distraction capture.</p>
      </div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '0 16px',
        height: 'calc(100vh - 160px)',
        overflow: 'hidden'
      }}>
        <PomodoroPanel timezone={Intl.DateTimeFormat().resolvedOptions().timeZone} isMobileView={true} />
      </div>
    </div>
  );
}
