import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchTherapyPattern, fetchTherapyEntries } from '../utils/api/therapyJournal';
import './TherapyJournal.css';

function fmtDate(d) {
  if (!d) return {};
  const dt = new Date(d + 'T12:00:00');
  return {
    month: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day:   dt.getDate(),
    year:  dt.getFullYear(),
  };
}

function moodColor(v) {
  if (!v) return 'var(--text-dimmed)';
  if (v >= 7) return '#2ECC71';
  if (v >= 5) return '#F1C40F';
  return '#E74C3C';
}

function moodEmoji(v) {
  if (!v) return null;
  if (v >= 8) return '😊';
  if (v >= 6) return '🙂';
  if (v >= 4) return '😶';
  if (v >= 2) return '😔';
  return '😞';
}

function sleepDotColor(v) { return v <= 1 ? 'red' : v <= 2 ? 'yellow' : 'green'; }
function moodDotColor(v)  { return v <= 3 ? 'red' : v <= 6 ? 'yellow' : 'green'; }

function MiniDots({ value, max, colorFn }) {
  return (
    <div className="tj-mini-dots">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`tj-mini-dot${i < value ? ` on ${colorFn ? colorFn(value) : ''}` : ''}`} />
      ))}
    </div>
  );
}

export default function TherapyPatternPage() {
  const { patternId } = useParams();
  const [pattern, setPattern]   = useState(null);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTherapyPattern(patternId),
      fetchTherapyEntries({ pattern_id: patternId }),
    ])
      .then(([p, e]) => { setPattern(p); setEntries(e); })
      .catch(err => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [patternId]);

  return (
    <div className="tj-page">
      {/* Top bar */}
      <div className="tj-page-topbar">
        <Link to="/personal-care/journal" className="tj-topbar-back">← Journal</Link>
        <span className="tj-topbar-sep">|</span>
        <span className="tj-topbar-title">Pattern</span>
      </div>

      {loading && (
        <div className="tj-empty"><span style={{ color: 'var(--text-dimmed)', fontSize: 13 }}>Loading…</span></div>
      )}

      {error && (
        <div className="tj-empty"><span style={{ color: 'var(--accent-danger)', fontSize: 13 }}>{error}</span></div>
      )}

      {!loading && pattern && (
        <>
          {/* Pattern header */}
          <div className="tj-pattern-header">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="tj-pattern-header-title">{pattern.name}</h1>
              <span className="tj-pattern-cat-badge" data-cat={pattern.category || 'other'}>
                {(pattern.category || 'other').replace('_', ' ')}
              </span>
            </div>
            <div className="tj-pattern-header-meta">
              <span>{pattern.occurrence_count} {pattern.occurrence_count === 1 ? 'entry' : 'entries'}</span>
            </div>
            {pattern.description && (
              <p className="tj-pattern-header-desc">{pattern.description}</p>
            )}
          </div>

          {/* Entry list */}
          <div className="tj-list-body">
            {entries.length === 0 ? (
              <div className="tj-empty">
                <span className="tj-empty-icon">📭</span>
                <span>No entries linked to this pattern yet.</span>
              </div>
            ) : (
              <div className="tj-list-grid">
                {entries.map(e => {
                  const { month, day, year } = fmtDate(e.entry_date);
                  const mood  = e.state?.mood;
                  const sleep = e.state?.sleep_quality;
                  const eat   = e.state?.eating;
                  return (
                    <Link
                      key={e.id}
                      to={`/personal-care/journal/${e.id}?from_pattern=${patternId}`}
                      className="tj-card"
                    >
                      {/* Date badge */}
                      <div className="tj-card-date-badge">
                        <span className="tj-card-month">{month}</span>
                        <span className="tj-card-day">{day}</span>
                        <span className="tj-card-year">{year}</span>
                      </div>

                      {/* Body */}
                      <div className="tj-card-body">
                        <div className="tj-card-label">{e.session_label || 'Untitled entry'}</div>
                        {e.context && <div className="tj-card-context">{e.context}</div>}
                        <div className="tj-card-chips">
                          {mood != null && (
                            <span className="tj-chip-mood" style={{ color: moodColor(mood), background: `color-mix(in srgb, ${moodColor(mood)} 12%, transparent)`, padding: '2px 8px', borderRadius: 999 }}>
                              {moodEmoji(mood)} {mood}/10
                            </span>
                          )}
                          {e.pattern_count > 0 && <span className="tj-chip">{e.pattern_count} pattern{e.pattern_count !== 1 ? 's' : ''}</span>}
                          {e.open_question_count > 0 && <span className="tj-chip">{e.open_question_count} open Q</span>}
                        </div>
                      </div>

                      {/* Dots */}
                      <div className="tj-card-dots">
                        {sleep != null && (
                          <div>
                            <div className="tj-mini-dot-label">Sleep</div>
                            <MiniDots value={sleep} max={5} colorFn={sleepDotColor} />
                          </div>
                        )}
                        {mood != null && (
                          <div>
                            <div className="tj-mini-dot-label">Mood</div>
                            <MiniDots value={Math.round(mood / 2)} max={5} colorFn={moodDotColor} />
                          </div>
                        )}
                        {eat != null && (
                          <div>
                            <div className="tj-mini-dot-label">Eat</div>
                            <MiniDots value={eat} max={5} colorFn={sleepDotColor} />
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
