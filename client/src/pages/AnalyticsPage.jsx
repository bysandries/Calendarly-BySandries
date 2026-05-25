import React from 'react';
import Analytics from '../components/Analytics';
import TaskTimeTracker from '../components/TaskTimeTracker';
import DistractionNotesReflection from '../components/DistractionNotesReflection';

export default function AnalyticsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Reflection Dashboard</h2>
        <p className="page-description">Retrospective review, time triage analysis, and performance tracking.</p>
      </div>
      <Analytics />
      <div className="dashboard-grid" style={{ marginTop: '24px' }}>
        <TaskTimeTracker />
        <DistractionNotesReflection />
      </div>
    </div>
  );
}
