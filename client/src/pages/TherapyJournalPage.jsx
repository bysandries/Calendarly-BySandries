import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTherapyJournal } from '../hooks/useTherapyJournal';
import { EntryForm } from './TherapyEntryForm';
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

export default function TherapyJournalPage() {
  const navigate = useNavigate();
  const { entries, loading, error, createEntry } = useTherapyJournal();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);

  const handleSave = useCallback(async (data) => {
    setSaving(true);
    try {
      const entry = await createEntry(data);
      navigate(`/personal-care/journal/${entry.id}`);
    } finally {
      setSaving(false);
    }
  }, [createEntry, navigate]);

  return (
    <div className="tj-page">
      <div className="tj-page-topbar">
        <Link to="/personal-care" className="tj-topbar-back">← Personal Care</Link>
        <span className="tj-topbar-sep">|</span>
        <span className="tj-topbar-title">Therapy Journal</span>
        <div className="tj-topbar-actions">
          <button className="tj-btn-primary" onClick={() => setShowForm(true)}>+ New Entry</button>
        </div>
      </div>

      <div className="tj-list-body">
        {error && <p style={{ color: 'var(--accent-danger)', fontSize: 13 }}>Failed to load: {error}</p>}

        {loading ? (
          <div className="tj-empty"><span style={{ color: 'var(--text-dimmed)', fontSize: 13 }}>Loading…</span></div>
        ) : entries.length === 0 ? (
          <div className="tj-empty">
            <span className="tj-empty-icon">📓</span>
            <span>No entries yet. Create your first one.</span>
            <button className="tj-btn-primary" onClick={() => setShowForm(true)}>+ New Entry</button>
          </div>
        ) : (
          <div className="tj-list-grid">
            {entries.map(e => {
              const { month, day, year } = fmtDate(e.entry_date);
              const mood  = e.state?.mood;
              const sleep = e.state?.sleep_quality;
              const eat   = e.state?.eating;
              return (
                <Link key={e.id} to={`/personal-care/journal/${e.id}`} className="tj-card">
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
                      {e.linked_sleep?.length > 0 && <span className="tj-chip">💤 {e.linked_sleep.length} night{e.linked_sleep.length !== 1 ? 's' : ''}</span>}
                      {e.linked_habits?.length > 0 && <span className="tj-chip">🔁 {e.linked_habits.length} habit{e.linked_habits.length !== 1 ? 's' : ''}</span>}
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

      {showForm && (
        <EntryForm
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
