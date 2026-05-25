import React, { useState, useEffect } from 'react';
import { fetchPomodoroTimeByTask } from '../utils/api';

export default function TaskTimeTracker() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchPomodoroTimeByTask()
      .then((rows) => { if (mounted) setData(rows); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-panel">
        <div className="panel-header">
          <h3 className="panel-title">Task Focus Time</h3>
        </div>
        <div className="no-analytics-data">Loading…</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="panel-header">
          <h3 className="panel-title">Task Focus Time</h3>
          <p className="panel-subtitle">Total Pomodoro minutes tracked per task</p>
        </div>
        <div className="no-analytics-data">
          <span className="no-data-icon">⏱</span>
          <span>No Pomodoro sessions completed yet. Start a focus session on the Calendar!</span>
        </div>
      </div>
    );
  }

  const maxMinutes = Math.max(...data.map(d => d.total_minutes), 1);

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Task Focus Time</h3>
          <p className="panel-subtitle">Total Pomodoro minutes tracked per task</p>
        </div>
      </div>
      <div className="task-time-list">
        {data.map((row) => {
          const barPercent = (row.total_minutes / maxMinutes) * 100;
          const hours = Math.floor(row.total_minutes / 60);
          const mins = row.total_minutes % 60;
          const timeLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          return (
            <div className="task-time-row" key={row.task_id}>
              <div className="task-time-info">
                <span className="task-time-title" title={row.task_title}>{row.task_title || 'Untitled task'}</span>
                <span className="task-time-meta">{row.session_count} session{row.session_count !== 1 ? 's' : ''}</span>
              </div>
              <div className="task-time-bar-wrap">
                <div className="task-time-bar" style={{ width: `${Math.max(barPercent, 2)}%` }} />
              </div>
              <span className="task-time-value">{timeLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
