import React, { useEffect, useRef, useState, useMemo } from 'react';
import { DateTime } from 'luxon';
import CalendarGrid from '../components/Calendar/CalendarGrid';
import DayPlannerPanel from '../components/DayPlannerPanel';
import TaskFavoritesPanel from '../components/TaskFavoritesPanel';

const CalendarPage = ({ hideDayPlanner = false }) => {
  const scrollAreaRef = useRef(null);
  const [timezone, setTimezone] = useState(localStorage.getItem('calendarly_tz') || 'America/Los_Angeles');
  
  // Dynamic week pagination state — starts at the current week (Sunday)
  const [baseDate, setBaseDate] = useState(() => {
    const today = DateTime.now().setZone(timezone);
    return today.minus({ days: today.weekday % 7 });
  });

  // Day Planner panel width (drag-to-resize)
  const [plannerWidth, setPlannerWidth] = useState(400);
  const plannerResizeRef = useRef(null);
  const plannerColRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (!plannerResizeRef.current) return;
      const delta = plannerResizeRef.current.startX - e.clientX;
      const w = Math.min(700, Math.max(280, plannerResizeRef.current.startWidth + delta));
      plannerResizeRef.current.width = w;
      if (plannerColRef.current) plannerColRef.current.style.width = `${w}px`;
    };
    const onUp = () => {
      if (plannerResizeRef.current) {
        setPlannerWidth(plannerResizeRef.current.width ?? plannerResizeRef.current.startWidth);
        if (plannerColRef.current) plannerColRef.current.style.transition = '';
        plannerResizeRef.current = null;
      }
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Mobile day view state
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState('week');
  const [dayOffset, setDayOffset] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    setIsMobile(isMobile);
    if (isMobile) {
      const today = DateTime.now().setZone(timezone);
      const sunday = today.minus({ days: today.weekday % 7 });
      setBaseDate(sunday);
      setDayOffset(today.weekday % 7);
      setViewMode('day');
    }
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 8 * 80 + 72 - 40;
    }
  }, [viewMode]);

  const handleTzChange = (e) => {
    const newTz = e.target.value;
    setTimezone(newTz);
    localStorage.setItem('calendarly_tz', newTz);
  };

  // Week pagination
  const handlePrevWeek = () => {
    setBaseDate(prev => prev.minus({ weeks: 1 }));
  };

  const handleNextWeek = () => {
    setBaseDate(prev => prev.plus({ weeks: 1 }));
  };

  const handleToday = () => {
    const today = DateTime.now().setZone(timezone);
    setBaseDate(today.minus({ days: today.weekday % 7 }));
  };

  // Day navigation (mobile)
  const handlePrevDay = () => {
    setDayOffset(prev => {
      if (prev === 0) {
        setBaseDate(p => p.minus({ weeks: 1 }));
        return 6;
      }
      return prev - 1;
    });
  };

  const handleNextDay = () => {
    setDayOffset(prev => {
      if (prev === 6) {
        setBaseDate(p => p.plus({ weeks: 1 }));
        return 0;
      }
      return prev + 1;
    });
  };

  const handleTodayDay = () => {
    const today = DateTime.now().setZone(timezone);
    const sunday = today.minus({ days: today.weekday % 7 });
    setBaseDate(sunday);
    setDayOffset(today.weekday % 7);
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

  // Current day being viewed (for mobile nav)
  const currentDay = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => sunday.plus({ days: i }));
    return days[dayOffset] || sunday;
  }, [sunday, dayOffset]);

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
      <div className={`page-header calendar-header-flex ${viewMode === 'day' ? 'mobile-header-hidden' : ''}`}>
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

      {viewMode === 'day' && (
        <div className="mobile-day-nav">
          <button className="btn btn-icon btn-nav" onClick={handlePrevDay} title="Previous Day">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div className="mobile-day-nav-label">
            <span className="mobile-day-name">{currentDay.toFormat('EEEE')}</span>
            <span className="mobile-day-date">{currentDay.toFormat('LLL d, yyyy')}</span>
          </div>
          <button className="btn btn-icon btn-nav" onClick={handleNextDay} title="Next Day">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          <button className="btn btn-ghost btn-today" onClick={handleTodayDay} title="Go to Today">
            Today
          </button>
        </div>
      )}

      <div className={`calendar-with-panel ${viewMode === 'day' ? 'day-mode' : ''}`}>
        <div className="calendar-container glass-panel">
          <div className="calendar-scroll-viewport" ref={scrollAreaRef}>
            <CalendarGrid timezone={timezone} baseDate={baseDate} viewMode={viewMode} dayOffset={dayOffset} />
          </div>
        </div>
        {!hideDayPlanner && (
          <div
            ref={plannerColRef}
            className={`right-panel-column ${rightPanelOpen ? 'rpc-expanded' : 'rpc-collapsed'}`}
            style={rightPanelOpen ? { width: plannerWidth } : undefined}
          >
            {rightPanelOpen && (
              <div
                className="rpc-resize-handle"
                onMouseDown={e => {
                  e.preventDefault();
                  if (plannerColRef.current) plannerColRef.current.style.transition = 'none';
                  plannerResizeRef.current = { startX: e.clientX, startWidth: plannerWidth };
                  document.body.style.cursor = 'col-resize';
                }}
              />
            )}
            <DayPlannerPanel isOpen={rightPanelOpen} onToggle={() => setRightPanelOpen(p => !p)} />
            {rightPanelOpen && <TaskFavoritesPanel />}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
