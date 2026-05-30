import { useEffect, useState } from 'react';
import AreaPicker from './AreaPicker';
import { fetchAreas } from '../utils/api/areas';
import { createHabit, updateHabit, deleteHabit } from '../utils/api/habits';
import { fetchHabitLogs, updateHabitLog, deleteHabitLog } from '../utils/api/habitLogs';

const EMPTY = {
  name: '',
  area: '',
  description: '',
  sort_order: 0,
  goal_type: 'build',
  min_per_day: 1,
  max_per_day: '',
  is_archived: 0,
  reminders: [],
};

export default function HabitEditDrawer({ isOpen, habit, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(EMPTY);
  const [areas, setAreas] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [logForm, setLogForm] = useState({ date: '', time: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCreate = !habit?.id;

  useEffect(() => {
    if (!isOpen) return;
    fetchAreas().then(setAreas).catch(() => {});
  }, [isOpen]);

  const loadLogs = async (habitId) => {
    setLoadingLogs(true);
    try {
      const data = await fetchHabitLogs({ habit_id: habitId });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setEditingLogId(null);
    setForm({
      name: habit?.name || '',
      area: habit?.area || '',
      description: habit?.description || '',
      sort_order: habit?.sort_order ?? 0,
      goal_type: habit?.goal_type || 'build',
      min_per_day: habit?.min_per_day ?? 1,
      max_per_day: habit?.max_per_day ?? '',
      is_archived: habit?.is_archived ? 1 : 0,
      reminders: habit?.reminders || [],
    });

    if (habit?.id) {
      loadLogs(habit.id);
    } else {
      setLogs([]);
    }
  }, [habit, isOpen]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function addReminder() {
    setForm(f => ({ ...f, reminders: [...f.reminders, '08:00'] }));
  }

  function updateReminder(index, value) {
    setForm(f => {
      const updated = [...f.reminders];
      updated[index] = value;
      return { ...f, reminders: updated };
    });
  }

  function removeReminder(index) {
    setForm(f => ({ ...f, reminders: f.reminders.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        area: form.area || null,
        description: form.description || null,
        sort_order: Number(form.sort_order) || 0,
        goal_type: form.goal_type,
        min_per_day: Number(form.min_per_day) || 1,
        max_per_day: form.max_per_day === '' ? null : Number(form.max_per_day),
        is_archived: form.is_archived ? 1 : 0,
        reminders: form.reminders,
      };
      const saved = isCreate
        ? await createHabit(payload)
        : await updateHabit(habit.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save habit');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!habit?.id) return;
    if (!window.confirm(`Delete "${habit.name}" and all of its logged entries?`)) return;
    setSaving(true);
    try {
      await deleteHabit(habit.id);
      onDeleted(habit.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not delete habit');
    } finally {
      setSaving(false);
    }
  }

  function startEditLog(log) {
    setEditingLogId(log.id);
    setLogForm({
      date: log.date_id,
      time: log.logged_at.split('T')[1].slice(0, 5),
      notes: log.notes || '',
    });
  }

  async function saveLogEdit(id) {
    try {
      const loggedAt = new Date(`${logForm.date}T${logForm.time}:00`).toISOString();
      await updateHabitLog(id, {
        logged_at: loggedAt,
        notes: logForm.notes,
      });
      setEditingLogId(null);
      loadLogs(habit.id);
      onSaved(); // Refresh main dashboard
    } catch (err) {
      alert('Failed to update log: ' + err.message);
    }
  }

  async function deleteLogEntry(id) {
    if (!window.confirm('Delete this log entry?')) return;
    try {
      await deleteHabitLog(id);
      loadLogs(habit.id);
      onSaved(); // Refresh main dashboard
    } catch (err) {
      alert('Failed to delete log: ' + err.message);
    }
  }

  return (
    <div className="habit-drawer-overlay" onClick={onClose}>
      <div className="habit-drawer split" onClick={e => e.stopPropagation()}>
        <div className="habit-drawer-header">
          <h3>{isCreate ? 'New habit' : 'Edit habit'}</h3>
          <button type="button" className="habit-drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="habit-drawer-content-split">
          {/* LEFT COLUMN: FORM */}
          <div className="habit-drawer-col-form">
            <form id="habit-form" onSubmit={handleSubmit} className="habit-drawer-form">
              <div className="habit-form-row">
                <label>Goal Intent</label>
                <div className="habit-intent-toggle">
                  <button
                    type="button"
                    className={`habit-intent-btn ${form.goal_type === 'build' ? 'active build' : ''}`}
                    onClick={() => set('goal_type', 'build')}
                  >
                    Build (Do it)
                  </button>
                  <button
                    type="button"
                    className={`habit-intent-btn ${form.goal_type === 'quit' ? 'active quit' : ''}`}
                    onClick={() => set('goal_type', 'quit')}
                  >
                    Quit (Stop it)
                  </button>
                </div>
              </div>

              <div className="habit-form-row">
                <label>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Morning coffee"
                  autoFocus
                />
              </div>

              <div className="habit-form-row">
                <label>Category</label>
                <AreaPicker
                  value={form.area}
                  areas={areas}
                  onSelect={(id) => set('area', id)}
                  onAreasChanged={async () => {
                    const updated = await fetchAreas();
                    setAreas(updated);
                  }}
                  placeholder="No category"
                />
              </div>

              <div className="habit-form-2col">
                <div className="habit-form-row">
                  <label>Daily Min Target</label>
                  <input
                    type="number"
                    min={1}
                    value={form.min_per_day}
                    onChange={e => set('min_per_day', e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="habit-form-row">
                  <label>Daily Max (Optional)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_per_day}
                    onChange={e => set('max_per_day', e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="habit-form-row">
                <label>Reminders</label>
                <div className="habit-reminders-list">
                  {form.reminders.map((time, idx) => (
                    <div key={idx} className="habit-reminder-row">
                      <input
                        type="time"
                        value={time}
                        onChange={e => updateReminder(idx, e.target.value)}
                      />
                      <button
                        type="button"
                        className="habit-reminder-remove"
                        onClick={() => removeReminder(idx)}
                        title="Remove reminder"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" className="habit-btn-add-reminder" onClick={addReminder}>
                    + Add reminder
                  </button>
                </div>
              </div>

              <div className="habit-form-row">
                <label>Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Optional context"
                />
              </div>

              <div className="habit-form-2col">
                <div className="habit-form-row">
                  <label>Sort order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => set('sort_order', e.target.value)}
                  />
                </div>
                {!isCreate && (
                  <div className="habit-form-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={!!form.is_archived}
                        onChange={e => set('is_archived', e.target.checked ? 1 : 0)}
                      />
                      {' '}Archived
                    </label>
                  </div>
                )}
              </div>

              {error && <div className="habit-form-error">{error}</div>}
            </form>
          </div>

          {/* RIGHT COLUMN: HISTORY */}
          <div className="habit-drawer-col-history">
            {!isCreate && (
              <div className="habit-history-section">
                <div className="habit-history-header">
                  <h4>Log History</h4>
                  {loadingLogs && <span className="loading-spinner-small" />}
                </div>
                
                {logs.length === 0 ? (
                  <div className="habit-history-empty">No logs yet.</div>
                ) : (
                  <div className="habit-history-list">
                    {logs.map(log => (
                      <div key={log.id} className="habit-history-item">
                        {editingLogId === log.id ? (
                          <div className="habit-history-edit-form">
                            <div className="habit-form-2col">
                              <input type="date" value={logForm.date} onChange={e => setLogForm({...logForm, date: e.target.value})} />
                              <input type="time" value={logForm.time} onChange={e => setLogForm({...logForm, time: e.target.value})} />
                            </div>
                            <textarea 
                              rows={2} 
                              value={logForm.notes} 
                              onChange={e => setLogForm({...logForm, notes: e.target.value})}
                              placeholder="Notes..."
                            />
                            <div className="habit-history-edit-actions">
                              <button type="button" className="habit-btn-ghost-small" onClick={() => setEditingLogId(null)}>Cancel</button>
                              <button type="button" className="habit-btn-primary-small" onClick={() => saveLogEdit(log.id)}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="habit-history-item-meta">
                              <span className="log-date">{log.date_id}</span>
                              <span className="log-time">{log.logged_at.split('T')[1].slice(0, 5)}</span>
                              <div className="habit-history-item-actions">
                                <button type="button" className="log-edit-btn" onClick={() => startEditLog(log)}>✎</button>
                                <button type="button" className="log-delete-btn" onClick={() => deleteLogEntry(log.id)}>✕</button>
                              </div>
                            </div>
                            {log.notes && <div className="log-note">{log.notes}</div>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isCreate && (
              <div className="habit-history-empty-placeholder">
                <p>Log history will appear here once the habit is created.</p>
              </div>
            )}
          </div>
        </div>

        <div className="habit-drawer-footer">
          {!isCreate && (
            <button
              type="button"
              className="habit-btn-danger"
              onClick={handleDelete}
              disabled={saving}
            >
              Delete Habit
            </button>
          )}
          <div className="habit-drawer-footer-spacer" />
          <button type="button" className="habit-btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="habit-form" className="habit-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : (isCreate ? 'Create habit' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
