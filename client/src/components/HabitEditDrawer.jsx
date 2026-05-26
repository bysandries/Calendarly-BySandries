import { useEffect, useState } from 'react';
import AreaPicker from './AreaPicker';
import { fetchAreas, createHabit, updateHabit, deleteHabit } from '../utils/api';

const EMPTY = {
  name: '',
  area: '',
  description: '',
  color_hex: '',
  icon: '',
  sort_order: 0,
  is_archived: 0,
};

export default function HabitEditDrawer({ isOpen, habit, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(EMPTY);
  const [areas, setAreas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCreate = !habit?.id;

  useEffect(() => {
    if (!isOpen) return;
    fetchAreas().then(setAreas).catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setForm({
      name: habit?.name || '',
      area: habit?.area || '',
      description: habit?.description || '',
      color_hex: habit?.color_hex || '',
      icon: habit?.icon || '',
      sort_order: habit?.sort_order ?? 0,
      is_archived: habit?.is_archived ? 1 : 0,
    });
  }, [habit, isOpen]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        area: form.area || null,
        description: form.description || null,
        color_hex: form.color_hex || null,
        icon: form.icon || null,
        sort_order: Number(form.sort_order) || 0,
        is_archived: form.is_archived ? 1 : 0,
      };
      const saved = isCreate
        ? await createHabit(payload)
        : await updateHabit(habit.id, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save habit');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!habit?.id) return;
    if (!window.confirm(`Delete "${habit.name}" and all of its logged entries?`)) return;
    setSaving(true);
    try {
      await deleteHabit(habit.id);
      onDeleted(habit.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not delete habit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="habit-drawer-overlay" onClick={onClose}>
      <div className="habit-drawer" onClick={e => e.stopPropagation()}>
        <div className="habit-drawer-header">
          <h3>{isCreate ? 'New habit' : 'Edit habit'}</h3>
          <button type="button" className="habit-drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="habit-drawer-form">
          <div className="habit-form-row">
            <label>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Morning coffee"
              autoFocus
            />
          </div>

          <div className="habit-form-row">
            <label>Category</label>
            <AreaPicker
              value={form.area}
              areas={areas}
              onSelect={(id) => set('area', id)}
              onAreasChanged={async () => {
                const updated = await fetchAreas();
                setAreas(updated);
              }}
              placeholder="No category"
            />
          </div>

          <div className="habit-form-2col">
            <div className="habit-form-row">
              <label>Icon</label>
              <input
                type="text"
                value={form.icon}
                onChange={e => set('icon', e.target.value)}
                placeholder="☕ 🦷 🥗 …"
                maxLength={4}
              />
            </div>
            <div className="habit-form-row">
              <label>Color override</label>
              <input
                type="text"
                value={form.color_hex}
                onChange={e => set('color_hex', e.target.value)}
                placeholder="#3498DB (optional)"
              />
            </div>
          </div>

          <div className="habit-form-row">
            <label>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional context"
            />
          </div>

          <div className="habit-form-2col">
            <div className="habit-form-row">
              <label>Sort order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => set('sort_order', e.target.value)}
              />
            </div>
            {!isCreate && (
              <div className="habit-form-row">
                <label>
                  <input
                    type="checkbox"
                    checked={!!form.is_archived}
                    onChange={e => set('is_archived', e.target.checked ? 1 : 0)}
                  />
                  {' '}Archived
                </label>
              </div>
            )}
          </div>

          {error && <div className="habit-form-error">{error}</div>}

          <div className="habit-drawer-footer">
            {!isCreate && (
              <button
                type="button"
                className="habit-btn-danger"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <div className="habit-drawer-footer-spacer" />
            <button type="button" className="habit-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="habit-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (isCreate ? 'Create habit' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
