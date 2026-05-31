import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchTimelineItems, exportTimeline, importTimeline } from '../utils/api/timeline';
import { LANES, TYPES, laneMeta, itemColor } from '../utils/timelineConstants';
import TimelineItemDrawer from '../components/TimelineItemDrawer';
import './TimelinePage.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseYM(dateStr) {
  if (!dateStr) return null;
  const [y, m] = dateStr.split('-').map(Number);
  return { y, m: m || 1 };
}

// Build the slice of an item that falls inside a given calendar year.
function segmentForYear(item, year) {
  const s = parseYM(item.start_date);
  if (!s) return null;
  const e = item.end_date ? parseYM(item.end_date) : s; // milestones & open items collapse to start
  if (year < s.y || year > e.y) return null;
  return {
    item,
    startMonth: year === s.y ? s.m : 1,
    endMonth: year === e.y ? e.m : 12,
    isStart: year === s.y,
    isEnd: year === e.y,
  };
}

// Greedy interval packing so overlapping bands stack onto separate sub-rows.
function packTracks(segments) {
  const sorted = [...segments].sort((a, b) => a.startMonth - b.startMonth || a.endMonth - b.endMonth);
  const trackEnds = [];
  sorted.forEach(seg => {
    let placed = false;
    for (let i = 0; i < trackEnds.length; i++) {
      if (trackEnds[i] < seg.startMonth) { seg.track = i; trackEnds[i] = seg.endMonth; placed = true; break; }
    }
    if (!placed) { seg.track = trackEnds.length; trackEnds.push(seg.endMonth); }
  });
  return sorted;
}

