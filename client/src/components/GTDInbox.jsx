import React, { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { syncEventBlock } from '../utils/api/events';
import { DateTime } from 'luxon';

export default function GTDInbox() {
  const { tasks, loading, error, createTask, updateTask, deleteTask } = useTasks({ status: '01 - Inbox' });
  const { createProject } = useProjects();
  const [newTitle, setNewTitle] = useState('');
  const [captureType, setCaptureType] = useState('task'); // 'task', 'project', 'event'

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      if (captureType === 'task') {
        await createTask({
          title: newTitle,
          status: '01 - Inbox'
        });
      } else if (captureType === 'project') {
        await createProject({
          title: newTitle,
          status: 'on-hold',
          area: 'general',
          pillar: 'Innovation',
          phase: 'Plan',
          methodology: 'PALM',
          description: 'Captured via Global Inbox'
        });
      } else if (captureType === 'event') {
        const now = DateTime.now();
        const dateStr = now.toISODate();
        const timeStr = now.toFormat('HH:00');
        await syncEventBlock({
          title: newTitle,
          date_string: dateStr,
          time_slot: timeStr,
          duration_mins: 60,
          column_type: 'plan',
          area: 'general',
          color_hex: '#95A5A6',
          notes: 'Captured via Global Inbox',
          block_signature: `${dateStr}_${timeStr}_plan_${Date.now()}`
        });
      }
      setNewTitle('');
    } catch (err) {
      console.error('Failed to capture item:', err);
    }
  };

  const triageUnder2Min = async (taskId) => {
    await updateTask(taskId, { status: '07 - Done' });
  };

  const triageActionable = async (taskId) => {
    await updateTask(taskId, { status: '02 - Next Step' });
  };

  const triageSomeday = async (taskId) => {
    await updateTask(taskId, { status: '06 - Someday / Maybe' });
  };

  if (loading && tasks.length === 0) return <div className="skeleton-row" style={{ height: '200px' }} />;

  return (
    <div className="gtd-inbox">
      {/* Rapid Intake Bar */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <form onSubmit={handleQuickAdd}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {['task', 'project', 'event'].map(type => (
              <button
                key={type}
                type="button"
                className={`filter-pill ${captureType === type ? 'active' : ''}`}
                onClick={() => setCaptureType(type)}
                style={{ textTransform: 'capitalize' }}
              >
                {type}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              className="form-input"
              style={{ flex: 1, fontSize: '1.2rem', padding: '12px 20px' }}
              placeholder={`Capture ${captureType}...`}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0 32px' }}>
              Collect
            </button>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-dimmed)' }}>
            {captureType === 'task' && "Creates an actionable item in your Inbox."}
            {captureType === 'project' && "Creates a new Project in 'On-Hold' status."}
            {captureType === 'event' && "Schedules a planned block for today at the current hour."}
          </div>
        </form>
      </div>

      {/* Inbox List */}
      <div className="inbox-list">
        {tasks.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✨</div>
            <h3 style={{ color: 'var(--text-primary)' }}>Your Inbox is Clear</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Everything has been triaged. Capture a new idea above.</p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="glass-panel inbox-item" style={{ 
              padding: '16px 20px', 
              marginBottom: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              borderLeft: '4px solid var(--accent-primary)'
            }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{task.title}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Collected: {new Date(task.received_date).toLocaleString()}
                </div>
              </div>

              <div className="triage-actions" style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => triageUnder2Min(task.id)}
                  type="button"
                  title="Under 2 minutes (Mark as Done)"
                  style={{ borderColor: 'var(--accent-success)', color: 'var(--accent-success)' }}
                >
                  <span style={{ marginRight: '4px' }}>⚡</span> 2m
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => triageActionable(task.id)}
                  type="button"
                  title="Actionable (Move to Next Steps)"
                  style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                >
                  <span style={{ marginRight: '4px' }}>➡️</span> Next
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => triageSomeday(task.id)}
                  type="button"
                  title="Someday/Maybe"
                  style={{ borderColor: 'var(--accent-warning)', color: 'var(--accent-warning)' }}
                >
                  <span style={{ marginRight: '4px' }}>📅</span> Someday
                </button>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => {
                    if (confirm('Trash this task?')) deleteTask(task.id);
                  }}
                  type="button"
                  title="Trash"
                  style={{ color: 'var(--accent-danger)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
