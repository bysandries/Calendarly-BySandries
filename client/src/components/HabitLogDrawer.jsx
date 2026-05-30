import { useEffect, useState } from 'react';
import { createHabitLog } from '../utils/api/habitLogs';

function getLocalYMD() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
}

function getLocalTime() {
  return new Date().toTimeString().split(' ')[0].slice(0, 5);
}

export default function HabitLogDrawer({ isOpen, habit, onClose, onLogged }) {
  const [date, setDate] = useState(getLocalYMD());
  const [time, setTime] = useState(getLocalTime());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDate(getLocalYMD());
      setTime(getLocalTime());
      setNotes('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Construct ISO timestamp from local date and time inputs
      // Date and time from inputs are already in user's local timezone
      const localDt = new Date(`${date}T${time}:00`);
      const loggedAt = localDt.toISOString();
      
      await createHabitLog({
        habit_id: habit.habit_id,
        count: 1,
        notes: notes.trim() || null,
        source: 'manual',
        logged_at: loggedAt,
      });
      
      onLogged();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create log');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="habit-drawer-overlay" onClick={onClose}>
      <div className="habit-drawer" onClick={e => e.stopPropagation()}>
        <div className="habit-drawer-header">
          <h3>Log Detail: {habit?.name}</h3>
          <button type="button" className="habit-drawer-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="habit-drawer-form">
          <div className="habit-form-2col">
            <div className="habit-form-row">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className="habit-form-row">
              <label>Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="habit-form-row">
            <label>Notes / Why?</label>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Feeling stressed, wanted to reward myself, etc."
              autoFocus
            />
          </div>

          {error && <div className="habit-form-error">{error}</div>}

          <div className="habit-drawer-footer">
            <div className="habit-drawer-footer-spacer" />
            <button type="button" className="habit-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="habit-btn-primary" disabled={saving}>
              {saving ? 'Logging…' : 'Save Log Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
