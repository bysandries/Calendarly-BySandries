import React, { useState, useEffect } from 'react';
import { fetchDistractionNotesWithTasks, deleteDistractionNote } from '../utils/api';
import { DateTime } from 'luxon';

export default function DistractionNotesReflection() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchDistractionNotesWithTasks();
      setNotes(rows);
    } catch (err) {
      console.error('Failed to load distraction notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this distraction note?')) return;
    try {
      await deleteDistractionNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Group notes by date (YYYY-MM-DD)
  const grouped = notes.reduce((acc, note) => {
    const dateKey = note.created_at ? note.created_at.slice(0, 10) : 'Unknown';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(note);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <div className="dashboard-panel">
        <div className="panel-header">
          <h3 className="panel-title">Distraction Notes</h3>
        </div>
        <div className="no-analytics-data">Loading…</div>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="panel-header">
          <h3 className="panel-title">Distraction Notes</h3>
          <p className="panel-subtitle">Every thought you captured during focus sessions</p>
        </div>
        <div className="no-analytics-data">
          <span className="no-data-icon">📝</span>
          <span>No distraction notes yet. Jot down wandering thoughts during a Pomodoro!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Distraction Notes</h3>
          <p className="panel-subtitle">Every thought you captured during focus sessions</p>
        </div>
      </div>
      <div className="distraction-reflection-list">
        {sortedDates.map(dateKey => {
          const dateNotes = grouped[dateKey];
          const displayDate = DateTime.fromISO(dateKey).toFormat('EEEE, MMM d, yyyy');
          return (
            <div className="distraction-date-group" key={dateKey}>
              <div className="distraction-date-header">{displayDate}</div>
              <div className="distraction-date-items">
                {dateNotes.map(note => (
                  <div className="distraction-note-card" key={note.id}>
                    <div className="distraction-note-top">
                      <span className="distraction-note-task" title={note.task_title}>
                        {note.task_title || 'Untitled task'}
                      </span>
                      <span className="distraction-note-time">
                        {note.created_at
                          ? DateTime.fromISO(note.created_at).toFormat('h:mm a')
                          : ''}
                      </span>
                      <button
                        type="button"
                        className="distraction-note-delete"
                        onClick={() => handleDelete(note.id)}
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="distraction-note-content">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
