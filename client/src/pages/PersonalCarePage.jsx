import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPersonalCareSummary } from '../utils/api';
import { formatDuration } from '../lib/taskMath';

const PERSONAL_CARE_ACCENT = '#FF6B9D';

// ── Shared helpers ──────────────────────────────────────────────────────────
function formatDateLong(dateString) {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function truncate(text, n) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n).trimEnd() + '…' : text;
}

function parseGoalStatus(tags) {
  const t = (tags || '').toLowerCase();
  if (t.includes('status:done') || t.includes('done'))   return { icon: '✓', color: '#2ECC71', label: 'Done' };
  if (t.includes('status:wip')  || t.includes('wip'))    return { icon: '◔', color: '#F1C40F', label: 'In progress' };
  return { icon: '○', color: 'var(--text-dimmed)', label: 'Open' };
}

function sleepColor(minutes, goal) {
  if (minutes >= goal) return '#2ECC71';
  if (minutes >= 300)  return '#F1C40F';
  if (minutes > 0)     return '#E74C3C';
  return 'var(--text-dimmed)';
}

// ── Card chrome ─────────────────────────────────────────────────────────────
function WidgetCard({ title, action, children }) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: '180px',
        borderTop: `2px solid ${PERSONAL_CARE_ACCENT}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </h3>
        {action}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  );
}

function EmptyMessage({ children }) {
  return (
    <div style={{ fontSize: '0.82rem', color: 'var(--text-dimmed)', fontStyle: 'italic' }}>
      {children}
    </div>
  );
}

// ── Widgets ─────────────────────────────────────────────────────────────────
function NextSessionWidget({ data }) {
  if (!data) {
    return (
      <WidgetCard
        title="Next Therapy Session"
        action={<Link to="/calendar" style={{ fontSize: '0.75rem', color: PERSONAL_CARE_ACCENT, textDecoration: 'none' }}>Schedule →</Link>}
      >
        <EmptyMessage>
          No upcoming session. Create a calendar event with area "personal-care" to populate this widget.
        </EmptyMessage>
      </WidgetCard>
    );
  }

  // Compute relative label.
  const [y, m, d] = data.date_string.split('-').map(Number);
  const [hh, mm] = (data.time_slot || '00:00').split(':').map(Number);
  const eventDate = new Date(y, m - 1, d, hh, mm);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEvent = new Date(y, m - 1, d);
  const dayDiff = Math.round((startOfEvent - startOfToday) / (1000 * 60 * 60 * 24));

  let relative;
  if (dayDiff === 0)      relative = `Today, ${data.time_slot}`;
  else if (dayDiff === 1) relative = `Tomorrow, ${data.time_slot}`;
  else if (dayDiff > 0)   relative = `In ${dayDiff} days`;
  else                    relative = 'Past';

  return (
    <WidgetCard
      title="Next Therapy Session"
      action={<Link to="/calendar" style={{ fontSize: '0.75rem', color: PERSONAL_CARE_ACCENT, textDecoration: 'none' }}>Calendar →</Link>}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: PERSONAL_CARE_ACCENT }}>{relative}</div>
      <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500 }}>{data.title}</div>
      <div style={{ fontSize: '0.76rem', color: 'var(--text-dimmed)' }}>
        {formatDateLong(data.date_string)} · {data.time_slot} · {formatDuration(data.duration_mins)}
      </div>
      {data.notes && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {truncate(data.notes, 120)}
        </p>
      )}
    </WidgetCard>
  );
}

function SleepPerformanceWidget({ data }) {
  if (!data) return null;
  const { avg_minutes: avg, goal_minutes: goal, daily } = data;
  const color = sleepColor(avg, goal);
  const label =
    avg >= goal ? 'On goal' :
    avg >= 300  ? 'Below goal' :
    avg > 0     ? 'Critical' :
                  'No data';

  const max = Math.max(goal, ...daily.map(d => d.minutes), 60);
  const ratioPct = goal > 0 ? Math.round((avg / goal) * 100) : 0;

  return (
    <WidgetCard
      title="Sleep — 7-Day Average"
      action={<span style={{ fontSize: '0.7rem', color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</span>}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.7rem', fontWeight: 700, color }}>
          {avg > 0 ? formatDuration(avg) : '—'}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dimmed)' }}>
          / {formatDuration(goal)} goal · {ratioPct}%
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '52px', marginTop: 'auto' }}>
        {daily.map(d => {
          const h = max > 0 ? (d.minutes / max) * 100 : 0;
          const bg = sleepColor(d.minutes, goal);
          return (
            <div
              key={d.date_id}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
              title={`${d.date_id}: ${d.minutes > 0 ? formatDuration(d.minutes) : 'no data'}`}
            >
              <div style={{
                width: '100%',
                height: `${Math.max(h, 2)}%`,
                background: d.minutes > 0 ? bg : 'rgba(255,255,255,0.06)',
                borderRadius: '2px 2px 0 0',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dimmed)' }}>
        <span>{daily[0]?.date_id.slice(5)}</span>
        <span>{daily[daily.length - 1]?.date_id.slice(5)}</span>
      </div>
    </WidgetCard>
  );
}

function PreviousGoalsWidget({ data }) {
  if (!data || data.length === 0) {
    return (
      <WidgetCard title="Previous Session Goals">
        <EmptyMessage>
          Tag extracts with both <code>therapy</code> and <code>goal</code> to track session goals here. Add <code>status:done</code>, <code>status:wip</code>, or leave blank for open.
        </EmptyMessage>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Previous Session Goals"
      action={<Link to="/notes" style={{ fontSize: '0.75rem', color: PERSONAL_CARE_ACCENT, textDecoration: 'none' }}>Extracts →</Link>}
    >
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.map(g => {
          const status = parseGoalStatus(g.tags);
          return (
            <li key={g.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span
                title={status.label}
                style={{ fontSize: '1rem', color: status.color, lineHeight: 1.2, flexShrink: 0, marginTop: '1px' }}
              >
                {status.icon}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {truncate(g.content, 110)}
              </span>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

function RatioBlock({ label, count, color, pct }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: 700, color, lineHeight: 1.1, marginTop: '2px' }}>{count}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
        Week: {pct === null ? '—' : `${pct}%`}
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
        {pct !== null && (
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
        )}
      </div>
    </div>
  );
}

function HabitRatioWidget({ data }) {
  if (!data) return null;
  const { build, quit, weekly_completion: wc } = data;
  const noHabits = build === 0 && quit === 0;

  return (
    <WidgetCard
      title="Habit Balance"
      action={<Link to="/habits" style={{ fontSize: '0.75rem', color: PERSONAL_CARE_ACCENT, textDecoration: 'none' }}>Habits →</Link>}
    >
      {noHabits ? (
        <EmptyMessage>No active habits yet. Create build or quit habits to see weekly progress.</EmptyMessage>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '16px' }}>
            <RatioBlock label="Build" count={build} color="#2ECC71" pct={wc.build_pct} />
            <RatioBlock label="Quit"  count={quit}  color="#9B59B6" pct={wc.quit_pct} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', marginTop: 'auto' }}>
            Build = ≥1 log per day · Quit = 0 logs per day
          </div>
        </>
      )}
    </WidgetCard>
  );
}

function PersonalCareProjectsWidget({ data }) {
  if (!data || data.length === 0) {
    return (
      <WidgetCard
        title="Personal Care Projects"
        action={<Link to="/projects" style={{ fontSize: '0.75rem', color: PERSONAL_CARE_ACCENT, textDecoration: 'none' }}>Projects →</Link>}
      >
        <EmptyMessage>No projects in the personal-care area yet.</EmptyMessage>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Personal Care Projects"
      action={<Link to="/projects" style={{ fontSize: '0.75rem', color: PERSONAL_CARE_ACCENT, textDecoration: 'none' }}>All →</Link>}
    >
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.map(p => {
          const pct = p.total_tasks ? Math.round((p.complete_tasks / p.total_tasks) * 100) : 0;
          return (
            <li key={p.id}>
              <Link
                to={`/projects/${p.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {p.title}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                    {p.phase}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: PERSONAL_CARE_ACCENT }} />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {p.complete_tasks}/{p.total_tasks} · {pct}%
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function PersonalCarePage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPersonalCareSummary()
      .then(data => { if (!cancelled) { setSummary(data); setLoading(false); } })
      .catch(err  => { if (!cancelled) { setError(err.message || 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: PERSONAL_CARE_ACCENT,
            boxShadow: `0 0 12px ${PERSONAL_CARE_ACCENT}66`,
          }} />
          Personal Care
        </h2>
        <p className="page-description">
          Therapy progress, sleep, habits, and personal-care projects in one place.
        </p>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px', color: 'var(--accent-danger)' }}>
          Failed to load: {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-panel" style={{ padding: '20px', minHeight: '180px' }}>
              <div className="skeleton" style={{ width: '60%', height: '14px', marginBottom: '12px' }} />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </div>
          ))}
        </div>
      ) : summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <NextSessionWidget          data={summary.next_session} />
          <SleepPerformanceWidget     data={summary.sleep_7d} />
          <PreviousGoalsWidget        data={summary.previous_goals} />
          <HabitRatioWidget           data={summary.habit_ratio} />
          <PersonalCareProjectsWidget data={summary.personal_care_projects} />
        </div>
      )}
    </div>
  );
}
