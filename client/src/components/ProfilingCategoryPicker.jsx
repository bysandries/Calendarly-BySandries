import { useState, useEffect, useRef } from 'react';
import {
  fetchProfilingCategories,
  createProfilingCategory,
  updateProfilingCategory,
  archiveProfilingCategory,
} from '../utils/api/profilingPeople';

const PALETTE = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71',
  '#1ABC9C', '#3498DB', '#9B59B6', '#FF6B9D',
  '#34495E', '#2C3E50', '#95A5A6', '#16A085'
];

export default function ProfilingCategoryPicker({ value, onSelect, onCategoriesChanged, compact = false }) {
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  useEffect(() => { loadCategories(); }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  async function loadCategories() {
    try {
      const rows = await fetchProfilingCategories();
      setCategories(rows);
    } catch (e) { console.error('Failed to load categories:', e); }
  }

  const selected = categories.find(c => c.id === value);
  const active = categories.filter(c => !c.is_archived);
  const archived = categories.filter(c => c.is_archived);
  const searchLower = search.trim().toLowerCase();
  const filteredActive = searchLower ? active.filter(c => c.name.toLowerCase().includes(searchLower)) : active;
  const filteredArchived = searchLower ? archived.filter(c => c.name.toLowerCase().includes(searchLower)) : archived;
  const allFiltered = [...filteredActive, ...filteredArchived];
  const noExactMatch = search.trim() && !categories.some(c => c.name.toLowerCase() === searchLower);

  async function handleCreate(color) {
    if (!search.trim()) return;
    setBusy(true); setError('');
    try {
      await createProfilingCategory({ name: search.trim(), color_hex: color });
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
      setCreating(false); setSearch(''); setOpen(false);
    } catch (e) { setError(e.message || 'Could not create category'); }
    finally { setBusy(false); }
  }

  async function handleArchive(cat) {
    if (!window.confirm(`Archive category "${cat.name}"?`)) return;
    setBusy(true); setError('');
    try {
      await archiveProfilingCategory(cat.id);
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (e) { setError(e.message || 'Could not archive'); }
    finally { setBusy(false); }
  }

  async function handleSetColor(cat, color) {
    setBusy(true); setError('');
    try {
      await updateProfilingCategory(cat.id, { color_hex: color });
      await loadCategories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (e) { setError(e.message || 'Could not update color'); }
    finally { setBusy(false); }
  }

  return (
    <div className={`area-picker ${compact ? 'compact' : ''}`} ref={containerRef}>
      <button
        type="button"
        className={`area-picker-trigger ${compact ? 'compact' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {selected ? (
          <>
            <span className="area-picker-swatch" style={{ background: selected.color_hex }} />
            {!compact && <span className="area-picker-trigger-label">{selected.name}</span>}
          </>
        ) : (
          !compact && <span className="area-picker-trigger-label muted">Select category…</span>
        )}
        {!compact && <span className="area-picker-chevron">▾</span>}
      </button>

      {open && (
        <div className="area-picker-dropdown glass-panel" style={{ position: 'absolute', zIndex: 1100, width: 280, maxHeight: 400 }}>
          {creating ? (
            <div style={{ padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <button type="button" onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '16px' }}>←</button>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>New category: <strong style={{ color: 'var(--text-primary)' }}>{search.trim()}</strong></span>
              </div>
              <div className="area-picker-palette">
                {PALETTE.map(color => (
                  <button
                    key={color}
                    type="button"
                    className="area-picker-swatch-btn"
                    style={{ background: color }}
                    disabled={busy}
                    onClick={() => handleCreate(color)}
                  />
                ))}
              </div>
              {error && <div className="area-picker-error">{error}</div>}
            </div>
          ) : (
            <>
              <input
                className="area-picker-search"
                placeholder="Search categories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setOpen(false);
                  if (e.key === 'Enter' && noExactMatch) setCreating(true);
                }}
              />
              <div className="area-picker-list">
                {allFiltered.length === 0 && !noExactMatch && (
                  <div className="area-picker-empty">No categories</div>
                )}
                {filteredActive.length > 0 && (
                  <>
                    <div className="area-picker-section-label">Active</div>
                    {filteredActive.map(cat => (
                      <div key={cat.id} className="area-picker-item">
                        <div className="area-picker-item-row">
                          <button type="button" className="area-picker-item-main" onClick={() => { onSelect(cat.id); setOpen(false); }}>
                            <span className="area-picker-swatch" style={{ background: cat.color_hex }} />
                            <span className="area-picker-item-name">{cat.name}</span>
                          </button>
                          <button
                            type="button"
                            className="area-picker-pencil"
                            title="Archive"
                            onClick={(e) => { e.stopPropagation(); handleArchive(cat); }}
                          >
                            ⊠
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {filteredArchived.length > 0 && (
                  <>
                    <div className="area-picker-section-label archived">Archived</div>
                    {filteredArchived.map(cat => (
                      <div key={cat.id} className="area-picker-item archived">
                        <div className="area-picker-item-row">
                          <button type="button" className="area-picker-item-main" onClick={() => { onSelect(cat.id); setOpen(false); }}>
                            <span className="area-picker-swatch" style={{ background: cat.color_hex, opacity: 0.5 }} />
                            <span className="area-picker-item-name">{cat.name}</span>
                            <span className="area-picker-archived-badge">Archived</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              {noExactMatch && (
                <button type="button" className="area-picker-create" onClick={() => setCreating(true)}>
                  + Create category &quot;{search.trim()}&quot;
                </button>
              )}
              {error && <div className="area-picker-error">{error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
