import { useEffect, useState } from 'react';
import { fetchHabitLogs, createHabitLog, deleteHabitLog } from '../utils/api';

export default function HabitDayDrawer({ isOpen, habit, dateId, onClose, onUpdated }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickTime, setQuickTime] = useState('');

  const loadLogs = async () => {
    if (!habit?.habit_id || !dateId) return;
    setLoading(true);
    try {
      const data = await fetchHabitLogs({
        habit_id: habit.habit_id,
        date: dateId,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load day logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      const now = new Date();
      setQuickTime(now.toTimeString().split(' ')[0].slice(0, 5));
    }
  }, [isOpen, habit, dateId]);

  if (!isOpen) return null;

  async function handleQuickAdd() {
    setSaving(true);
    try {
      const loggedAt = new Date(`${dateId}T${quickTime}:00`).toISOString();

      await createHabitLog({
        habit_id: habit.habit_id,
        count: 1,
        source: 'manual',
        logged_at: loggedAt,
      });
      await loadLogs();
      onUpdated();
    } catch (err) {
      alert('Failed to log: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this log?')) return;
    try {
      await deleteHabitLog(id);
      await loadLogs();
      onUpdated();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  return (
    <div className="habit-drawer-overlay" onClick={onClose}>
      <div className="habit-drawer" onClick={e => e.stopPropagation()}>
        <div className="habit-drawer-header">
          <div className="habit-day-title">
            <span className="habit-icon">{habit?.icon || '◉'}</span>
            <div className="habit-day-meta">
              <h3>{habit?.name}</h3>
              <div className="log-date">{dateId}</div>
            </div>
          </div>
          <button type="button" className="habit-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="habit-drawer-form">
          <div className="habit-day-actions">
            <div className="habit-quick-log-row">
              <input 
                type="time" 
                value={quickTime} 
                onChange={e => setQuickTime(e.target.value)}
                className="habit-quick-time-input"
              />
              <button 
                type="button" 
                className="habit-btn-primary-wide" 
                onClick={handleQuickAdd}
                disabled={saving}
              >
                {saving ? 'Logging...' : '+1 Quick Log'}
              </button>
            </div>
          </div>

          <div className="habit-history-section">
            <div className="habit-history-header">
              <h4>Logs for this day</h4>
              {loading && <span className="loading-spinner-small" />}
            </div>

            {logs.length === 0 ? (
              <div className="habit-history-empty">No entries for this day.</div>
            ) : (
              <div className="habit-history-list">
                {logs.map(log => (
                  <div key={log.id} className="habit-history-item">
                    <div className="habit-history-item-meta">
                      <span className="log-time">{log.logged_at.split('T')[1].slice(0, 5)}</span>
                      <div className="habit-history-item-actions">
                        <button type="button" className="log-delete-btn" onClick={() => handleDelete(log.id)}>✕</button>
                      </div>
                    </div>
                    {log.notes && <div className="log-note">{log.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="habit-drawer-footer">
          <div className="habit-drawer-footer-spacer" />
          <button type="button" className="habit-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
