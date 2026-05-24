import React, { useEffect, useRef, useState } from 'react';
import { DateTime } from 'luxon';
import CalendarGrid from '../components/Calendar/CalendarGrid';

const CalendarPage = () => {
  const scrollAreaRef = useRef(null);
  const [timezone, setTimezone] = useState(localStorage.getItem('calendarly_tz') || 'America/Los_Angeles');
  
  // Dynamic week pagination state
  // Default to May 24, 2026 as the active base week since that's where seeded events are
  // TODO: I need to make the baseDate as the currentDate because it could be old events.
  const [baseDate, setBaseDate] = useState(() => 
    DateTime.fromObject({ year: 2026, month: 5, day: 24 }, { zone: timezone })
  );

  useEffect(() => {
    // Scroll to 08:00 by default (8 * 80px + header height)
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 8 * 80 + 72 - 40;
    }
  }, []);

  const handleTzChange = (e) => {
    const newTz = e.target.value;
    setTimezone(newTz);
    localStorage.setItem('calendarly_tz', newTz);
  };

  // Pagination Handlers
  const handlePrevWeek = () => {
    setBaseDate(prev => prev.minus({ weeks: 1 }));
  };

  const handleNextWeek = () => {
    setBaseDate(prev => prev.plus({ weeks: 1 }));
  };

  const handleToday = () => {
    // Reset baseDate to the session reference date (Sunday, May 24, 2026)
    setBaseDate(DateTime.fromObject({ year: 2026, month: 5, day: 24 }, { zone: timezone }));
  };

  // Week range calculation for display in the header
  const tzBaseDate = baseDate.setZone(timezone);
  const sunday = tzBaseDate.minus({ days: tzBaseDate.weekday % 7 });
  const saturday = sunday.plus({ days: 6 });

  const formatWeekRange = (sun, sat) => {
    if (sun.year !== sat.year) {
      return `${sun.toFormat('LLL d, yyyy')} – ${sat.toFormat('LLL d, yyyy')}`;
    }
    if (sun.month !== sat.month) {
      return `${sun.toFormat('LLL d')} – ${sat.toFormat('LLL d, yyyy')}`;
    }
    return `${sun.toFormat('LLL d')} – ${sat.toFormat('d, yyyy')}`;
  };

  const timezones = [
    { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
    { label: 'Mountain Time (MT)', value: 'America/Denver' },
    { label: 'Central Time (CT)', value: 'America/Chicago' },
    { label: 'Eastern Time (ET)', value: 'America/New_York' },
    { label: 'UTC', value: 'UTC' },
    { label: 'London (GMT/BST)', value: 'Europe/London' },
    { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  ];

  return (
    <div className="calendar-page">
      <div className="page-header calendar-header-flex">
        <div>
          <h2>Calendar Tracking</h2>
          <p className="page-description">
            Dual-track 7-day grid: Plan your intention (left) and measure your reality (right).
          </p>
        </div>
        <div className="header-controls">
          <div className="calendar-navigation glass-panel">
            <button className="btn btn-ghost btn-today" onClick={handleToday}>
              Today
            </button>
            <button className="btn btn-icon btn-nav" onClick={handlePrevWeek} title="Previous Week">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button className="btn btn-icon btn-nav" onClick={handleNextWeek} title="Next Week">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
            <span className="week-range-display">{formatWeekRange(sunday, saturday)}</span>
          </div>

          <div className="timezone-selector">
            <label className="form-label" style={{ margin: 0 }}>Timezone:</label>
            <select 
              className="timezone-select" 
              value={timezone} 
              onChange={handleTzChange}
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="calendar-container glass-panel">
        <div className="calendar-scroll-viewport" ref={scrollAreaRef}>
          <CalendarGrid timezone={timezone} baseDate={baseDate} />
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
