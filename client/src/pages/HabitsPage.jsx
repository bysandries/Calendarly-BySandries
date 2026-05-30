import { useCallback, useEffect, useState } from 'react';
import { fetchHabitsWeeklySummary, fetchHabitLogs, logHabit, deleteHabitLog } from '../utils/api/habitLogs';
import HabitEditDrawer from '../components/HabitEditDrawer';
import HabitLogDrawer from '../components/HabitLogDrawer';
import HabitDayDrawer from '../components/HabitDayDrawer';
import './HabitsPage.css';

function getDayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDayNum(dateStr) {
  return dateStr.split('-')[2];
}

export default function HabitsPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerHabit, setDrawerHabit] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logDrawerHabit, setLogDrawerHabit] = useState(null);
  const [dayDrawer, setDayDrawer] = useState(null); // { habit, date_id }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchHabitsWeeklySummary();
      setSummary(data);
    } catch (err) {
      setError(err.message || 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      goal_type: habit.goal_type,
      reminders: habit.reminders,
      is_archived: 0,
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerHabit(null);
  }

  function openLogDrawer(habit) {
    setLogDrawerHabit(habit);
  }

  function closeLogDrawer() {
    setLogDrawerHabit(null);
  }

  function openDayDrawer(habit, dateId) {
    setDayDrawer({ habit, date_id: dateId });
  }

  function closeDayDrawer() {
    setDayDrawer(null);
  }

  const habits = summary?.habits || [];
  const weekDates = summary?.week_dates || [];
  const buildHabits = habits.filter(h => h.goal_type !== 'quit');
  const quitHabits = habits.filter(h => h.goal_type === 'quit');

  const distinctActiveThisWeek = habits.filter(h => Object.values(h.logs_by_date).some(v => v > 0)).length;

  function renderHabitTable(list, title, isQuit = false) {
    if (list.length === 0) return null;

    return (
      <div className="habit-section">
        <h3 className={`habit-section-title ${isQuit ? 'quit' : ''}`}>{title}</h3>
        <div className="habit-table-wrapper">
          <table className="habit-table">
            <thead>
              <tr>
                <th className="col-habit">Habit</th>
                {weekDates.map(d => (
                  <th key={d} className={`col-day ${d === summary?.date_id ? 'today' : ''}`}>
                    <span className="day-name">{getDayName(d)}</span>
                    <span className="day-num">{getDayNum(d)}</span>
                  </th>
                ))}
                <th className="col-streak">Streak</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map(h => (
                <tr 
                  key={h.habit_id} 
                  className={`goal-${h.goal_type || 'build'}`}
                >
                  <td className="cell-habit" onClick={() => openEdit(h)}>
                    <div className="habit-info">
                      <div className="habit-name-row">
                        <span className="habit-name">{h.name}</span>
                        <span className="habit-target-inline">
                          {h.min_per_day}{h.max_per_day ? `–${h.max_per_day}` : '+'}
                        </span>
                      </div>
                      {h.reminders?.length > 0 && (
                        <div className="habit-reminders-mini">
                          {h.reminders.map((t, idx) => <span key={idx}>{t}</span>)}
                        </div>
                      )}
                    </div>
                  </td>
                  {weekDates.map(d => {
                    const count = h.logs_by_date[d] || 0;
                    return (
                      <td 
                        key={d} 
                        className={`cell-day ${d === summary?.date_id ? 'today' : ''}`}
                        onClick={() => openDayDrawer(h, d)}
                      >
                        {count > 0 ? (
                          <span className="log-marker" title={`${count} logs`}>
                            {count}
                          </span>
                        ) : (
                          <span className="log-empty">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="cell-streak">
                    <span className={`streak-badge ${h.streak > 0 ? 'active' : ''}`}>
                      {h.streak > 0 ? `🔥 ${h.streak}` : '0'}
                    </span>
                  </td>
                  <td className="cell-action">
                    <button
                      type="button"
                      className="habit-btn-log-plus"
                      onClick={() => openLogDrawer(h)}
                      title="Log action"
                    >
                      +
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container habits-page">
      <div className="page-header">
        <div>
          <h2>Habit Tracker</h2>
          <p className="page-description">
            Visualize your consistency. Use the <strong>+</strong> button to log actions with notes.
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
          <div className="habit-stat-value">{distinctActiveThisWeek}</div>
          <div className="habit-stat-label">Active this week</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-value">{summary?.date_id || '—'}</div>
          <div className="habit-stat-label">Today</div>
        </div>
        <div className="habit-stat-card">
          <div className="habit-stat-value">{summary?.timezone || '—'}</div>
          <div className="habit-stat-label">Timezone</div>
        </div>
      </div>

      {error && <div className="habit-error-banner">{error}</div>}

      {loading ? (
        <div className="habits-empty">Loading…</div>
      ) : habits.length === 0 ? (
        <div className="habits-empty">
          No habits yet. Click <strong>+ New Habit</strong> to track your first one.
        </div>
      ) : (
        <div className="habit-sections">
          {renderHabitTable(buildHabits, 'Habits to Build')}
          {renderHabitTable(quitHabits, 'Habits to Quit', true)}
        </div>
      )}

      <HabitEditDrawer
        isOpen={drawerOpen}
        habit={drawerHabit}
        onClose={closeDrawer}
        onSaved={() => load()}
        onDeleted={() => load()}
      />

      <HabitLogDrawer
        isOpen={!!logDrawerHabit}
        habit={logDrawerHabit}
        onClose={closeLogDrawer}
        onLogged={() => load()}
      />

      <HabitDayDrawer
        isOpen={!!dayDrawer}
        habit={dayDrawer?.habit}
        dateId={dayDrawer?.date_id}
        onClose={closeDayDrawer}
        onUpdated={() => load()}
      />
    </div>
  );
}
