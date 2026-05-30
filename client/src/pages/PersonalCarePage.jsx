import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPersonalCareSummary } from '../utils/api/personalCare';
import '../components/Analytics.css';
import './PersonalDashboard.css';
import './TherapyJournal.css';

const ACCENT  = '#FF6B9D';
const STROKE  = 188.5; // 2π × r=30

function getDashoffset(pct) {
  const p = Math.min(Math.max(pct, 0), 100);
  return STROKE - (p / 100) * STROKE;
}

function fmtDur(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function sleepColor(minutes, goal) {
  if (minutes >= goal) return '#2ECC71';
  if (minutes >= 300)  return '#F1C40F';
  if (minutes > 0)     return '#E74C3C';
  return 'var(--text-dimmed)';
}

// ── KPI helpers ───────────────────────────────────────────────────────────────
function KpiGauge({ pct, fillClass, empty }) {
  return (
    <div className="kpi-gauge-container">
      <svg width="72" height="72" className="kpi-radial-svg">
        <circle cx="36" cy="36" r="30" className="kpi-radial-bg" />
        <circle cx="36" cy="36" r="30" className={`kpi-radial-fill ${fillClass}`}
          strokeDasharray={STROKE} strokeDashoffset={empty ? STROKE : getDashoffset(pct)} />
        <text x="36" y="36" className="kpi-radial-text" fill={empty ? 'var(--text-dimmed)' : undefined}>{empty ? '—' : `${pct}%`}</text>
      </svg>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function SleepKPI({ sleep }) {
  const avg  = sleep?.avg_minutes  || 0;
  const goal = sleep?.goal_minutes || 420;
  const hasData = sleep?.daily?.some(d => d.minutes > 0);
  const pct  = hasData && goal > 0 ? Math.min(Math.round((avg / goal) * 100), 100) : 0;
  const col  = sleepColor(avg, goal);
  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Sleep Score</span>
        <span className="kpi-value" style={{ fontSize: '26px' }}>{hasData ? fmtDur(avg) : '—'}</span>
        <span className="kpi-subtext">Weekly avg / {fmtDur(goal)} goal</span>
        <span className="kpi-subtext" style={{ fontSize: '11px', marginTop: '4px' }}>
          Alignment: <strong style={{ color: col }}>{hasData ? `${pct}%` : '—'}</strong>
        </span>
      </div>
      <KpiGauge pct={pct} fillClass="pd-sleep-fill" empty={!hasData} />
    </div>
  );
}

function BuildKPI({ ratio }) {
  const hasHabits = (ratio?.build ?? 0) > 0;
  const pct   = ratio?.weekly_completion?.build_pct ?? 100;
  const count = ratio?.build ?? 0;
  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Build Habits</span>
        <span className="kpi-value" style={{ fontSize: '26px' }}>{count} active</span>
        <span className="kpi-subtext">Habits to reinforce</span>
        <span className="kpi-subtext" style={{ fontSize: '11px', marginTop: '4px' }}>
          Week completion: <strong style={{ color: '#2ECC71' }}>{hasHabits ? `${pct}%` : '—'}</strong>
        </span>
      </div>
      <KpiGauge pct={pct} fillClass="pd-build-fill" empty={!hasHabits} />
    </div>
  );
}

function QuitKPI({ ratio }) {
  const hasHabits = (ratio?.quit ?? 0) > 0;
  const pct   = ratio?.weekly_completion?.quit_pct ?? 100;
  const count = ratio?.quit ?? 0;
  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Quit Habits</span>
        <span className="kpi-value" style={{ fontSize: '26px' }}>{count} active</span>
        <span className="kpi-subtext">Habits to break</span>
        <span className="kpi-subtext" style={{ fontSize: '11px', marginTop: '4px' }}>
          Avoidance rate: <strong style={{ color: '#9B59B6' }}>{hasHabits ? `${pct}%` : '—'}</strong>
        </span>
      </div>
      <KpiGauge pct={pct} fillClass="pd-quit-fill" empty={!hasHabits} />
    </div>
  );
}

function ProjectsKPI({ projects }) {
  const withTasks = projects.filter(p => p.total_tasks > 0);
  const avgPct = withTasks.length
    ? Math.round(withTasks.reduce((s, p) => s + Math.round((p.complete_tasks / p.total_tasks) * 100), 0) / withTasks.length)
    : 0;
  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Care Projects</span>
        <span className="kpi-value" style={{ fontSize: '26px' }}>{projects.length}</span>
        <span className="kpi-subtext">Personal-care projects</span>
        <span className="kpi-subtext" style={{ fontSize: '11px', marginTop: '4px' }}>
          Avg completion: <strong style={{ color: ACCENT }}>{avgPct}%</strong>
        </span>
      </div>
      <KpiGauge pct={avgPct} fillClass="pd-projects-fill" />
    </div>
  );
}

