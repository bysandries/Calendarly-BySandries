import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { DateTime } from 'luxon';
import AreaPicker from '../AreaPicker';

const CreationPopover = ({ isOpen, onClose, initialData, areas, onSave, onAreasChanged, timezone }) => {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('event'); // event, task, appointment
  const [startTime, setStartTime] = useState('9:30am');
  const [endTime, setEndTime] = useState('10:30am');
  const [isAllDay, setIsAllDay] = useState(false);
  const [repeatOption, setRepeatOption] = useState('does-not-repeat');
  const [repeatLimitType, setRepeatLimitType] = useState('count');
  const [repeatCount, setRepeatCount] = useState(10);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');
  const [customDays, setCustomDays] = useState([true, true, true, true, true, false, false]); // M T W T F S S
  const [area, setArea] = useState('general');
  const [notes, setNotes] = useState('');
  const [creator, setCreator] = useState('Manual');
  const [participants, setParticipants] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper: Convert 24h "HH:MM" to 12h "h:mma"
  const to12Hour = (time24) => {
    if (!time24) return '9:30am';
    const [hStr, mStr] = time24.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM}${ampm}`;
  };

  // Helper: Convert 12h "h:mma" to 24h "HH:MM"
  const to24Hour = (time12) => {
    const clean = time12.toLowerCase().replace(/\s+/g, '');
    const match = clean.match(/^(\d+):(\d+)(am|pm)$/);
    if (!match) return '09:30';
    let [, hStr, mStr, ampm] = match;
    let h = Number(hStr);
    const m = Number(mStr);
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (initialData) {
      setTitle('');
      setMode('event');
      setIsAllDay(false);
      setRepeatOption('does-not-repeat');
      setArea('general');
      setNotes('');
      setCreator('Manual');
      setParticipants('');
      setIsExpanded(false);

      // Extract and format initial times
      if (initialData.timeSlot) {
        setStartTime(to12Hour(initialData.timeSlot));
      }
      if (initialData.endTimeSlot) {
        setEndTime(to12Hour(initialData.endTimeSlot));
      } else if (initialData.timeSlot) {
        // Default 1 hour later
        const [h, m] = initialData.timeSlot.split(':').map(Number);
        const nextHour = (h + 1) % 24;
        const nextHourStr = `${nextHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        setEndTime(to12Hour(nextHourStr));
      }
    }
  }, [initialData]);

  if (!isOpen || !initialData) return null;

  // Luxon formatted date (e.g. Monday, May 25)
  const luxonDate = DateTime.fromISO(initialData.dateString);
  const formattedDisplayDate = luxonDate.toFormat('cccc, LLLL d');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const formatted24Start = to24Hour(startTime);
    const formatted24End = to24Hour(endTime);

    // Calculate duration in minutes from start/end times
    const [sh, sm] = formatted24Start.split(':').map(Number);
    const [eh, em] = formatted24End.split(':').map(Number);
    let duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration <= 0) duration = 60; // fallback if invalid

    // Map selected repeat option to standard RFC 5545 RRULE string
    let rrule = null;
    if (repeatOption !== 'does-not-repeat') {
      let baseRule = '';
      if (repeatOption === 'daily') {
        baseRule = 'FREQ=DAILY;INTERVAL=1';
      } else if (repeatOption === 'weekly') {
        const weekdayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        const dayName = weekdayNames[luxonDate.weekday % 7];
        baseRule = `FREQ=WEEKLY;BYDAY=${dayName};INTERVAL=1`;
      } else if (repeatOption === 'monthly') {
        baseRule = 'FREQ=MONTHLY;INTERVAL=1';
      } else if (repeatOption === 'annually') {
        baseRule = 'FREQ=YEARLY;INTERVAL=1';
      } else if (repeatOption === 'custom') {
        const dayCodes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        const selected = customDays
          .map((active, i) => (active ? dayCodes[i] : null))
          .filter(Boolean)
          .join(',');
        if (selected) {
          baseRule = `FREQ=WEEKLY;BYDAY=${selected};INTERVAL=1`;
        }
      }

      // Append limit
      if (baseRule) {
        if (repeatLimitType === 'count') {
          baseRule += `;COUNT=${Math.max(1, parseInt(repeatCount, 10) || 1)}`;
        } else if (repeatLimitType === 'until') {
          const untilStr = repeatUntilDate.replace(/-/g, '');
          if (untilStr.length === 8) {
            baseRule += `;UNTIL=${untilStr}`;
          }
        }
        rrule = baseRule;
      }
    }

    onSave({
      title,
      area: mode === 'task' ? 'general' : area,
      date_string: initialData.dateString,
      time_slot: formatted24Start,
      duration_mins: isAllDay ? 1440 : duration,
      column_type: initialData.columnType,
      notes: `${mode === 'appointment' ? 'Appointment schedule (New)\n' : ''}${notes}`,
      timezone: timezone || 'America/Los_Angeles',
      rrule,
      creator,
      participants,
    });
    onClose();
  };

  const selectedAreaObj = areas.find(a => a.id === area);
  const accentColor = selectedAreaObj ? selectedAreaObj.color_hex : 'var(--accent-primary)';

  const style = {
    position: 'fixed',
    top: `${initialData.y}px`,
    left: `${initialData.x}px`,
    zIndex: 900,
    width: isExpanded ? '480px' : '420px',
    transition: 'width 0.2s ease-in-out',
  };

  return ReactDOM.createPortal(
    <div className="creation-popover google-popover glass-panel" style={style} onMouseDown={e => e.stopPropagation()}>
      {/* Header: hamburger left, close right */}
      <div className="gpop-header">
        <button
          className="gpop-icon-btn"
          type="button"
          title={isExpanded ? 'Collapse' : 'Expand'}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label="Toggle expand"
        >
          <span className="gpop-hamburger">≡</span>
        </button>
        <button
          className="gpop-icon-btn"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          <span className="gpop-close">✕</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="gpop-form">

        {/* Title input */}
        <input
          type="text"
          className="gpop-title"
          placeholder="Add title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />

        {/* Mode tabs (inline, active = pill) */}
        <div className="gpop-tabs">
          <button
            type="button"
            className={`gpop-tab ${mode === 'event' ? 'active' : ''}`}
            onClick={() => setMode('event')}
          >
            Event
          </button>
          <button
            type="button"
            className={`gpop-tab ${mode === 'task' ? 'active' : ''}`}
            onClick={() => setMode('task')}
          >
            Task
          </button>
          <button
            type="button"
            className={`gpop-tab ${mode === 'appointment' ? 'active' : ''}`}
            onClick={() => setMode('appointment')}
          >
            Appointment schedule
            <span className="gpop-new-tag">New</span>
          </button>
        </div>

        {/* Time row: date pill + start pill — end pill */}
        <div className="gpop-row">
          <div className="gpop-time-pills">
            <span className="gpop-pill gpop-pill-static">{formattedDisplayDate}</span>
            {!isAllDay && (
              <>
                <input
                  type="text"
                  className="gpop-pill gpop-pill-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="9:30am"
                  pattern="^\d{1,2}:\d{2}(am|pm)$"
                  required
                  aria-label="Start time"
                />
                <span className="gpop-dash">–</span>
                <input
                  type="text"
                  className="gpop-pill gpop-pill-input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="10:30am"
                  pattern="^\d{1,2}:\d{2}(am|pm)$"
                  required
                  aria-label="End time"
                />
              </>
            )}
          </div>
        </div>

        {/* All day + Time zone link */}
        <div className="gpop-row">
          <label className="gpop-checkbox-label">
            <input
              type="checkbox"
              className="gpop-checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
            />
            <span>All day</span>
          </label>
          <a
            href="/calendar"
            className="gpop-link"
            onClick={(e) => {
              e.preventDefault();
              alert(`Selected Time Zone: ${DateTime.local().zoneName}`);
            }}
          >
            Time zone
          </a>
        </div>

        {/* Repeat dropdown (pill-shaped, inline) */}
        <div className="gpop-row">
          <select
            className="gpop-pill gpop-pill-select"
            value={repeatOption}
            onChange={(e) => setRepeatOption(e.target.value)}
          >
            <option value="does-not-repeat">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annually">Annually</option>
            <option value="custom">Custom…</option>
          </select>
        </div>

        {/* Custom day picker */}
        {repeatOption === 'custom' && (
          <div className="gpop-row">
            <div className="gpop-day-picker">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => (
                <button
                  key={i}
                  type="button"
                  className={`gpop-day-pill ${customDays[i] ? 'active' : ''}`}
                  onClick={() => {
                    setCustomDays(prev => {
                      const next = [...prev];
                      next[i] = !next[i];
                      return next;
                    });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recurring limit controls */}
        {repeatOption !== 'does-not-repeat' && (
          <div className="gpop-row gpop-repeat-limit">
            <label className="gpop-limit-label">
              <input
                type="radio"
                name="repeatLimit"
                checked={repeatLimitType === 'count'}
                onChange={() => setRepeatLimitType('count')}
              />
              <span>End after</span>
              <input
                type="number"
                className="gpop-limit-input"
                min={1}
                max={999}
                value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                disabled={repeatLimitType !== 'count'}
              />
              <span>occurrences</span>
            </label>
            <label className="gpop-limit-label">
              <input
                type="radio"
                name="repeatLimit"
                checked={repeatLimitType === 'until'}
                onChange={() => setRepeatLimitType('until')}
              />
              <span>End on</span>
              <input
                type="date"
                className="gpop-limit-input"
                value={repeatUntilDate}
                onChange={(e) => setRepeatUntilDate(e.target.value)}
                disabled={repeatLimitType !== 'until'}
              />
            </label>
          </div>
        )}

        {/* Area (only for events/appointments) */}
        {mode !== 'task' && (
          <div className="gpop-row">
            <AreaPicker
              value={area}
              areas={areas}
              onSelect={setArea}
              onAreasChanged={onAreasChanged}
            />
          </div>
        )}

        {/* Creator & Participants (Metadata) */}
        {isExpanded && (
          <>
            <div className="gpop-row">
              <input
                type="text"
                className="gpop-pill gpop-pill-input"
                style={{ width: 'auto', flex: 1 }}
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="Creator (Manual / OpenClaw)"
                aria-label="Creator"
              />
            </div>
            <div className="gpop-row">
              <input
                type="text"
                className="gpop-pill gpop-pill-input"
                style={{ width: 'auto', flex: 1 }}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="Add participants..."
                aria-label="Participants"
              />
            </div>
          </>
        )}

        {/* Notes */}
        {isExpanded && (
          <div className="gpop-row gpop-row-block">
            <textarea
              className="gpop-notes"
              placeholder="Add description or reflections..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Footer */}
        <div className="gpop-footer">
          <button
            type="submit"
            className="gpop-save-btn"
            style={{ backgroundColor: accentColor, borderColor: accentColor }}
          >
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};

export default CreationPopover;
