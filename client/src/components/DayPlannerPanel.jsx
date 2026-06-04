import { useState, useEffect, useRef, useCallback } from 'react';
import { DateTime } from 'luxon';
import { api } from '../utils/api/core';
import './DayPlannerPanel.css';

const ToolbarBtn = ({ title, onClick, children }) => (
  <button
    type="button"
    className="dp-toolbar-btn"
    title={title}
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
  >
    {children}
  </button>
);

const DayPlannerPanel = ({ isOpen, onToggle }) => {
  const [saveStatus, setSaveStatus] = useState('idle');
  const [currentDate, setCurrentDate] = useState(() => DateTime.now().startOf('day'));
  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const loadedDateRef = useRef(null);

  const dateId = currentDate.toFormat('yyyy-MM-dd');

  useEffect(() => {
    if (!isOpen || !editorRef.current) return;
    loadedDateRef.current = dateId;
    setSaveStatus('idle');
    api.get('/daily-logs', { date: dateId })
      .then(rows => {
        if (loadedDateRef.current !== dateId) return;
        editorRef.current.innerHTML = rows[0]?.note || '';
      })
      .catch(() => {});
  }, [dateId, isOpen]);

  const saveNote = useCallback((html, dId) => {
    setSaveStatus('saving');
    api.post('/daily-logs', { date_id: dId, note: html })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('idle'));
  }, []);

  const handleInput = () => {
    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNote(editorRef.current.innerHTML, dateId);
    }, 800);
  };

  const handleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveNote(editorRef.current.innerHTML, dateId);
  };

  const fmt = (cmd) => {
    document.execCommand(cmd, false, null);
    editorRef.current?.focus();
  };

  const handlePrevDay = () => setCurrentDate(d => d.minus({ days: 1 }));
  const handleNextDay = () => setCurrentDate(d => d.plus({ days: 1 }));
  const handleToday = () => setCurrentDate(DateTime.now().startOf('day'));

  const isToday = currentDate.hasSame(DateTime.now(), 'day');
  const formattedDate = currentDate.toFormat('EEEE, LLL d, yyyy');

  return (
    <div className="day-planner-panel">
      {/* Toggle tab */}
      <button
        type="button"
        className="day-planner-toggle"
        onClick={onToggle}
        title={isOpen ? 'Collapse Planner' : 'Open Day Planner'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isOpen ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
        </svg>
        {!isOpen && <span className="day-planner-toggle-label">Plan</span>}
      </button>

      {isOpen && (
        <div className="day-planner-content">
          <div className="day-planner-header">
            <div className="day-planner-nav">
              <button className="day-planner-nav-btn" onClick={handlePrevDay} title="Previous day">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <button
                className={`day-planner-today-btn${isToday ? ' is-today' : ''}`}
                onClick={handleToday}
              >
                Today
              </button>
              <button className="day-planner-nav-btn" onClick={handleNextDay} title="Next day">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
            <div className="day-planner-header-row2">
              <div className="day-planner-date">{formattedDate}</div>
              <button
                type="button"
                className={`day-planner-save-btn${saveStatus === 'saved' ? ' saved' : ''}`}
                onClick={handleSave}
                title="Save note"
              >
                {saveStatus === 'saved' ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Saved
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="dp-toolbar">
            <div className="dp-toolbar-group">
              <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => fmt('bold')}><strong>B</strong></ToolbarBtn>
              <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => fmt('italic')}><em>I</em></ToolbarBtn>
              <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => fmt('underline')}>
                <span style={{ textDecoration: 'underline' }}>U</span>
              </ToolbarBtn>
            </div>
            <div className="dp-toolbar-divider" />
            <div className="dp-toolbar-group">
              <ToolbarBtn title="Bullet list" onClick={() => fmt('insertUnorderedList')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/>
                  <line x1="9" y1="18" x2="20" y2="18"/>
                  <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
              </ToolbarBtn>
              <ToolbarBtn title="Numbered list" onClick={() => fmt('insertOrderedList')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/>
                  <line x1="10" y1="18" x2="21" y2="18"/>
                  <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1.</text>
                  <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2.</text>
                  <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3.</text>
                </svg>
              </ToolbarBtn>
            </div>
            <div className="dp-toolbar-divider" />
            <div className="dp-toolbar-group">
              <ToolbarBtn title="Align left" onClick={() => fmt('justifyLeft')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/>
                  <line x1="3" y1="18" x2="18" y2="18"/>
                </svg>
              </ToolbarBtn>
              <ToolbarBtn title="Center" onClick={() => fmt('justifyCenter')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/>
                  <line x1="4" y1="18" x2="20" y2="18"/>
                </svg>
              </ToolbarBtn>
              <ToolbarBtn title="Align right" onClick={() => fmt('justifyRight')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/>
                  <line x1="6" y1="18" x2="21" y2="18"/>
                </svg>
              </ToolbarBtn>
              <ToolbarBtn title="Justify" onClick={() => fmt('justifyFull')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </ToolbarBtn>
            </div>
          </div>

          <div className="day-planner-body">
            <div
              ref={editorRef}
              className="day-planner-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              data-placeholder="What's important today? Tasks, reminders, intentions…"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DayPlannerPanel;