// ── Panels ────────────────────────────────────────────────────────────────────
function SleepSparklinePanel({ sleep }) {
  if (!sleep) return null;
  const { avg_minutes: avg, goal_minutes: goal, daily = [] } = sleep;
  const hasData = daily.some(d => d.minutes > 0);
  const max = Math.max(goal || 0, ...daily.map(d => d.minutes), 60);
  const col = sleepColor(avg, goal);

  if (!hasData) {
    return (
      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Sleep — Weekly Trend</h3>
            <p className="panel-subtitle">Daily rest logged vs {fmtDur(goal)} goal</p>
          </div>
        </div>
        <div className="no-analytics-data">
          <span className="no-data-icon">😴</span>
          <span>No sleep data logged for this week.</span>
          <Link to="/calendar" className="pd-panel-link" style={{ marginTop: '8px', display: 'inline-block' }}>
            Log sleep in Calendar →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Sleep — Weekly Trend</h3>
          <p className="panel-subtitle">Daily rest logged vs {fmtDur(goal)} goal</p>
        </div>
        <span className="pd-stat-badge" style={{ color: col }}>avg {avg > 0 ? fmtDur(avg) : '—'}</span>
      </div>

      <div className="pd-sparkline">
        {daily.map(d => {
          const h   = max > 0 ? (d.minutes / max) * 100 : 0;
          const bg  = sleepColor(d.minutes, goal);
          const day = d.date_id
            ? new Date(d.date_id + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
            : '';
          return (
            <div key={d.date_id} className="pd-bar-col"
              title={`${d.date_id}: ${d.minutes > 0 ? fmtDur(d.minutes) : 'no data'}`}>
              <div className="pd-bar-track">
                <div className="pd-bar-fill"
                  style={{ height: `${Math.max(h, 2)}%`, background: d.minutes > 0 ? bg : 'rgba(255,255,255,0.06)' }} />
                {goal > 0 && (
                  <div className="pd-goal-line" style={{ bottom: `${Math.min((goal / max) * 100, 98)}%` }} />
                )}
              </div>
              <span className="pd-bar-label">{day}</span>
              <span className="pd-bar-val">{d.minutes > 0 ? fmtDur(d.minutes) : '–'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextSessionPanel({ session }) {
  if (!session) {
    return (
      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Next Therapy Session</h3>
            <p className="panel-subtitle">Upcoming session from calendar</p>
          </div>
          <Link to="/calendar" className="pd-panel-link">Schedule →</Link>
        </div>
        <div className="no-analytics-data">
          <span className="no-data-icon">🗓</span>
          <span>No upcoming session. Add a calendar event in the personal-care area.</span>
        </div>
      </div>
    );
  }

  const [y, m, d] = session.date_string.split('-').map(Number);
  const today      = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startEvent = new Date(y, m - 1, d);
  const dayDiff    = Math.round((startEvent - startToday) / 86400000);

  const relative =
    dayDiff === 0 ? 'Today'
    : dayDiff === 1 ? 'Tomorrow'
    : dayDiff > 1   ? `In ${dayDiff} days`
    : 'Past';

  const dateLabel = startEvent.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Next Therapy Session</h3>
          <p className="panel-subtitle">Upcoming session from calendar</p>
        </div>
        <Link to="/calendar" className="pd-panel-link">Calendar →</Link>
      </div>

      <div className="pd-session-hero">
        <div className="pd-session-countdown">{relative}</div>
        <div className="pd-session-title">{session.title}</div>
        <div className="pd-session-meta">
          {dateLabel} · {session.time_slot} · {fmtDur(session.duration_mins)}
        </div>
        {session.notes && (
          <p className="pd-session-notes">{session.notes}</p>
        )}
      </div>
    </div>
  );
}

function HabitBalancePanel({ ratio }) {
  if (!ratio) return null;
  const { build, quit, weekly_completion: wc } = ratio;

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Habit Balance</h3>
          <p className="panel-subtitle">This week's build vs quit performance</p>
        </div>
        <Link to="/habits" className="pd-panel-link">Habits →</Link>
      </div>

      {build === 0 && quit === 0 ? (
        <div className="no-analytics-data">
          <span className="no-data-icon">🌱</span>
          <span>No active habits yet. Create build or quit habits to track weekly stats.</span>
        </div>
      ) : (
        <div className="pd-habit-grid">
          <div className="pd-habit-block">
            <div className="pd-habit-label">Build</div>
            <div className="pd-habit-count" style={{ color: '#2ECC71' }}>{build}</div>
            <div className="pd-habit-desc">habits to reinforce</div>
            <div className="pd-habit-bar-track">
              <div className="pd-habit-bar-fill" style={{ width: `${wc.build_pct ?? 0}%`, background: '#2ECC71' }} />
            </div>
            <div className="pd-habit-pct">{wc.build_pct ?? 0}% this week</div>
          </div>
          <div className="pd-habit-divider" />
          <div className="pd-habit-block">
            <div className="pd-habit-label">Quit</div>
            <div className="pd-habit-count" style={{ color: '#9B59B6' }}>{quit}</div>
            <div className="pd-habit-desc">habits to break</div>
            <div className="pd-habit-bar-track">
              <div className="pd-habit-bar-fill" style={{ width: `${wc.quit_pct ?? 0}%`, background: '#9B59B6' }} />
            </div>
            <div className="pd-habit-pct">{wc.quit_pct ?? 0}% avoidance</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoodKPI({ lastEntry }) {
  const mood  = lastEntry?.state?.mood ?? null;
  const pct   = mood != null ? Math.round((mood / 10) * 100) : 0;
  const hasData = mood != null;
  const col   = mood >= 7 ? '#2ECC71' : mood >= 5 ? '#F1C40F' : mood >= 1 ? '#E74C3C' : 'var(--text-dimmed)';
  const daysAgo = lastEntry?.entry_date
    ? Math.round((Date.now() - new Date(lastEntry.entry_date + 'T12:00:00').getTime()) / 86400000)
    : null;

  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Last Mood</span>
        <span className="kpi-value" style={{ fontSize: '26px', color: hasData ? col : 'var(--text-dimmed)' }}>
          {hasData ? `${mood}/10` : '—'}
        </span>
        <span className="kpi-subtext">
          {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : daysAgo != null ? `${daysAgo}d ago` : 'No entries yet'}
        </span>
      </div>
      <KpiGauge pct={pct} fillClass="pd-mood-fill" empty={!hasData} />
    </div>
  );
}

const GOAL_STATUS_CYCLE = { open: 'in_progress', in_progress: 'resolved', resolved: 'open' };
const GOAL_STATUS_ICONS  = { open: '○', in_progress: '◔', resolved: '✓' };
const GOAL_STATUS_COLORS = { open: 'var(--text-dimmed)', in_progress: '#F1C40F', resolved: '#2ECC71' };

function TherapyPanel({ lastEntry, openGoals, onPrepare }) {
  const hasEntry = !!lastEntry;
  const entryDate = lastEntry?.entry_date
    ? new Date(lastEntry.entry_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Therapy Journal</h3>
          <p className="panel-subtitle">Pre-session prep &amp; pattern tracking</p>
        </div>
        <Link to="/personal-care/journal" className="pd-panel-link">Journal →</Link>
      </div>

      {!hasEntry ? (
        <div className="no-analytics-data">
          <span className="no-data-icon">📓</span>
          <span>No entries yet. Prepare for your first session.</span>
        </div>
      ) : (
        <>
          <div className="tj-dash-last-row">
            <span className="tj-dash-date">{entryDate} — {lastEntry.session_label || 'Entry'}</span>
            {lastEntry.state?.mood != null && (
              <span className="tj-dash-mood">Mood {lastEntry.state.mood}/10</span>
            )}
            {lastEntry.pattern_count > 0 && (
              <span className="tj-dash-chip">{lastEntry.pattern_count} pattern{lastEntry.pattern_count !== 1 ? 's' : ''}</span>
            )}
            {lastEntry.open_question_count > 0 && (
              <span className="tj-dash-chip">{lastEntry.open_question_count} open Q</span>
            )}
          </div>

          {openGoals?.length > 0 && (
            <>
              <p className="tj-dash-section">Top goals</p>
              <ul className="tj-dash-goals">
                {openGoals.map(g => (
                  <li key={g.id} className="tj-dash-goal-item">
                    <span className="tj-dash-goal-icon" style={{ color: GOAL_STATUS_COLORS[g.status] }}>
                      {GOAL_STATUS_ICONS[g.status] || '○'}
                    </span>
                    <span>{g.text.length > 60 ? g.text.slice(0, 60) + '…' : g.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <div className="tj-dash-cta">
        <button className="tj-dash-cta-primary" onClick={onPrepare}>
          Prepare for session ↗
        </button>
      </div>
    </div>
  );
}

function CareProjectsPanel({ projects }) {
  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Care Projects</h3>
          <p className="panel-subtitle">Personal-care project milestones</p>
        </div>
        <Link to="/projects" className="pd-panel-link">All →</Link>
      </div>

      {projects.length === 0 ? (
        <div className="no-analytics-data">
          <span className="no-data-icon">◆</span>
          <span>No personal-care projects yet.</span>
        </div>
      ) : (
        <div className="project-progress-list">
          {projects.map(p => {
            const pct = p.total_tasks > 0
              ? Math.round((p.complete_tasks / p.total_tasks) * 100)
              : 0;
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="project-progress-card pd-project-card">
                <div className="proj-card-top">
                  <span className="proj-card-title">{p.title}</span>
                  <span className={`proj-card-badge ${(p.phase || 'plan').toLowerCase()}-phase`}>
                    {p.phase}
                  </span>
                </div>
                <div className="proj-progress-stats">
                  <span>Tasks</span>
                  <span>{p.complete_tasks} / {p.total_tasks} ({pct}%)</span>
                </div>
                <div className="proj-progress-bar-container">
                  <div className="proj-progress-bar-fill" style={{
                    width: `${pct}%`,
                    background: pct === 100
                      ? 'linear-gradient(90deg,#2ECC71,#27AE60)'
                      : `linear-gradient(90deg,${ACCENT},#C0395E)`,
                  }} />
                </div>
                <div className="proj-card-footer">
                  <span>Pillar: <strong>{p.pillar}</strong></span>
                  <span>Est: <strong>{Math.round((p.total_estimated_minutes || 0) / 60)}h</strong></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function weekLabel(weekStart, weekEnd) {
  if (!weekStart || !weekEnd) return '';
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(weekStart + 'T12:00:00').toLocaleDateString('en-US', opts);
  const e = new Date(weekEnd   + 'T12:00:00').toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${s} – ${e}`;
}

export default function PersonalCarePage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const offset = weekOffset;
    const today = new Date();
    const target = new Date(today);
    target.setDate(target.getDate() + offset * 7);
    const weekStart = target.toISOString().split('T')[0];

    setLoading(true);
    fetchPersonalCareSummary(weekStart)
      .then(d  => { if (!cancelled && weekOffset === offset) { setSummary(d); setLoading(false); } })
      .catch(e => { if (!cancelled && weekOffset === offset) { setError(e.message||'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [weekOffset]);

  const {
    next_session,
    sleep_7d,
    habit_ratio,
    personal_care_projects  = [],
    last_therapy_entry      = null,
    open_therapy_goals      = [],
  } = summary || {};

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="pd-page-title">
          <span className="pd-accent-dot" />
          Personal Care
        </h2>
        <p className="page-description">
          Sleep, habits, therapy progress, and personal-care projects at a glance.
        </p>
      </div>

      {error && (
        <div className="dashboard-panel" style={{ marginBottom: '24px', borderColor: 'var(--accent-danger)' }}>
          <div style={{ color: 'var(--accent-danger)', textAlign: 'center', padding: '16px' }}>
            Failed to load: {error}
          </div>
        </div>
      )}

      {/* Week selector */}
      {summary && (
        <div className="pd-week-selector">
          <button className="pd-week-btn" onClick={() => setWeekOffset(prev => prev - 1)} disabled={loading}>
            ‹ Prev Week
          </button>
          <span className="pd-week-label">
            {weekLabel(summary.window?.start, summary.window?.end)}
            {weekOffset === 0 ? <span className="pd-week-current-badge">Current</span> : null}
          </span>
          <button className="pd-week-btn" onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))} disabled={loading || weekOffset >= 0}>
            Next Week ›
          </button>
        </div>
      )}

      {/* KPI row */}
      {loading ? (
        <div className="pd-skeleton-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="kpi-card pd-kpi-card">
              <div className="kpi-details" style={{ gap: '10px', flex: 1 }}>
                <div className="skeleton" style={{ width: '55%', height: '11px' }} />
                <div className="skeleton" style={{ width: '40%', height: '28px' }} />
                <div className="skeleton" style={{ width: '75%', height: '10px' }} />
              </div>
              <div className="skeleton" style={{ width: '72px', height: '72px', borderRadius: '50%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="kpi-grid">
          <SleepKPI    sleep={sleep_7d} />
          <BuildKPI    ratio={habit_ratio} />
          <QuitKPI     ratio={habit_ratio} />
          <MoodKPI     lastEntry={last_therapy_entry} />
        </div>
      )}

      {/* Row 1 panels */}
      <div className="dashboard-grid pd-main-grid" style={{ marginTop: '24px' }}>
        <SleepSparklinePanel sleep={sleep_7d} />
        <NextSessionPanel    session={next_session} />
      </div>

      {/* Row 2 panels */}
      <div className="dashboard-grid pd-lower-grid" style={{ marginTop: '24px' }}>
        <CareProjectsPanel projects={personal_care_projects} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <HabitBalancePanel ratio={habit_ratio} />
          <TherapyPanel
            lastEntry={last_therapy_entry}
            openGoals={open_therapy_goals}
            onPrepare={() => navigate('/personal-care/journal')}
          />
        </div>
      </div>
    </div>
  );
}
