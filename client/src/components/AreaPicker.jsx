import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { createArea, updateArea, archiveArea, unarchiveArea } from '../utils/api';

const PALETTE = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71',
  '#1ABC9C', '#3498DB', '#9B59B6', '#FF6B9D',
  '#34495E', '#2C3E50', '#95A5A6', '#16A085'
];

export default function AreaPicker({ value, areas, onSelect, onAreasChanged, placeholder = 'Select category…', compact = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [editingAreaName, setEditingAreaName] = useState('');
  const [creatingName, setCreatingName] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const [dropdownPos, setDropdownPos] = useState(null);

  const DROPDOWN_WIDTH = 300;
  const DROPDOWN_MAX_HEIGHT = 420;
  const GAP = 6;

  const selectedArea = areas.find(a => a.id === value);

  const activeAreas = areas.filter(a => !a.is_archived);
  const archivedAreas = areas.filter(a => a.is_archived);

  const searchLower = search.trim().toLowerCase();
  const filteredActive = searchLower
    ? activeAreas.filter(a => a.name.toLowerCase().includes(searchLower))
    : activeAreas;
  const filteredArchived = searchLower
    ? archivedAreas.filter(a => a.name.toLowerCase().includes(searchLower))
    : archivedAreas;

  const allFiltered = [...filteredActive, ...filteredArchived];
  const hasSearch = search.trim().length > 0;
  const noExactMatch = hasSearch && !areas.some(a => a.name.toLowerCase() === searchLower);

  useEffect(() => {
    if (open && !creatingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, creatingName]);

  useEffect(() => {
    setHighlightedIndex(allFiltered.length > 0 ? 0 : -1);
    setEditingAreaId(null);
    setEditingAreaName('');
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e) {
      const inTrigger = containerRef.current && containerRef.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inTrigger && !inDropdown) {
        closePicker();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setDropdownPos(null);
      return;
    }
    function compute() {
      const trig = triggerRef.current;
      if (!trig) return;
      const rect = trig.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;
      const flipUp = spaceBelow < DROPDOWN_MAX_HEIGHT + GAP && spaceAbove > spaceBelow;
      const top = flipUp
        ? Math.max(8, rect.top - GAP - DROPDOWN_MAX_HEIGHT)
        : rect.bottom + GAP;
      let left = rect.left;
      if (left + DROPDOWN_WIDTH > vw - 8) left = Math.max(8, vw - DROPDOWN_WIDTH - 8);
      setDropdownPos({ top, left, flipUp });
    }
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  useEffect(() => {
    if (highlightedIndex >= 0 && highlightedIndex < allFiltered.length) {
      const el = itemRefs.current[highlightedIndex];
      const list = listRef.current;
      if (el && list) {
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        if (elTop < list.scrollTop) list.scrollTop = elTop;
        else if (elBottom > list.scrollTop + list.clientHeight) list.scrollTop = elBottom - list.clientHeight;
      }
    }
  }, [highlightedIndex, allFiltered.length]);

  function closePicker() {
    setOpen(false);
    setSearch('');
    setEditingAreaId(null);
    setEditingAreaName('');
    setCreatingName(null);
    setError('');
    setHighlightedIndex(-1);
  }

  function handleSelectExisting(id) {
    onSelect(id);
    closePicker();
  }

  function openEdit(area) {
    setEditingAreaId(area.id);
    setEditingAreaName(area.name);
    setError('');
  }

  function closeEdit() {
    setEditingAreaId(null);
    setEditingAreaName('');
    setError('');
  }

  async function handleSaveEdit(area) {
    const newName = editingAreaName.trim();
    if (!newName) {
      setError('Name cannot be empty');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {};
      if (newName !== area.name) payload.name = newName;
      if (Object.keys(payload).length > 0) {
        await updateArea(area.id, payload);
        if (onAreasChanged) await onAreasChanged();
      }
      closeEdit();
    } catch (e) {
      setError(e.message || 'Could not update category');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(area) {
    if (!window.confirm(`Archive category "${area.name}"? It will remain visible on existing events but cannot be selected for new ones.`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await archiveArea(area.id);
      if (onAreasChanged) await onAreasChanged();
      if (value === area.id) {
        // Keep the selection; the event still belongs to this archived category
      }
      closeEdit();
    } catch (e) {
      setError(e.message || 'Could not archive category');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnarchive(area) {
    setBusy(true);
    setError('');
    try {
      await unarchiveArea(area.id);
      if (onAreasChanged) await onAreasChanged();
    } catch (e) {
      setError(e.message || 'Could not unarchive category');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetColorForExisting(areaId, color) {
    setBusy(true);
    setError('');
    try {
      await updateArea(areaId, { color_hex: color });
      if (onAreasChanged) await onAreasChanged();
    } catch (e) {
      setError(e.message || 'Could not update color');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateWithColor(name, color) {
    setBusy(true);
    setError('');
    try {
      const newArea = await createArea({ name, color_hex: color });
      if (onAreasChanged) await onAreasChanged();
      onSelect(newArea.id);
      closePicker();
    } catch (e) {
      setError(e.message || 'Could not create category');
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (!open || creatingName) return;
    const total = allFiltered.length + (noExactMatch ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (total === 0) return;
      setHighlightedIndex(prev => (prev + 1 >= total ? 0 : prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (total === 0) return;
      setHighlightedIndex(prev => (prev - 1 < 0 ? total - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < allFiltered.length) {
        handleSelectExisting(allFiltered[highlightedIndex].id);
      } else if (noExactMatch) {
        setCreatingName(search.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePicker();
    }
  }

  function renderAreaItem(a, i) {
    const isEditing = editingAreaId === a.id;
    const isHighlighted = highlightedIndex === i;
    const isArchived = !!a.is_archived;

    return (
      <div
        key={a.id}
        ref={(el) => { itemRefs.current[i] = el; }}
        className={`area-picker-item ${isHighlighted ? 'highlighted' : ''} ${isEditing ? 'editing' : ''} ${isArchived ? 'archived' : ''}`}
      >
        <div className="area-picker-item-row">
          <button
            type="button"
            className="area-picker-item-main"
            onClick={() => !isEditing && handleSelectExisting(a.id)}
            onMouseEnter={() => setHighlightedIndex(i)}
          >
            <span className="area-picker-swatch" style={{ background: a.color_hex }} />
            <span className="area-picker-item-name">{a.name}</span>
            {isArchived && <span className="area-picker-archived-badge">Archived</span>}
          </button>
          {!isArchived && (
            <button
              type="button"
              className="area-picker-pencil"
              title={isEditing ? 'Close editor' : 'Edit category'}
              aria-label="Edit category"
              onClick={(e) => {
                e.stopPropagation();
                isEditing ? closeEdit() : openEdit(a);
              }}
            >
              ✎
            </button>
          )}
          {isArchived && (
            <button
              type="button"
              className="area-picker-unarchive-btn"
              title="Unarchive category"
              onClick={(e) => {
                e.stopPropagation();
                handleUnarchive(a);
              }}
            >
              ↩
            </button>
          )}
        </div>

        {isEditing && (
          <div className="area-picker-edit-panel">
            <input
              className="area-picker-name-input"
              value={editingAreaName}
              onChange={(e) => setEditingAreaName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(a); }
                if (e.key === 'Escape') { e.preventDefault(); closeEdit(); }
              }}
              placeholder="Category name"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <div className="area-picker-palette inline">
              {PALETTE.map(color => {
                const isCurrent = a.color_hex && a.color_hex.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    className={`area-picker-swatch-btn ${isCurrent ? 'current' : ''}`}
                    style={{ background: color }}
                    title={color}
                    disabled={busy}
                    onClick={() => handleSetColorForExisting(a.id, color)}
                  />
                );
              })}
            </div>
            <div className="area-picker-edit-actions">
              <button
                type="button"
                className="area-picker-edit-archive"
                onClick={(e) => { e.stopPropagation(); handleArchive(a); }}
                disabled={busy}
              >
                Archive
              </button>
              <button
                type="button"
                className="area-picker-edit-cancel"
                onClick={(e) => { e.stopPropagation(); closeEdit(); }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="area-picker-edit-save"
                onClick={(e) => { e.stopPropagation(); handleSaveEdit(a); }}
                disabled={busy}
              >
                Save name
              </button>
            </div>
            {error && <div className="area-picker-error">{error}</div>}
          </div>
        )}
      </div>
    );
  }

  const dropdown = open && dropdownPos ? (
    <div
      ref={dropdownRef}
      className="area-picker-dropdown glass-panel"
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: DROPDOWN_WIDTH,
        maxHeight: DROPDOWN_MAX_HEIGHT,
        zIndex: 1100
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {creatingName ? (
        <div className="area-picker-create-view">
          <div className="area-picker-create-header">
            <button
              type="button"
              className="area-picker-back"
              onClick={() => setCreatingName(null)}
              aria-label="Back"
            >
              ←
            </button>
            <span className="area-picker-create-label">
              New category: <strong>{creatingName}</strong>
            </span>
          </div>
          <div className="area-picker-palette">
            {PALETTE.map(color => (
              <button
                key={color}
                type="button"
                className="area-picker-swatch-btn"
                style={{ background: color }}
                title={color}
                disabled={busy}
                onClick={() => handleCreateWithColor(creatingName, color)}
              />
            ))}
          </div>
          {error && <div className="area-picker-error">{error}</div>}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            className="area-picker-search"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="area-picker-list" ref={listRef}>
            {allFiltered.length === 0 && !hasSearch && (
              <div className="area-picker-empty">No categories yet</div>
            )}
            {allFiltered.length === 0 && hasSearch && !noExactMatch && (
              <div className="area-picker-empty">No matches</div>
            )}

            {/* Active categories */}
            {filteredActive.length > 0 && (
              <>
                <div className="area-picker-section-label">Active</div>
                {filteredActive.map((a, i) => renderAreaItem(a, i))}
              </>
            )}

            {/* Archived categories */}
            {filteredArchived.length > 0 && (
              <>
                <div className="area-picker-section-label archived">Archived</div>
                {filteredArchived.map((a, i) => renderAreaItem(a, filteredActive.length + i))}
              </>
            )}
          </div>
          {noExactMatch && (
            <button
              type="button"
              className={`area-picker-create ${highlightedIndex === allFiltered.length ? 'highlighted' : ''}`}
              onClick={() => setCreatingName(search.trim())}
              onMouseEnter={() => setHighlightedIndex(allFiltered.length)}
            >
              + Create category &quot;{search.trim()}&quot;
            </button>
          )}
          {!editingAreaId && error && <div className="area-picker-error">{error}</div>}
        </>
      )}
    </div>
  ) : null;

  return (
    <div className={`area-picker ${compact ? 'compact' : ''}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`area-picker-trigger ${compact ? 'compact' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
      >
        {selectedArea ? (
          <>
            <span className="area-picker-swatch" style={{ background: selectedArea.color_hex }} />
            {!compact && <span className="area-picker-trigger-label">{selectedArea.name}</span>}
          </>
        ) : (
          !compact && <span className="area-picker-trigger-label muted">{placeholder}</span>
        )}
        {!compact && <span className="area-picker-chevron">▾</span>}
      </button>
      {dropdown && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
}
