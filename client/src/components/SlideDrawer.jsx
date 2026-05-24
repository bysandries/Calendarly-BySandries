import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchAreas, fetchTasks, fetchEventTasks, linkTaskToEvent, unlinkTaskFromEvent } from '../utils/api';
import { TASK_TABS } from '../utils/statusMap';
import AreaPicker from './AreaPicker';

const SlideDrawer = ({ isOpen, onClose, event, onSave, onDelete, onAreasChanged }) => {
  const [formData, setFormData] = useState({
    title: '',
    time_slot: '',
    duration_mins: 0,
    area: '',
    notes: ''
  });
  const [areas, setAreas] = useState([]);
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [taskSearch, setTaskSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showTaskSearch, setShowTaskSearch] = useState(false);

  // Get actionable statuses from TASK_TABS
  const actionableStatuses = TASK_TABS.find(tab => tab.key === 'actionable')?.statuses || [];

  useEffect(() => {
    fetchAreas().then(setAreas).catch(console.error);
    fetchTasks().then(setAvailableTasks).catch(console.error);
  }, []);

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        time_slot: event.time_slot || '',
        duration_mins: event.duration_mins || 0,
        area: event.area || 'general',
        notes: event.notes || ''
      });
      // If there are no notes yet, start in editing mode by default
      setIsEditing(!(event.notes && event.notes.trim().length > 0));

      // Fetch linked tasks
      fetchEventTasks(event.id).then(setLinkedTasks).catch(console.error);
    }
  }, [event]);

  // Global escape key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  const handleSave = () => {
    onSave(event.id, {
      ...event,
      ...formData,
      color_hex: colorHex
    });
    setIsEditing(false);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'duration_mins' ? parseInt(value, 10) : value
    }));
  };

  const handleLinkTask = async (taskId) => {
    try {
      await linkTaskToEvent(event.id, taskId);
      const updatedLinked = await fetchEventTasks(event.id);
      setLinkedTasks(updatedLinked);
      setTaskSearch('');
      setShowTaskSearch(false);
    } catch (err) {
      console.error('Failed to link task:', err);
    }
  };

  const handleUnlinkTask = async (taskId) => {
    try {
      await unlinkTaskFromEvent(event.id, taskId);
      setLinkedTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to unlink task:', err);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the event "${event.title}"?`)) {
      onDelete(event.id);
      onClose();
    }
  };

  // Only show tasks that are ACTIONABLE and NOT already linked
  const filteredAvailable = availableTasks.filter(t => {
    const isActionable = actionableStatuses.includes(t.status);
    const isNotLinked = !linkedTasks.some(lt => lt.id === t.id);
    const matchesSearch = taskSearch.trim() === '' || t.title.toLowerCase().includes(taskSearch.toLowerCase());
    return isActionable && isNotLinked && matchesSearch;
  });

  const selectedArea = areas.find(a => a.id === formData.area);
  const colorHex = selectedArea ? selectedArea.color_hex : event.color_hex;

  return (
    <div className={`slide-drawer-wrapper ${isOpen ? 'open' : ''}`}>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-content glass-panel">
        
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title-section" style={{ flex: 1 }}>
            <input
              className="inline-edit"
              name="title"
              value={formData.title}
              onChange={handleChange}
              style={{ fontSize: '1.25rem', fontWeight: 700, background: 'transparent', border: 'none', color: 'var(--text-primary)', width: '100%' }}
            />
          </div>
          <button className="btn-close-drawer" type="button" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          <div className="event-details-card glass-panel" style={{ borderColor: colorHex }}>
            <div className="detail-row">
              <span className="detail-label">Track:</span>
              <span className="detail-value text-uppercase">{event.column_type}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Category:</span>
              <AreaPicker
                value={formData.area}
                areas={areas}
                onSelect={(id) => setFormData(prev => ({ ...prev, area: id }))}
                onAreasChanged={async () => {
                  const updated = await fetchAreas();
                  setAreas(updated);
                  if (onAreasChanged) await onAreasChanged();
                }}
              />
            </div>

            <div className="detail-row">
              <span className="detail-label">Time Slot:</span>
              <input 
                type="time" 
                className="form-input" 
                name="time_slot" 
                value={formData.time_slot} 
                onChange={handleChange}
                style={{ width: 'auto', height: 'auto', padding: '2px 8px', fontSize: '0.8rem' }}
              />
            </div>

            <div className="detail-row">
              <span className="detail-label">Duration:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="number" 
                  className="form-input" 
                  name="duration_mins" 
                  value={formData.duration_mins} 
                  onChange={handleChange}
                  style={{ width: '60px', height: 'auto', padding: '2px 8px', fontSize: '0.8rem' }}
                />
                <span className="detail-value" style={{ fontSize: '0.8rem' }}>mins</span>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">Date:</span>
              <span className="detail-value">{event.date_string}</span>
            </div>
          </div>

          {/* Linked Tasks Section */}
          <div className="linked-tasks-container glass-panel" style={{ marginTop: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Linked Tasks</h4>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setShowTaskSearch(!showTaskSearch)}
              >
                {showTaskSearch ? 'Cancel' : '+ Link Task'}
              </button>
            </div>

            {showTaskSearch && (
              <div className="task-search-dropdown" style={{ marginBottom: '12px' }}>
                <input
                  className="form-input"
                  placeholder="Search actionable tasks..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  style={{ marginBottom: '8px' }}
                  autoFocus
                />
                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                  {filteredAvailable.length === 0 ? (
                    <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No actionable tasks found</div>
                  ) : (
                    filteredAvailable.map(task => (
                      <div 
                        key={task.id} 
                        className="picker-item"
                        onClick={() => handleLinkTask(task.id)}
                        style={{ 
                          padding: '8px 12px', 
                          cursor: 'pointer', 
                          fontSize: '0.85rem', 
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{task.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 300 }}>+</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="linked-tasks-list">
              {linkedTasks.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                  No tasks linked to this {event.column_type} block.
                </div>
              ) : (
                linkedTasks.map(task => (
                  <div key={task.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`status-dot ${task.status === '07 - Done' ? 'done' : ''}`} style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: task.status === '07 - Done' ? 'var(--accent-success)' : 'var(--accent-primary)' 
                      }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{task.title}</span>
                    </div>
                    <button 
                      className="btn-icon btn-sm" 
                      onClick={() => handleUnlinkTask(task.id)}
                      style={{ padding: '4px' }}
                    >
                      &times;
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="reflections-container" style={{ marginTop: '16px' }}>
            <div className="reflections-header">
              <h4>Reflections & Notes</h4>
              <button 
                type="button" 
                className="btn-toggle-view"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Preview' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <textarea
                className="markdown-editor text-field"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Write reflections, tags, or lessons learned here in Markdown..."
              />
            ) : (
              <div className="markdown-preview">
                {formData.notes && formData.notes.trim().length > 0 ? (
                  <ReactMarkdown>{formData.notes}</ReactMarkdown>
                ) : (
                  <p className="no-notes-placeholder">
                    *No reflections logged yet. Click Edit to add some!*
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <button 
            type="button" 
            className="btn btn-danger btn-delete" 
            onClick={handleDelete}
            style={{ marginRight: 'auto' }}
          >
            Delete Event
          </button>
          
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>

      </div>
    </div>
  );
};

export default SlideDrawer;
