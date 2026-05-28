import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPersonalCareSummary } from '../utils/api';
import '../components/Analytics.css';
import './PersonalDashboard.css';

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

function goalStatus(tags) {
  const t = (tags || '').toLowerCase();
  if (t.includes('status:done') || t.includes('done')) return { icon: '✓', color: '#2ECC71', label: 'Done' };
  if (t.includes('status:wip')  || t.includes('wip'))  return { icon: '◔', color: '#F1C40F', label: 'WIP' };
  return { icon: '○', color: 'var(--text-dimmed)', label: 'Open' };
}

// ── KPI helpers ───────────────────────────────────────────────────────────────
function KpiGauge({ pct, fillClass }) {
  return (
    <div className="kpi-gauge-container">
      <svg width="72" height="72" className="kpi-radial-svg">
        <circle cx="36" cy="36" r="30" className="kpi-radial-bg" />
        <circle cx="36" cy="36" r="30" className={`kpi-radial-fill ${fillClass}`}
          strokeDasharray={STROKE} strokeDashoffset={getDashoffset(pct)} />
        <text x="36" y="36" className="kpi-radial-text">{pct}%</text>
      </svg>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function SleepKPI({ sleep }) {
  const avg  = sleep?.avg_minutes  || 0;
  const goal = sleep?.goal_minutes || 420;
  const pct  = goal > 0 ? Math.min(Math.round((avg / goal) * 100), 100) : 0;
  const col  = sleepColor(avg, goal);
  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Sleep Score</span>
        <span className="kpi-value" style={{ fontSize: '26px' }}>{avg > 0 ? fmtDur(avg) : '—'}</span>
        <span className="kpi-subtext">7-day avg / {fmtDur(goal)} goal</span>
        <span className="kpi-subtext" style={{ fontSize: '11px', marginTop: '4px' }}>
          Alignment: <strong style={{ color: col }}>{pct}%</strong>
        </span>
      </div>
      <KpiGauge pct={pct} fillClass="pd-sleep-fill" />
    </div>
  );
}

function BuildKPI({ ratio }) {
  const pct   = ratio?.weekly_completion?.build_pct ?? 0;
  const count = ratio?.build ?? 0;
  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Build Habits</span>
        <span className="kpi-value" style={{ fontSize: '26px' }}>{count} active</span>
        <span className="kpi-subtext">Habits to reinforce</span>
        <span className="kpi-subtext" style={{ fontSize: '11px', marginTop: '4px' }}>
          Week completion: <strong style={{ color: '#2ECC71' }}>{pct}%</strong>
        </span>
      </div>
      <KpiGauge pct={pct} fillClass="pd-build-fill" />
    </div>
  );
}

function QuitKPI({ ratio }) {
  const pct   = ratio?.weekly_completion?.quit_pct ?? 0;
  const count = ratio?.quit ?? 0;
  return (
    <div className="kpi-card pd-kpi-card">
      <div className="kpi-details">
        <span className="kpi-title">Quit Habits</span>
        <span className="kpi-value" style={{ fontSize: '26px' }}>{count} active</span>
        <span className="kpi-subtext">Habits to break</span>
        <span className="kpi-subtext" style={{ fontSize: '11px', marginTop: '4px' }}>
          Avoidance rate: <strong style={{ color: '#9B59B6' }}>{pct}%</strong>
        </span>
      </div>
      <KpiGauge pct={pct} fillClass="pd-quit-fill" />
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
  const max = Math.max(goal || 0, ...daily.map(d => d.minutes), 60);
  const col = sleepColor(avg, goal);

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Sleep — 7-Day Trend</h3>
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

function GoalsPanel({ goals }) {
  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Session Goals</h3>
          <p className="panel-subtitle">Therapy goals tracked via tagged Extracts</p>
        </div>
        <Link to="/notes" className="pd-panel-link">Extracts →</Link>
      </div>

      {goals.length === 0 ? (
        <div className="no-analytics-data">
          <span className="no-data-icon">🎯</span>
          <span>Tag extracts with <code>therapy</code> + <code>goal</code> to track session goals here.</span>
        </div>
      ) : (
        <ul className="pd-goals-list">
          {goals.map(g => {
            const s = goalStatus(g.tags);
            return (
              <li key={g.id} className="pd-goal-item">
                <span className="pd-goal-status" style={{ color: s.color }} title={s.label}>{s.icon}</span>
                <span className="pd-goal-content">
                  {g.content?.length > 120 ? g.content.slice(0, 120) + '…' : g.content}
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
export default function PersonalCarePage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchPersonalCareSummary()
      .then(d  => { if (!cancelled) { setSummary(d);          setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message||'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const {
    next_session,
    sleep_7d,
    previous_goals        = [],
    habit_ratio,
    personal_care_projects = [],
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
          <ProjectsKPI projects={personal_care_projects} />
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
          <GoalsPanel        goals={previous_goals} />
        </div>
      </div>
    </div>
  );
}
