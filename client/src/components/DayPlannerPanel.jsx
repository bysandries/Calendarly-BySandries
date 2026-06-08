import { useState, useEffect, useRef, useCallback } from 'react';
import { DateTime } from 'luxon';
import { api } from '../utils/api/core';
import { markdownToHtml, htmlToMarkdown } from '../utils/mdEditor';
import useRichTextEditor from '../hooks/useRichTextEditor';
import RichTextToolbar from './RichTextToolbar';
import './DayPlannerPanel.css';

const DayPlannerPanel = ({ isOpen, onToggle }) => {
  const [saveStatus, setSaveStatus] = useState('idle');
  const [currentDate, setCurrentDate] = useState(() => DateTime.now().startOf('day'));

  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const loadedDateRef = useRef(null);

  const dateId = currentDate.toFormat('yyyy-MM-dd');

  const saveNote = useCallback((html, dId) => {
    setSaveStatus('saving');
    const note = htmlToMarkdown(html);
    api.post('/daily-logs', { date_id: dId, note })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('idle'));
  }, []);

  const triggerSave = useCallback(() => {
    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (editorRef.current) saveNote(editorRef.current.innerHTML, dateId);
    }, 800);
  }, [saveNote, dateId]);

  const handleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (editorRef.current) saveNote(editorRef.current.innerHTML, dateId);
  };

  const rte = useRichTextEditor(editorRef, { onInput: triggerSave });

  const handlePrevDay = () => setCurrentDate(d => d.minus({ days: 1 }));
  const handleNextDay = () => setCurrentDate(d => d.plus({ days: 1 }));
  const handleToday = () => setCurrentDate(DateTime.now().startOf('day'));

  // Load note for current date
  useEffect(() => {
    if (!isOpen || !editorRef.current) return;
    loadedDateRef.current = dateId;
    setSaveStatus('idle');
    api.get('/daily-logs', { date: dateId })
      .then(rows => {
        if (loadedDateRef.current !== dateId) return;
        editorRef.current.innerHTML = markdownToHtml(rows[0]?.note || '');
      })
      .catch(() => {});
  }, [currentDate, isOpen]); // eslint-disable-line

  const isToday = currentDate.hasSame(DateTime.now(), 'day');

  return (
    <div className="day-planner-panel">
      <button type="button" className="day-planner-toggle" onClick={onToggle}
        title={isOpen ? 'Collapse Planner' : 'Open Day Planner'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isOpen ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
        </svg>
        {!isOpen && <span className="day-planner-toggle-label">Plan</span>}
      </button>

      {isOpen && (
        <div className="day-planner-content">

          {/* ── Header ── */}
          <div className="day-planner-header">
            <div className="day-planner-nav">
              <button className="day-planner-nav-btn" onClick={handlePrevDay} title="Previous day">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <button className={`day-planner-today-btn${isToday ? ' is-today' : ''}`} onClick={handleToday}>Today</button>
              <button className="day-planner-nav-btn" onClick={handleNextDay} title="Next day">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
            <div className="day-planner-header-row2">
              <div className="day-planner-date">{currentDate.toFormat('EEEE, LLL d, yyyy')}</div>
              <button type="button" className={`day-planner-save-btn${saveStatus === 'saved' ? ' saved' : ''}`} onClick={handleSave}>
                {saveStatus === 'saved' ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Saved</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save</>
                )}
              </button>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <RichTextToolbar rte={rte} />

          {/* ── Editor ── */}
          <div className="day-planner-body">
            <div
              ref={editorRef}
              className="day-planner-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={rte.handleEditorInput}
              onClick={rte.handleEditorClick}
              onKeyDown={rte.handleEditorKeyDown}
              data-placeholder="What's important today?"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DayPlannerPanel;