export default function TimelinePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [hiddenLanes, setHiddenLanes] = useState(() => new Set());
  const [showLaneFilter, setShowLaneFilter] = useState(false);
  const [compact, setCompact] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null); // null = closed
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    fetchTimelineItems()
      .then(rows => { setItems(rows); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const visibleItems = useMemo(() => items.filter(it =>
    (typeFilter === 'all' || it.type === typeFilter) && !hiddenLanes.has(it.lane)
  ), [items, typeFilter, hiddenLanes]);

  const years = useMemo(() => {
    const nowY = new Date().getFullYear();
    let minY = Infinity, maxY = -Infinity;
    items.forEach(it => {
      const s = parseYM(it.start_date);
      if (s) { minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); }
      const e = it.end_date && parseYM(it.end_date);
      if (e) maxY = Math.max(maxY, e.y);
    });
    if (!isFinite(minY)) { minY = nowY; maxY = nowY + 3; }
    minY = Math.min(minY, nowY);
    maxY = Math.max(maxY, nowY);
    const out = [];
    for (let y = minY; y <= maxY; y++) out.push(y);
    return out;
  }, [items]);

  // Lanes that contain at least one visible item — keeps the vertical axis stable across years.
  const activeLanes = useMemo(() => {
    const used = new Set(visibleItems.map(i => i.lane));
    return LANES.filter(l => used.has(l.key));
  }, [visibleItems]);

  const openNew = (seed) => setDrawerItem({ type: 'goal', lane: 'general', status: 'planned', progress: 0, ...seed });

  const handleTrackClick = (e, laneKey, year) => {
    if (e.target.closest('.tl-band') || e.target.closest('.tl-milestone')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const month = Math.min(12, Math.max(1, Math.floor(ratio * 12) + 1));
    openNew({ lane: laneKey, start_date: `${year}-${String(month).padStart(2, '0')}-01` });
  };

  const handleSaved = () => load();
  const handleDeleted = () => load();

  const handleExport = async () => {
    setBusy(true);
    try {
      const payload = await exportTimeline();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life-map-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. See console for details.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(items)) throw new Error('No items array found in file');
      if (!window.confirm(`Import ${items.length} item(s)? They will be added to your existing Life Map.`)) {
        setBusy(false);
        return;
      }
      const res = await importTimeline(data);
      alert(`Imported ${res.created} item(s)` +
        (res.links_created ? `, ${res.links_created} link(s)` : '') +
        (res.skipped ? `. Skipped ${res.skipped} invalid.` : '.'));
      load();
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const nowY = new Date().getFullYear();

  return (
    <div className="tl-page">
      <div className="tl-topbar">
        <h1 className="tl-title">🗺️ Life Map <span className="tl-title-sub">dreams · goals · milestones across the years</span></h1>
        <div className="tl-topbar-spacer" />

        <div className="tl-filter-group">
          <button className={`tl-filter-btn ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>All</button>
          {TYPES.map(t => (
            <button key={t.key} className={`tl-filter-btn ${typeFilter === t.key ? 'active' : ''}`} onClick={() => setTypeFilter(t.key)}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <button className="tl-filter-btn" onClick={() => setShowLaneFilter(v => !v)}>Lanes ▾</button>
        <button className="tl-filter-btn" onClick={() => setCompact(v => !v)}>{compact ? 'Comfortable' : 'Compact'}</button>
        <button className="tl-filter-btn" onClick={handleExport} disabled={busy} title="Download all items as JSON">⬇ Export</button>
        <button className="tl-filter-btn" onClick={() => fileInputRef.current?.click()} disabled={busy} title="Import items from a JSON file">⬆ Import</button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
        <button className="tl-new-btn" onClick={() => openNew({})}>+ New</button>
      </div>

      {showLaneFilter && (
        <div className="tl-topbar" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <span className="tl-title-sub" style={{ marginRight: 6 }}>Show lanes:</span>
          <div className="tl-filter-group" style={{ flexWrap: 'wrap' }}>
            {LANES.map(l => (
              <button key={l.key} className={`tl-filter-btn ${hiddenLanes.has(l.key) ? '' : 'active'}`}
                onClick={() => setHiddenLanes(prev => {
                  const next = new Set(prev);
                  next.has(l.key) ? next.delete(l.key) : next.add(l.key);
                  return next;
                })}>
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tl-canvas">
        {loading ? (
          <div className="tl-empty"><span style={{ fontSize: 13 }}>Loading…</span></div>
        ) : activeLanes.length === 0 ? (
          <div className="tl-empty">
            <span className="tl-empty-icon">🗺️</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Map your first dream</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Add goals, dreams, and milestones to see how your plans evolve over the years.</div>
            </div>
            <button className="tl-new-btn" onClick={() => openNew({})}>+ Add your first item</button>
          </div>
        ) : (
          <div className={`tl-grid ${compact ? 'compact' : ''}`}>
            {/* Sticky month header */}
            <div className="tl-month-header">
              <span className="tl-corner" />
              {MONTHS.map(m => <span key={m}>{m}</span>)}
            </div>

            {years.map(year => (
              <div key={year}>
                <div className={`tl-year-divider ${year === nowY ? 'tl-current' : ''}`}>
                  {year}{year === nowY ? ' • now' : ''}
                </div>

                {activeLanes.map(lane => {
                  const segs = packTracks(
                    visibleItems
                      .filter(it => it.lane === lane.key)
                      .map(it => segmentForYear(it, year))
                      .filter(Boolean)
                  );
                  return (
                    <div className="tl-lane" key={lane.key}>
                      <div className="tl-lane-label">
                        <span className="tl-lane-emoji">{lane.emoji}</span>{lane.label}
                      </div>
                      <div className="tl-track" onClick={(e) => handleTrackClick(e, lane.key, year)}>
                        {segs.map(seg => {
                          const it = seg.item;
                          const color = itemColor(it);
                          const gridRow = (seg.track || 0) + 1;

                          if (it.type === 'milestone') {
                            return (
                              <div key={it.id} className="tl-milestone-wrap"
                                style={{ gridColumn: `${seg.startMonth} / ${seg.startMonth + 1}`, gridRow }}
                                title={it.title}>
                                <div className="tl-milestone" style={{ background: color }}
                                  onClick={() => setDrawerItem(it)} />
                              </div>
                            );
                          }

                          const revised = (it.version_history || []).length > 0;
                          return (
                            <div key={it.id}
                              className={`tl-band type-${it.type} status-${it.status} ${seg.isStart ? '' : 'no-start'} ${seg.isEnd ? '' : 'no-end'}`}
                              style={{ gridColumn: `${seg.startMonth} / ${seg.endMonth + 1}`, gridRow,
                                background: color, borderColor: color }}
                              title={`${it.title}${it.end_date ? '' : ''}`}
                              onClick={() => setDrawerItem(it)}>
                              {it.type === 'goal' && it.progress > 0 && (
                                <div className="tl-progress" style={{ width: `${it.progress}%` }} />
                              )}
                              {it.status === 'completed' && <span className="tl-badge">✓</span>}
                              <span className="tl-band-label">{it.title}</span>
                              {revised && <span className="tl-revised-dot" title="Plan was revised">↻</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <TimelineItemDrawer
        isOpen={drawerItem !== null}
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
