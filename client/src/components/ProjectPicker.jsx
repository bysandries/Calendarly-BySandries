import { useState, useEffect, useRef } from 'react';

export default function ProjectPicker({ projects, onSelect, onCreate }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  const filtered = search.trim()
    ? projects.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const hasSearch = search.trim().length > 0;
  const noExactMatch = hasSearch && filtered.length === 0;
  const totalOptions = filtered.length + (noExactMatch ? 1 : 0);

  // Reset highlight when search changes
  useEffect(() => {
    if (filtered.length > 0) {
      setHighlightedIndex(0);
    } else if (noExactMatch) {
      // Highlight the create button
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [search]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Click outside to close
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

  // Scroll highlighted item into view
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

  const handleSelect = (projectId) => {
    onSelect(projectId);
    setOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  };

  const handleCreate = () => {
    const title = search.trim();
    if (!title) return;
    onCreate(title);
    setOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) return;

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
        handleSelect(filtered[highlightedIndex].id);
      } else if (noExactMatch && highlightedIndex === filtered.length) {
        handleCreate();
      } else if (noExactMatch && highlightedIndex < 0) {
        // Nothing highlighted but create button exists
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="project-picker" ref={containerRef}>
      <span
        className="link-project-trigger"
        onClick={() => setOpen(prev => !prev)}
      >
        Link Project
      </span>
      {open && (
        <div className="project-picker-dropdown">
          <input
            ref={inputRef}
            className="project-picker-search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="project-picker-list" ref={listRef}>
            {filtered.length === 0 && !hasSearch && (
              <div className="project-picker-empty">No projects</div>
            )}
            {filtered.length === 0 && hasSearch && (
              <div className="project-picker-empty">No projects found</div>
            )}
            {filtered.map((p, i) => (
              <button
                key={p.id}
                ref={(el) => { itemRefs.current[i] = el; }}
                className={`project-picker-item ${highlightedIndex === i ? 'highlighted' : ''}`}
                onClick={() => handleSelect(p.id)}
                onMouseEnter={() => setHighlightedIndex(i)}
              >
                {p.title}
              </button>
            ))}
          </div>
          {noExactMatch && (
            <button
              className={`project-picker-create ${highlightedIndex === filtered.length ? 'highlighted' : ''}`}
              onClick={handleCreate}
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
            >
              Create project &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
