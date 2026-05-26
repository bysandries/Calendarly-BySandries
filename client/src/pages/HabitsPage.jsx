import { useCallback, useEffect, useState } from 'react';
import {
  fetchHabitsTodaySummary,
  fetchHabitLogs,
  logHabit,
  deleteHabitLog,
} from '../utils/api';
import HabitCard from '../components/HabitCard';
import HabitEditDrawer from '../components/HabitEditDrawer';
import './HabitsPage.css';

export default function HabitsPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyHabitId, setBusyHabitId] = useState(null);
  const [drawerHabit, setDrawerHabit] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchHabitsTodaySummary();
      setSummary(data);
    } catch (err) {
      setError(err.message || 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLog(habit) {
    setBusyHabitId(habit.habit_id);
    try {
      await logHabit(habit.habit_id, { count: 1, source: 'manual' });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to log habit');
    } finally {
      setBusyHabitId(null);
    }
  }

  async function handleUndo(habit) {
    if (!habit || habit.total_count === 0) return;
    setBusyHabitId(habit.habit_id);
    try {
      const todays = await fetchHabitLogs({
        habit_id: habit.habit_id,
        date: summary?.date_id,
      });
      if (!todays.length) {
        await load();
        return;
      }
      const mostRecent = todays[0]; // already sorted by logged_at DESC
      await deleteHabitLog(mostRecent.id);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to undo');
    } finally {
      setBusyHabitId(null);
    }
  }

  function openCreate() {
    setDrawerHabit(null);
    setDrawerOpen(true);
  }

  function openEdit(habit) {
    setDrawerHabit({
      id: habit.habit_id,
      name: habit.name,
      area: habit.area,
      color_hex: habit.color_hex,
      icon: habit.icon,
      sort_order: habit.sort_order,
      is_archived: 0,
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerHabit(null);
  }

  const habits = summary?.habits || [];
  const totalToday = habits.reduce((s, h) => s + (h.total_count || 0), 0);
  const distinctToday = habits.filter(h => h.total_count > 0).length;

  return (
    <div className="page-container habits-page">
      <div className="page-header">
        <div>
          <h2>Habits</h2>
          <p className="page-description">
            Tap to log small daily actions. Available via API at{' '}
            <code>/api/habit-logs/quick/&lt;habit_id&gt;</code> so OpenClaw and other agents can log on your behalf.
          </p>
        </div>
        <button type="button" className="habit-btn-primary" onClick={openCreate}>
          + New Habit
        </button>
      </div>

      <div className="habits-overview">
        <div className="habit-stat-card">
          <div className="habit-stat-value">{habits.length}</div>
          <div className="habit-stat-label">Tracked habits</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-value">{distinctToday}</div>
          <div className="habit-stat-label">Active today</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-value">{totalToday}</div>
          <div className="habit-stat-label">Total logs today</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-value">{summary?.date_id || '—'}</div>
          <div className="habit-stat-label">Date ({summary?.timezone || 'tz'})</div>
        </div>
      </div>

      {error && <div className="habit-error-banner">{error}</div>}

      {loading ? (
        <div className="habits-empty">Loading…</div>
      ) : habits.length === 0 ? (
        <div className="habits-empty">
          No habits yet. Click <strong>+ New Habit</strong> to track your first one
          (e.g. <em>Morning coffee</em>, <em>Brush teeth — morning</em>, <em>Glass of water</em>).
        </div>
      ) : (
        <div className="habit-grid">
          {habits.map(h => (
            <HabitCard
              key={h.habit_id}
              habit={h}
              onLog={handleLog}
              onUndo={handleUndo}
              onEdit={openEdit}
              busy={busyHabitId === h.habit_id}
            />
          ))}
        </div>
      )}

      <HabitEditDrawer
        isOpen={drawerOpen}
        habit={drawerHabit}
        onClose={closeDrawer}
        onSaved={() => load()}
        onDeleted={() => load()}
      />
    </div>
  );
}
