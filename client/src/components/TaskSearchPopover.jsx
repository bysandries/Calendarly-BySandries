import { useState, useEffect, useRef } from 'react';
import { createTask } from '../utils/api';

const ACTIONABLE_STATUSES = [
  '01 - Inbox',
  '02 - Next Step',
  '03 - In Progress',
  '04 - Waiting for Someone',
  '04 - Delegate It',
];

export default function TaskSearchPopover({
  tasks,
  selectedTask,
  onSelect,
  onCreate,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  const actionableTasks = tasks.filter(t => ACTIONABLE_STATUSES.includes(t.status));

  const filtered = search.trim()
    ? actionableTasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : actionableTasks;

  const hasSearch = search.trim().length > 0;
  const noExactMatch = hasSearch && filtered.length === 0;
  const totalOptions = filtered.length + (noExactMatch ? 1 : 0);

  useEffect(() => {
    if (filtered.length > 0) {
      setHighlightedIndex(0);
    } else if (noExactMatch) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [search]);

  useEffect(() => {
    if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
      const el = itemRefs.current[highlightedIndex];
      if (el && listRef.current) {
        const list = listRef.current;
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        const listScroll = list.scrollTop;
        const listHeight = list.clientHeight;
        if (elTop < listScroll) {
          list.scrollTop = elTop;
        } else if (elBottom > listScroll + listHeight) {
          list.scrollTop = elBottom - listHeight;
        }
      }
    }
  }, [highlightedIndex, filtered.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleSelect = (task) => {
    onSelect(task);
    setOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  };

  const handleCreate = async () => {
    const title = search.trim();
    if (!title) return;
    try {
      const task = await createTask({
        title,
        status: '01 - Inbox',
        project_id: null,
        priority: 0,
        estimated_minutes: 0,
      });
      onSelect(task);
      if (onCreate) onCreate(task);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
    setOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalOptions === 0) return;
      setHighlightedIndex(prev => {
        const next = prev + 1;
        return next >= totalOptions ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalOptions === 0) return;
      setHighlightedIndex(prev => {
        const next = prev - 1;
        return next < 0 ? totalOptions - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex]);
      } else if (noExactMatch && highlightedIndex === filtered.length) {
        handleCreate();
      } else if (noExactMatch && highlightedIndex < 0) {
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      setHighlightedIndex(-1);
    }
  };

  const getProjectLabel = (task) => {
    if (task.project_title) return task.project_title;
    if (task.project_id) return task.project_id;
    return 'No project';
  };

  return (
    <div className="task-search-popover" ref={containerRef}>
      {/* Always-visible search input */}
      <div className="task-search-input-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="task-search-icon">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          className="task-search-input-inline"
          placeholder={selectedTask ? "Search to change task…" : "Search or create a task…"}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {selectedTask && (
          <span className="task-search-current-badge" title="Current task">
            {selectedTask.title}
          </span>
        )}
      </div>

      {/* Dropdown list */}
      {open && (
        <div className="task-search-dropdown glass-panel">
          <div className="task-search-list" ref={listRef}>
            {filtered.length === 0 && !hasSearch && (
              <div className="task-search-empty">No actionable tasks</div>
            )}
            {filtered.length === 0 && hasSearch && !noExactMatch && (
              <div className="task-search-empty">No matches</div>
            )}
            {filtered.map((t, i) => {
              const isSelected = selectedTask && selectedTask.id === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  className={`task-search-item ${highlightedIndex === i ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(t)}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  <span className="task-search-item-title">{t.title}</span>
                  <span className="task-search-item-meta">{getProjectLabel(t)}</span>
                  {isSelected && (
                    <span className="task-search-item-check">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {noExactMatch && (
            <button
              className={`task-search-create ${highlightedIndex === filtered.length ? 'highlighted' : ''}`}
              onClick={handleCreate}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
            >
              Create task &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
