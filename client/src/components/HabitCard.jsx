function timeSince(iso) {
  if (!iso) return null;
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HabitCard({ habit, onLog, onUndo, onEdit, onOpenLog, busy }) {
  const count = habit.total_count || 0;
  const accent = habit.color_hex || '#95A5A6';
  const lastLabel = timeSince(habit.last_logged_at);

  return (
    <div className="habit-card" style={{ '--habit-color': accent }}>
      <button
        type="button"
        className="habit-card-edit"
        onClick={() => onEdit(habit)}
        aria-label={`Edit ${habit.name}`}
        title="Edit habit"
      >
        ✎
      </button>

      <div className="habit-card-head">
        <span className="habit-card-icon">{habit.icon || '◉'}</span>
        <div className="habit-card-meta">
          <div className="habit-card-name">{habit.name}</div>
          {habit.area && <div className="habit-card-area">{habit.area}</div>}
        </div>
      </div>

      <div className="habit-card-reminders">
        {habit.reminders?.length > 0 && (
          <div className="habit-reminders-chips">
            {habit.reminders.map((time, i) => (
              <span key={i} className="habit-reminder-chip">⏰ {time}</span>
            ))}
          </div>
        )}
      </div>

      <div className="habit-card-count" aria-live="polite">
        <span className="habit-card-count-value">{count}</span>
        <span className="habit-card-count-label">today</span>
      </div>

      <div className="habit-card-actions">
        <button
          type="button"
          className="habit-card-undo"
          onClick={() => onUndo(habit)}
          disabled={busy || count === 0}
          aria-label={`Undo last log for ${habit.name}`}
          title={count === 0 ? 'Nothing to undo' : 'Undo most recent log'}
        >
          −
        </button>
        <button
          type="button"
          className="habit-card-log-detail"
          onClick={() => onOpenLog()}
          disabled={busy}
          title="Log with details (notes, time)"
        >
          📝
        </button>
        <button
          type="button"
          className="habit-card-log"
          onClick={() => onLog(habit)}
          disabled={busy}
          aria-label={`Log ${habit.name}`}
        >
          +1
        </button>
      </div>

      <div className="habit-card-foot">
        {lastLabel ? `Last: ${lastLabel}` : 'Not logged today'}
      </div>
    </div>
  );
}
