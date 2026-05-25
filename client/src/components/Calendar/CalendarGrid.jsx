import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { DateTime } from 'luxon';
import { 
  fetchEventsRange, 
  syncEventBlock, 
  clonePlan, 
  deleteEvent, 
  fetchAreas,
  updateTask,
  fetchDailyLogsRange,
  upsertDailyLog
} from '../../utils/api';
import { resolveOverlaps } from './resolveOverlaps';
import CreationPopover from './CreationPopover';
import SlideDrawer from '../SlideDrawer';

const HOUR_PX = 80;
const SNAP_MINS = 15;
const DRAG_THRESHOLD_PX = (SNAP_MINS / 60) * HOUR_PX; // 15 min = 20px @ 80px/hr

const pxToSnappedMins = (y) => {
  const mins = (y / HOUR_PX) * 60;
  const snapped = Math.round(mins / SNAP_MINS) * SNAP_MINS;
  return Math.max(0, Math.min(24 * 60, snapped));
};

const minsToHHMM = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
};

const CalendarGrid = ({ baseDate, timezone }) => {
  const [events, setEvents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [dailyLogs, setDailyLogs] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Creation Flow State
  const [drawingState, setDrawingState] = useState(null); // { date, startMins, endMins, columnType, startY, hasMoved }
  const [popoverState, setPopoverState] = useState(null); // { date, startMins, endMins, columnType, anchorEl }
  
  // Reflections Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerEvent, setActiveDrawerEvent] = useState(null);

  // Daily Log Editor State
  const [editingLogDate, setEditingLogDate] = useState(null);
  const [editingLogText, setEditingLogText] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Drag & Drop State
  const [draggedEventId, setDraggedEventId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [dragOverLane, setDragOverLane] = useState(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragOverMins, setDragOverMins] = useState(null);
  
  // Resizing State
  const [resizingState, setResizingState] = useState(null); // { eventId, startY, originalDuration }
  
  // Current Time State
  const [now, setNow] = useState(DateTime.now().setZone(timezone));

  // Micro-animations state
  const [cloningEventId, setCloningEventId] = useState(null);

  // Multi-select state
  const [selectedEventIds, setSelectedEventIds] = useState(new Set());

  // Ref to prevent click handler from opening drawer after shift+click mouseDown
  const shiftClickHandledRef = useRef(false);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(DateTime.now().setZone(timezone));
    }, 60000);
    return () => clearInterval(timer);
  }, [timezone]);

  // Keyboard delete / escape for selected events.
  // Skip when the user is typing in any editable field (drawer, daily-log textarea,
  // creation popover inputs, etc.) so Backspace still works as a normal text edit.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Drawer open: delete the active event
        if (
          isDrawerOpen &&
          activeDrawerEvent &&
          !isEditableTarget(document.activeElement) &&
          !isEditableTarget(e.target)
        ) {
          e.preventDefault();
          if (window.confirm(`Delete the event "${activeDrawerEvent.title}"?`)) {
            (async () => {
              try {
                await deleteEvent(activeDrawerEvent.id);
                setIsDrawerOpen(false);
                setActiveDrawerEvent(null);
                setSelectedEventIds(new Set());
                loadData();
              } catch (error) {
                console.error('Error deleting event:', error);
              }
            })();
          }
          return;
        }
        // Multi-select: delete selected events
        if (
          selectedEventIds.size > 0 &&
          !isDrawerOpen &&
          !isEditableTarget(document.activeElement) &&
          !isEditableTarget(e.target)
        ) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
          setActiveDrawerEvent(null);
          setSelectedEventIds(new Set());
          return;
        }
        if (selectedEventIds.size > 0) {
          setSelectedEventIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventIds, isDrawerOpen, activeDrawerEvent]);

  const handleDeleteSelected = async () => {
    if (selectedEventIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedEventIds.size} selected event(s)?`)) return;
    const ids = Array.from(selectedEventIds);
    setSelectedEventIds(new Set());
    await Promise.all(ids.map(id => deleteEvent(id).catch(() => null)));
    loadData();
  };

  const toggleSelectEvent = (block, e) => {
    if (e.shiftKey) {
      e.stopPropagation();
      e.preventDefault();
      shiftClickHandledRef.current = true;
      setSelectedEventIds(prev => {
        const next = new Set(prev);
        if (next.has(block.id)) {
          next.delete(block.id);
        } else {
          next.add(block.id);
        }
        return next;
      });
      return true; // indicates selection handled
    }
    return false;
  };

  // Time boundaries (Sunday to Saturday around active baseDate)
  const weekStart = useMemo(() => {
    const tzBaseDate = baseDate.setZone(timezone);
    return tzBaseDate.minus({ days: tzBaseDate.weekday % 7 }); // Sunday
  }, [baseDate, timezone]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i })),
  [weekStart]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const start = weekStart.minus({ days: 1 }).toISODate();
      const end = weekStart.plus({ days: 7 }).toISODate();
      
      const [eventsData, areasData, logsData] = await Promise.all([
        fetchEventsRange(start, end),
        fetchAreas(),
        fetchDailyLogsRange(start, end)
      ]);
      
      setEvents([...eventsData.plan, ...eventsData.measure]);
      setAreas(areasData);
      
      const logsMap = {};
      logsData.forEach(log => {
        logsMap[log.date_id] = log.note;
      });
      setDailyLogs(logsMap);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Global escape key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDrawingState(null);
        setPopoverState(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global mouse handlers for drawing and resizing
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      // ── Resizing Logic ──
      if (resizingState) {
        const deltaY = e.clientY - resizingState.startY;
        const deltaMins = (deltaY / 80) * 60;
        let newDuration = resizingState.originalDuration + deltaMins;
        
        // Snap to nearest 15 mins
        newDuration = Math.round(newDuration / 15) * 15;
        // Minimum 15 mins
        newDuration = Math.max(15, newDuration);

        setEvents(prev => prev.map(ev => 
          ev.id === resizingState.eventId ? { ...ev, duration_mins: newDuration } : ev
        ));
        return;
      }

      if (!drawingState) return;

      const laneEl = document.querySelector(`[data-date="${drawingState.date}"][data-lane="${drawingState.columnType}"]`);
      if (!laneEl) return;

      const rect = laneEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const endMins = pxToSnappedMins(y);

      setDrawingState(prev => {
        if (!prev) return null;
        const moved = Math.abs(y - prev.startY) >= DRAG_THRESHOLD_PX;
        return { ...prev, endMins, hasMoved: prev.hasMoved || moved };
      });
    };

    const handleGlobalMouseUp = (e) => {
      // ── Finish Resizing ──
      if (resizingState) {
        const block = events.find(ev => ev.id === resizingState.eventId);
        if (block) {
          syncEventBlock(block).then(() => loadData());
        }
        setResizingState(null);
        return;
      }

      if (!drawingState) return;

      const start = Math.min(drawingState.startMins, drawingState.endMins);
      const end = Math.max(drawingState.startMins, drawingState.endMins);
      const span = end - start;

      // Discard bare clicks and sub-15-min drags
      if (!drawingState.hasMoved || span < SNAP_MINS) {
        setDrawingState(null);
        return;
      }

      // Anchor popover to the side of the day column so the selection stays visible
      const laneEl = document.querySelector(`[data-date="${drawingState.date}"][data-lane="${drawingState.columnType}"]`);
      const dayColEl = laneEl?.parentElement;
      const colRect = dayColEl?.getBoundingClientRect();
      const POPOVER_WIDTH = 420;
      const GAP = 8;
      let x = 0;
      let y = 0;
      if (colRect) {
        x = colRect.right + GAP;
        if (x + POPOVER_WIDTH > window.innerWidth - 8) {
          x = Math.max(8, colRect.left - POPOVER_WIDTH - GAP);
        }
        y = colRect.top + (start / 60) * HOUR_PX;
        y = Math.max(8, Math.min(y, window.innerHeight - 120));
      } else {
        x = e.clientX;
        y = e.clientY;
      }

      setPopoverState({
        date: drawingState.date,
        columnType: drawingState.columnType,
        startMins: start,
        endMins: end,
        x,
        y
      });
      setDrawingState(null);
    };

    if (drawingState || resizingState) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [drawingState, resizingState, events, loadData]);

  const handleMouseDown = (e, dateString, columnType) => {
    if (e.button !== 0) return; // Only left click
    const laneEl = document.querySelector(`[data-date="${dateString}"][data-lane="${columnType}"]`);
    if (!laneEl) return;
    const rect = laneEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const snapped = pxToSnappedMins(y);
    setDrawingState({
      date: dateString,
      columnType,
      startY: y,
      startMins: snapped,
      endMins: snapped,
      hasMoved: false
    });
  };

  const handleSaveNewEvent = async (eventData) => {
    try {
      const blockSignature = `${eventData.date_string}_${eventData.time_slot}_${eventData.column_type}_${Date.now()}`;
      await syncEventBlock({
        ...eventData,
        block_signature: blockSignature,
        timezone: timezone
      });
      setPopoverState(null);
      loadData();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  // ── Reflections Drawer ──
  const handleSaveEvent = async (id, updatedFields) => {
    try {
      await syncEventBlock({
        ...updatedFields,
        id: id
      });
      loadData();
      // Update active event inside drawer
      setActiveDrawerEvent(prev => prev && prev.id === id ? { ...prev, ...updatedFields } : prev);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await deleteEvent(id);
      setIsDrawerOpen(false);
      loadData();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  // ── Daily Log Logic ──
  const handleOpenDailyLog = (date) => {
    setEditingLogDate(date);
    setEditingLogText(dailyLogs[date] || '');
  };

  const handleSaveDailyLog = async () => {
    if (!editingLogDate) return;
    setIsSavingLog(true);
    try {
      await upsertDailyLog({
        date_id: editingLogDate,
        note: editingLogText
      });
      setDailyLogs(prev => ({ ...prev, [editingLogDate]: editingLogText }));
      setEditingLogDate(null);
    } catch (error) {
      console.error('Error saving daily log:', error);
    } finally {
      setIsSavingLog(false);
    }
  };

  // ── Drag & Drop Handlers ──
  const handleDragStart = (e, block) => {
    setDraggedEventId(block.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Store drag offset relative to the block's top border
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    setDragOffsetY(offsetY);

    // Use setTimeout so the browser takes the drag image snapshot of the element BEFORE it gets dimmed/scaled
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e) => {
    setDraggedEventId(null);
    e.currentTarget.classList.remove('dragging');
    setDragOverCol(null);
    setDragOverLane(null);
    setDragOffsetY(0);
    setDragOverMins(null);
  };

  const handleDragOver = (e, dateString, laneType) => {
    e.preventDefault();
    setDragOverCol(dateString);
    setDragOverLane(laneType);

    if (draggedEventId) {
      const block = events.find(ev => ev.id.toString() === draggedEventId.toString());
      if (block) {
        const laneEl = e.currentTarget;
        const rect = laneEl.getBoundingClientRect();
        const mouseRelY = e.clientY - rect.top;
        const topY = mouseRelY - dragOffsetY;
        const snappedStart = pxToSnappedMins(topY);
        
        // Bounded within 24h
        const maxStartMins = 24 * 60 - block.duration_mins;
        const boundedStart = Math.max(0, Math.min(maxStartMins, snappedStart));
        
        setDragOverMins(boundedStart);
      }
    } else {
      // Bounded within 24h for Kanban task drag (assume 60 min duration, offsetY = 0)
      const laneEl = e.currentTarget;
      const rect = laneEl.getBoundingClientRect();
      const mouseRelY = e.clientY - rect.top;
      const snappedStart = pxToSnappedMins(mouseRelY);
      
      const maxStartMins = 24 * 60 - 60;
      const boundedStart = Math.max(0, Math.min(maxStartMins, snappedStart));
      
      setDragOverMins(boundedStart);
    }
  };

  const handleQuickClone = async (block) => {
    setCloningEventId(block.id);
    try {
      await clonePlan(block.id);
      loadData();
    } catch (error) {
      console.error('Error cloning plan:', error);
    } finally {
      setTimeout(() => setCloningEventId(null), 600);
    }
  };

  const handleDrop = async (e, dateString, laneType) => {
    e.preventDefault();
    setDragOverCol(null);
    setDragOverLane(null);
    setDragOffsetY(0);
    setDragOverMins(null);

    const taskId = e.dataTransfer.getData('task-id');
    const taskTitle = e.dataTransfer.getData('task-title');

    // 1. If it's a TASK from Kanban board
    if (taskId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const snappedStart = pxToSnappedMins(clickY);
      const boundedStart = Math.max(0, Math.min(24 * 60 - 60, snappedStart));
      
      const timeSlotStr = minsToHHMM(boundedStart);

      // Create new event from task
      await handleSaveNewEvent({
        title: taskTitle || 'Scheduled Task',
        date_string: dateString,
        time_slot: timeSlotStr,
        duration_mins: 60, // Default duration
        column_type: laneType,
        area: 'general' // Default area
      });

      // Update task status to "In Progress" or similar
      try {
        await updateTask(taskId, { status: '03 - In Progress' });
      } catch (err) {
        console.error('Failed to update task status after scheduling:', err);
      }

      return;
    }

    // 2. If it's an existing EVENT being moved
    if (!draggedEventId) return;

    const block = events.find(ev => ev.id.toString() === draggedEventId.toString());
    if (!block) return;

    // Snap start time of the anchor (dragged) block
    const rect = e.currentTarget.getBoundingClientRect();
    const topY = (e.clientY - rect.top) - dragOffsetY;
    const snappedStart = pxToSnappedMins(topY);
    const maxStartMins = 24 * 60 - block.duration_mins;
    const boundedStart = Math.max(0, Math.min(maxStartMins, snappedStart));

    const isMultiDrag = selectedEventIds.has(block.id) && selectedEventIds.size > 1;

    // 2a. Multi-drag: shift every selected event by the same date + time delta.
    // Skip the plan→measure auto-clone behavior here — it would be ambiguous for a group.
    if (isMultiDrag) {
      const [bH, bM] = (block.time_slot || '00:00').split(':').map(Number);
      const anchorOrigMins = bH * 60 + bM;
      const minsDelta = boundedStart - anchorOrigMins;

      const anchorOrigDate = DateTime.fromISO(block.date_string);
      const newAnchorDate = DateTime.fromISO(dateString);
      const daysDelta = Math.round(newAnchorDate.diff(anchorOrigDate, 'days').days);

      const ids = Array.from(selectedEventIds);
      try {
        await Promise.all(ids.map(id => {
          const ev = events.find(x => x.id.toString() === id.toString());
          if (!ev) return null;

          const evDate = DateTime.fromISO(ev.date_string);
          const newEvDate = evDate.plus({ days: daysDelta }).toISODate();

          const [h, m] = (ev.time_slot || '00:00').split(':').map(Number);
          const shifted = h * 60 + m + minsDelta;
          const evMax = 24 * 60 - ev.duration_mins;
          const boundedMins = Math.max(0, Math.min(evMax, shifted));

          return syncEventBlock({
            ...ev,
            date_string: newEvDate,
            time_slot: minsToHHMM(boundedMins),
            // Only the anchor event changes lane; the others keep their original lane
            column_type: ev.id === block.id ? laneType : ev.column_type,
            timezone: timezone
          });
        }));
        loadData();
      } catch (error) {
        console.error('Error shifting multi-selected blocks:', error);
      }
      return;
    }

    // 2b. Single-event: if dragging Planned block to Measure lane, trigger cloning operation
    if (block.column_type === 'plan' && laneType === 'measure') {
      await handleQuickClone(block);
      return;
    }

    // 2c. Single-event move
    const timeSlotStr = minsToHHMM(boundedStart);
    const updatedEvent = {
      ...block,
      date_string: dateString,
      time_slot: timeSlotStr,
      column_type: laneType,
      timezone: timezone
    };

    try {
      await syncEventBlock(updatedEvent);
      loadData();
    } catch (error) {
      console.error('Error shifting block through drag-and-drop:', error);
    }
  };

  const handleResizeStart = (e, block) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingState({
      eventId: block.id,
      startY: e.clientY,
      originalDuration: block.duration_mins
    });
  };

  // Calculate display times based on timezone conversions
  const displayEvents = events.map(event => {
    try {
      const origZone = event.timezone || 'America/Los_Angeles';
      const eventStart = DateTime.fromISO(`${event.date_string}T${event.time_slot}`, { zone: origZone });
      
      if (!eventStart.isValid) {
        return {
          ...event,
          displayDate: event.date_string,
          displayTimeSlot: event.time_slot
        };
      }

      const currentStart = eventStart.setZone(timezone);
      
      return {
        ...event,
        displayDate: currentStart.toISODate(),
        displayTimeSlot: currentStart.toFormat('HH:mm')
      };
    } catch (e) {
      console.warn('Failed to convert event timezone:', e);
      return {
        ...event,
        displayDate: event.date_string,
        displayTimeSlot: event.time_slot
      };
    }
  });

  const calculatePosition = (timeSlot, durationMins) => {
    const [h, m] = (timeSlot || '00:00').split(':').map(Number);
    return {
      top: (h * 80) + (m / 60 * 80),
      height: (durationMins / 60 * 80)
    };
  };

  if (loading && events.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', width: '100%' }}>
        <div className="skeleton-row" style={{ height: '400px' }} />
      </div>
    );
  }

  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', gridTemplateRows: '72px 1920px', minWidth: '1000px', position: 'relative' }}>
          
          {/* Header Row */}
          <div className="calendar-corner sticky-top sticky-left"></div>
          {days.map((day, i) => {
            const isToday = day.hasSame(now, 'day');
            return (
              <div 
                key={i} 
                className={`calendar-day-header sticky-top ${isToday ? 'today' : ''}`}
                style={{ gridColumn: i + 2 }}
              >
                <span className="day-name">{day.toFormat('EEE')}</span>
                <span className="day-number">{day.day}</span>
                {dailyLogs[day.toISODate()] && (
                  <span 
                    style={{ fontSize: '10px', marginTop: '4px', cursor: 'pointer', color: 'var(--accent-primary)' }}
                    onClick={() => handleOpenDailyLog(day.toISODate())}
                  >
                    📝
                  </span>
                )}
                {!dailyLogs[day.toISODate()] && (
                  <button 
                    className="btn-icon btn-sm" 
                    style={{ marginTop: '4px', opacity: 0.3 }}
                    onClick={() => handleOpenDailyLog(day.toISODate())}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}

          {/* Time Gutter */}
          <div className="time-gutter sticky-left" style={{ gridRow: '2 / 3', gridColumn: 1 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="time-label">
                {i.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {days.map((day, dayIndex) => {
            const dateStr = day.toISODate();
            const isToday = day.hasSame(now, 'day');
            const dayEvents = displayEvents.filter(ev => ev.displayDate === dateStr);
            
            const planEvents = dayEvents.filter(ev => ev.column_type === 'plan');
            const measureEvents = dayEvents.filter(ev => ev.column_type === 'measure');

            const resolvedPlan = resolveOverlaps(planEvents);
            const resolvedMeasure = resolveOverlaps(measureEvents);

            // Calculate red line position
            const nowPos = (now.hour * 80) + (now.minute / 60 * 80);

            return (
              <div 
                key={dateStr} 
                className="day-lanes" 
                style={{ gridRow: '2 / 3', gridColumn: dayIndex + 2, position: 'relative', borderRight: '1px solid var(--grid-border)' }}
              >
                {/* Visual Hour Grid Lines */}
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="hour-grid-line" style={{ top: i * 80 }} />
                ))}

                {/* Current Time Line (Red Line) */}
                {isToday && (
                  <div className="calendar-now-line" style={{ top: nowPos }}>
                    <div className="now-line-dot" />
                    <div className="now-line-label">{now.toFormat('HH:mm')}</div>
                  </div>
                )}

                {/* Plan Lane */}
                <div 
                  className={`lane plan-lane ${dragOverCol === dateStr && dragOverLane === 'plan' ? 'drag-over' : ''}`}
                  data-date={dateStr}
                  data-lane="plan"
                  onDragOver={(e) => handleDragOver(e, dateStr, 'plan')}
                  onDrop={(e) => handleDrop(e, dateStr, 'plan')}
                >
                  {resolvedPlan.map((block) => {
                    const pos = calculatePosition(block.displayTimeSlot || block.time_slot, block.duration_mins);
                    const blockColor = block.color_hex || '#3498DB';
                    const hasNotes = block.notes && block.notes.trim().length > 0;
                    const tasksCount = (block.task_ids || []).length;
                    const isCloning = cloningEventId === block.id;

                    const styleProps = {
                      ...pos,
                      color: blockColor,
                      boxShadow: `inset 0 0 0 1px ${blockColor}`,
                      width: `calc(${block.widthPct}% - 6px)`,
                      left: `calc(${block.leftPct}% + 3px)`
                    };

                    return (
                      <div
                        id={`block-${block.id}`}
                        key={block.id}
                        className={`calendar-block planned ${isCloning ? 'cloning' : ''} ${draggedEventId === block.id ? 'dragging' : ''} ${selectedEventIds.has(block.id) ? 'selected' : ''}`}
                        style={styleProps}
                        onMouseDown={(e) => {
                          if (e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            shiftClickHandledRef.current = true;
                            toggleSelectEvent(block, e);
                          }
                        }}
                        onClick={(e) => {
                          if (shiftClickHandledRef.current) {
                            shiftClickHandledRef.current = false;
                            return;
                          }
                          e.stopPropagation();
                          // If multi-selection active, toggle this event into the selection
                          if (selectedEventIds.size > 0) {
                            setSelectedEventIds(prev => {
                              const next = new Set(prev);
                              if (next.has(block.id)) {
                                next.delete(block.id);
                              } else {
                                next.add(block.id);
                              }
                              return next;
                            });
                            return;
                          }
                          setActiveDrawerEvent(block);
                          setIsDrawerOpen(true);
                          setSelectedEventIds(new Set([block.id]));
                        }}
                        draggable
                        onDragStart={(e) => {
                          // If dragging an unselected event, clear any prior multi-selection
                          if (!selectedEventIds.has(block.id) && selectedEventIds.size > 0) {
                            setSelectedEventIds(new Set());
                          }
                          handleDragStart(e, block);
                        }}
                        onDragEnd={handleDragEnd}
                      >
                        <span className="block-title">{block.title}</span>
                        <span className="block-time">{block.displayTimeSlot || block.time_slot}</span>

                        {/* Indicators Container */}
                        <div className="block-indicators">
                          {/* Notes neon flashing indicator */}
                          {hasNotes && (
                            <span className="notes-indicator" style={{ color: blockColor }}>
                              *
                            </span>
                          )}

                          {/* Tasks count indicator */}
                          {tasksCount > 0 && (
                            <span className="tasks-indicator" style={{ borderColor: blockColor, color: blockColor }}>
                              {tasksCount}
                            </span>
                          )}
                        </div>

                        <div 
                          className="resize-handle" 
                          onMouseDown={(e) => handleResizeStart(e, block)}
                        />
                      </div>
                    );
                  })}

                  {/* Drag to Create Placeholder (visible during drag and while popover is open) */}
                  {(() => {
                    const active =
                      (drawingState?.hasMoved && drawingState.date === dateStr && drawingState.columnType === 'plan' && drawingState) ||
                      (popoverState && popoverState.date === dateStr && popoverState.columnType === 'plan' && popoverState);
                    if (!active) return null;
                    const s = Math.min(active.startMins, active.endMins);
                    const e = Math.max(active.startMins, active.endMins);
                    return (
                      <div className="drawing-placeholder planned" style={{
                        top: (s / 60) * HOUR_PX,
                        height: ((e - s) / 60) * HOUR_PX,
                        left: '6px',
                        right: '6px',
                        border: '1px dashed var(--accent-primary)',
                        background: 'rgba(52, 152, 219, 0.18)'
                      }}>
                        <span className="drawing-placeholder-label">
                          {minsToHHMM(s)} – {minsToHHMM(e)} · {e - s} min
                        </span>
                      </div>
                    );
                  })()}

                  {/* Drag & Drop Move Placeholder */}
                  {(() => {
                    if (dragOverCol !== dateStr || dragOverLane !== 'plan' || dragOverMins === null) return null;
                    const draggedEvent = draggedEventId ? events.find(ev => ev.id.toString() === draggedEventId.toString()) : null;
                    const duration = draggedEvent ? draggedEvent.duration_mins : 60; // 60 mins for Kanban tasks
                    const blockColor = draggedEvent?.color_hex || '#3498DB';
                    const title = draggedEvent ? draggedEvent.title : 'New Scheduled Task';
                    
                    const s = dragOverMins;
                    const e = s + duration;
                    return (
                      <div className="drawing-placeholder planned dragging-placeholder" style={{
                        top: (s / 60) * HOUR_PX,
                        height: ((e - s) / 60) * HOUR_PX,
                        left: '6px',
                        right: '6px',
                        border: `2px dashed ${blockColor}`,
                        background: `color-mix(in srgb, ${blockColor} 15%, transparent)`,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '8px'
                      }}>
                        <span className="drawing-placeholder-label" style={{ background: blockColor }}>
                          {minsToHHMM(s)} – {minsToHHMM(e)} · {e - s} min
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 500, opacity: 0.8, textAlign: 'center' }}>
                          Moving "{title}"
                        </span>
                      </div>
                    );
                  })()}

                  {/* Empty Slot Mouse Capture */}
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="slot-capture"
                      style={{ top: i * 80, height: 80, position: 'absolute', left: 0, right: 0, zIndex: 1 }}
                      onMouseDown={(e) => handleMouseDown(e, dateStr, 'plan')}
                    />
                  ))}
                </div>

                {/* Measure Lane */}
                <div 
                  className={`lane measure-lane ${dragOverCol === dateStr && dragOverLane === 'measure' ? 'drag-over' : ''}`}
                  data-date={dateStr}
                  data-lane="measure"
                  onDragOver={(e) => handleDragOver(e, dateStr, 'measure')}
                  onDrop={(e) => handleDrop(e, dateStr, 'measure')}
                >
                  {resolvedMeasure.map((block) => {
                    const pos = calculatePosition(block.displayTimeSlot || block.time_slot, block.duration_mins);
                    const blockColor = block.color_hex || '#2ECC71';
                    const hasNotes = block.notes && block.notes.trim().length > 0;
                    const tasksCount = (block.task_ids || []).length;

                    const styleProps = {
                      ...pos,
                      '--block-color': blockColor,
                      color: blockColor,
                      width: `calc(${block.widthPct}% - 6px)`,
                      left: `calc(${block.leftPct}% + 3px)`
                    };

                    return (
                      <div
                        id={`block-${block.id}`}
                        key={block.id}
                        className={`calendar-block measured ${draggedEventId === block.id ? 'dragging' : ''} ${selectedEventIds.has(block.id) ? 'selected' : ''}`}
                        style={styleProps}
                        onMouseDown={(e) => {
                          if (e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            shiftClickHandledRef.current = true;
                            toggleSelectEvent(block, e);
                          }
                        }}
                        onClick={(e) => {
                          if (shiftClickHandledRef.current) {
                            shiftClickHandledRef.current = false;
                            return;
                          }
                          e.stopPropagation();
                          // If multi-selection active, toggle this event into the selection
                          if (selectedEventIds.size > 0) {
                            setSelectedEventIds(prev => {
                              const next = new Set(prev);
                              if (next.has(block.id)) {
                                next.delete(block.id);
                              } else {
                                next.add(block.id);
                              }
                              return next;
                            });
                            return;
                          }
                          setActiveDrawerEvent(block);
                          setIsDrawerOpen(true);
                          setSelectedEventIds(new Set([block.id]));
                        }}
                        draggable
                        onDragStart={(e) => {
                          if (!selectedEventIds.has(block.id) && selectedEventIds.size > 0) {
                            setSelectedEventIds(new Set());
                          }
                          handleDragStart(e, block);
                        }}
                        onDragEnd={handleDragEnd}
                      >
                        <span className="block-title">{block.title}</span>
                        <span className="block-time">{block.displayTimeSlot || block.time_slot}</span>

                        {/* Indicators Container */}
                        <div className="block-indicators">
                          {/* Notes neon flashing indicator */}
                          {hasNotes && (
                            <span className="notes-indicator" style={{ color: blockColor }}>
                              *
                            </span>
                          )}

                          {/* Tasks count indicator */}
                          {tasksCount > 0 && (
                            <span className="tasks-indicator" style={{ borderColor: blockColor, color: blockColor }}>
                              {tasksCount}
                            </span>
                          )}
                        </div>

                        <div 
                          className="resize-handle" 
                          onMouseDown={(e) => handleResizeStart(e, block)}
                        />
                      </div>
                    );
                  })}

                  {/* Drag to Create Placeholder (visible during drag and while popover is open) */}
                  {(() => {
                    const active =
                      (drawingState?.hasMoved && drawingState.date === dateStr && drawingState.columnType === 'measure' && drawingState) ||
                      (popoverState && popoverState.date === dateStr && popoverState.columnType === 'measure' && popoverState);
                    if (!active) return null;
                    const s = Math.min(active.startMins, active.endMins);
                    const e = Math.max(active.startMins, active.endMins);
                    return (
                      <div className="drawing-placeholder measured" style={{
                        top: (s / 60) * HOUR_PX,
                        height: ((e - s) / 60) * HOUR_PX,
                        left: '6px',
                        right: '6px',
                        border: '1px dashed var(--accent-success)',
                        background: 'rgba(46, 204, 113, 0.18)'
                      }}>
                        <span className="drawing-placeholder-label">
                          {minsToHHMM(s)} – {minsToHHMM(e)} · {e - s} min
                        </span>
                      </div>
                    );
                  })()}

                  {/* Drag & Drop Move Placeholder */}
                  {(() => {
                    if (dragOverCol !== dateStr || dragOverLane !== 'measure' || dragOverMins === null) return null;
                    const draggedEvent = draggedEventId ? events.find(ev => ev.id.toString() === draggedEventId.toString()) : null;
                    const duration = draggedEvent ? draggedEvent.duration_mins : 60; // 60 mins for Kanban tasks
                    const blockColor = draggedEvent?.color_hex || '#2ECC71';
                    const title = draggedEvent ? draggedEvent.title : 'New Scheduled Task';
                    
                    const s = dragOverMins;
                    const e = s + duration;
                    return (
                      <div className="drawing-placeholder measured dragging-placeholder" style={{
                        top: (s / 60) * HOUR_PX,
                        height: ((e - s) / 60) * HOUR_PX,
                        left: '6px',
                        right: '6px',
                        border: `2px dashed ${blockColor}`,
                        background: `color-mix(in srgb, ${blockColor} 15%, transparent)`,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '8px'
                      }}>
                        <span className="drawing-placeholder-label" style={{ background: blockColor }}>
                          {minsToHHMM(s)} – {minsToHHMM(e)} · {e - s} min
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 500, opacity: 0.8, textAlign: 'center' }}>
                          Moving "{title}"
                        </span>
                      </div>
                    );
                  })()}

                  {/* Empty Slot Mouse Capture */}
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="slot-capture"
                      style={{ top: i * 80, height: 80, position: 'absolute', left: 0, right: 0, zIndex: 1 }}
                      onMouseDown={(e) => handleMouseDown(e, dateStr, 'measure')}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      {/* Creation Flow Popover */}
      {popoverState && (
        <CreationPopover
          isOpen={!!popoverState}
          initialData={{
            dateString: popoverState.date,
            timeSlot: minsToHHMM(popoverState.startMins),
            endTimeSlot: minsToHHMM(popoverState.endMins),
            columnType: popoverState.columnType,
            x: popoverState.x,
            y: popoverState.y
          }}
          areas={areas}
          onClose={() => setPopoverState(null)}
          onSave={handleSaveNewEvent}
          onAreasChanged={loadData}
          timezone={timezone}
        />
      )}

      {/* Premium Reflections Slide Drawer */}
      <SlideDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setActiveDrawerEvent(null);
          setSelectedEventIds(new Set());
        }}
        event={activeDrawerEvent}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        onAreasChanged={loadData}
      />

      {/* Premium Daily Note Editor Overlay */}
      {editingLogDate && (
        <>
          <div className="modal-overlay" onClick={() => setEditingLogDate(null)} />
          <div className="modal-content glass-panel-strong" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Daily Log: {editingLogDate}</h3>
              <button 
                className="btn-close" 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}
                onClick={() => setEditingLogDate(null)}
              >
                ✕
              </button>
            </div>
            <textarea
              className="markdown-editor text-field textarea-field"
              style={{ minHeight: '120px', width: '100%', marginBottom: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
              value={editingLogText}
              onChange={(e) => setEditingLogText(e.target.value)}
              placeholder="Write daily notes, logs, or reflections here..."
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '6px 12px', fontSize: '0.85rem' }} 
                onClick={() => setEditingLogDate(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ padding: '6px 16px', fontSize: '0.85rem' }} 
                onClick={handleSaveDailyLog}
                disabled={isSavingLog}
              >
                {isSavingLog ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default CalendarGrid;
