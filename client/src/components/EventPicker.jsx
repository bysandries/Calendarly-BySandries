import { useState, useEffect } from 'react';
import { api } from '../utils/api/core';

async function fetchMeasureEvents(dateFrom, dateTo) {
  const params = {};
  if (dateFrom && dateTo) {
    params.start_date = dateFrom;
    params.end_date = dateTo;
  } else if (dateFrom) {
    params.date = dateFrom;
  }
  const res = await api.get('/events', params);
  return res.measure || [];
}

export default function EventPicker({ selectedEventId, selectedEvent, onSelect, initialDate }) {
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(selectedEvent);
  const [pickedId, setPickedId] = useState(selectedEventId);
  const [hasSearched, setHasSearched] = useState(false);

  // Sync if props change from parent
  useEffect(() => {
    setPickedId(selectedEventId);
    setPicked(selectedEvent);
  }, [selectedEventId, selectedEvent]);

  async function search() {
    if (!date) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const evs = await fetchMeasureEvents(date, date);
      setEvents(evs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function handlePick(ev) {
    setPickedId(ev.id);
    setPicked(ev);
    onSelect(ev);
  }

  function handleClear() {
    setPickedId('');
    setPicked(null);
    onSelect(null);
  }

  return (
    <div className="pp-event-picker glass-panel">
      <div className="pp-event-picker-header">
        <span className="pp-event-picker-title">🔗 Link Calendar Event</span>
        <span className="pp-event-picker-hint">One event per memory</span>
      </div>

      {/* Date selector */}
      <div className="pp-event-picker-search">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="pp-event-picker-date"
        />
        <button type="button" className="btn btn-primary" onClick={search} disabled={loading}>
          {loading ? '…' : 'Go to date'}
        </button>
      </div>

      {/* Already selected */}
      {picked && (
        <div className="pp-event-picker-selected">
          <div className="pp-event-picker-selected-info">
            <span className="pp-event-picker-check">✓</span>
            <span className="pp-event-picker-sel-label">Selected:</span>
            <span className="pp-event-picker-sel-name">{picked.date_string} · {picked.title} · {picked.time_slot}</span>
          </div>
          <button type="button" className="pp-event-picker-change" onClick={handleClear}>Change</button>
        </div>
      )}

      {/* Event list */}
      {events.length > 0 && !picked && (
        <div className="pp-event-picker-list">
          {events.map(ev => (
            <button
              key={ev.id}
              type="button"
              className={`pp-event-picker-item ${pickedId === ev.id ? 'active' : ''}`}
              onClick={() => handlePick(ev)}
            >
              <span className="pp-event-picker-radio" />
              <span className="pp-event-picker-info">
                <span className="pp-event-picker-time">{ev.time_slot}</span>
                <span className="pp-event-picker-event-title">{ev.title}</span>
                <span className="pp-event-picker-duration">{ev.duration_mins}m</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Empty states */}
      {!hasSearched && !picked && (
        <div className="pp-event-picker-empty">Pick a date and click "Go to date" to find events.</div>
      )}
      {hasSearched && events.length === 0 && !loading && !picked && (
        <div className="pp-event-picker-empty">No measure events on this date.</div>
      )}
    </div>
  );
}
