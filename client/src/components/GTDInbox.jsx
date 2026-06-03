import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { syncEventBlock } from '../utils/api/events';
import { createEnergyLog } from '../utils/api/activityEnergyLog';
import { DateTime } from 'luxon';

const QUADRANTS = [
  { energy: 'high', emotion: 'positive', label: 'Performance', color: '#2ECC71' },
  { energy: 'high', emotion: 'negative', label: 'Survival',    color: '#3498DB' },
  { energy: 'low',  emotion: 'positive', label: 'Renewal',     color: '#F1C40F' },
  { energy: 'low',  emotion: 'negative', label: 'Burnout',     color: '#E74C3C' },
];

export default function GTDInbox() {
  const { tasks, loading, error, createTask, updateTask, deleteTask } = useTasks({ status: '01 - Inbox' });
  const { createProject } = useProjects();
  const [newTitle, setNewTitle] = useState('');
  const [captureType, setCaptureType] = useState('task');
  const [energyQuadrant, setEnergyQuadrant] = useState(null);

  // Undo state for triage actions
  const [undoToast, setUndoToast] = useState(null); // { taskId, prevStatus, message, timer }
  const undoToastRef = useRef(undoToast);
  useEffect(() => { undoToastRef.current = undoToast; }, [undoToast]);

  const dismissUndo = useCallback(() => {
    if (undoToastRef.current?.timer) clearTimeout(undoToastRef.current.timer);
    setUndoToast(null);
  }, []);

  const triageWithUndo = useCallback(async (taskId, newStatus, label) => {
    const task = tasks.find(t => t.id === taskId);
    await updateTask(taskId, { status: newStatus });

    if (undoToastRef.current?.timer) clearTimeout(undoToastRef.current.timer);
    const timer = setTimeout(dismissUndo, 5000);
    setUndoToast({
      taskId,
      prevStatus: task?.status || '01 - Inbox',
      message: `Moved to ${label}`,
      timer,
    });
  }, [tasks, updateTask, dismissUndo]);

  const handleUndo = useCallback(async () => {
    const toast = undoToastRef.current;
    if (!toast) return;
    dismissUndo();
    await updateTask(toast.taskId, { status: toast.prevStatus });
  }, [updateTask, dismissUndo]);

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      if (captureType === 'task') {
        const task = await createTask({ title: newTitle, status: '01 - Inbox' });
        if (task?.id && energyQuadrant) {
          createEnergyLog({
            entity_type:  'task',
            entity_id:    String(task.id),
            energy_level: energyQuadrant.energy,
            emotion_type: energyQuadrant.emotion,
          }).catch(() => {});
        }
        setEnergyQuadrant(null);
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

  const triageUnder2Min = (taskId) => triageWithUndo(taskId, '07 - Done', 'Done');
  const triageActionable = (taskId) => triageWithUndo(taskId, '02 - Next Step', 'Next Steps');
  const triageSomeday    = (taskId) => triageWithUndo(taskId, '06 - Someday / Maybe', 'Someday');

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
          {captureType === 'task' && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dimmed)', whiteSpace: 'nowrap' }}>Energy:</span>
              {QUADRANTS.map(q => {
                const active = energyQuadrant?.energy === q.energy && energyQuadrant?.emotion === q.emotion;
                return (
                  <button
                    key={`${q.energy}-${q.emotion}`}
                    type="button"
                    onClick={() => setEnergyQuadrant(active ? null : q)}
                    style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 10px',
                      borderRadius: '20px', cursor: 'pointer', border: `1px solid ${q.color}`,
                      background: active ? q.color : 'transparent',
                      color: active ? '#fff' : q.color,
                      transition: 'background .12s, color .12s',
                    }}
                  >
                    {q.label}
                  </button>
                );
              })}
              {energyQuadrant && (
                <button
                  type="button"
                  onClick={() => setEnergyQuadrant(null)}
                  style={{ fontSize: '11px', color: 'var(--text-dimmed)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                >
                  ✕ clear
                </button>
              )}
            </div>
          )}
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-dimmed)' }}>
            {captureType === 'task' && 'Creates an actionable item in your Inbox.'}
            {captureType === 'project' && "Creates a new Project in 'On-Hold' status."}
            {captureType === 'event' && 'Schedules a planned block for today at the current hour.'}
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
                  onClick={() => deleteTask(task.id)}
                  type="button"
                  title="Move to Trash"
                  style={{ color: 'var(--accent-danger)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Triage Undo Toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, display: 'flex', alignItems: 'center', gap: '16px',
          background: 'rgba(20,20,28,0.95)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', padding: '10px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          <span>↪ {undoToast.message}</span>
          <button
            onClick={handleUndo}
            style={{
              background: 'none', border: '1px solid var(--accent-primary)',
              borderRadius: '6px', padding: '3px 10px', cursor: 'pointer',
              color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 600,
            }}
          >
            Undo
          </button>
          <button
            onClick={dismissUndo}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
