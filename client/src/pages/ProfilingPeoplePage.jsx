import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchProfilingPeople,
  fetchProfilingCategories,
  createProfilingPerson,
  deleteProfilingPerson,
  downloadAttachmentUrl,
} from '../utils/api/profilingPeople';
import ProfilingCategoryPicker from '../components/ProfilingCategoryPicker';
import './ProfilingPeople.css';

function PersonCard({ person, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="pp-person-card glass-panel">
      <Link to={`/personal-care/people/${person.id}`} className="pp-card-link">
        <div className="pp-card-avatar">
          {person.avatar_file_id ? (
            <img src={downloadAttachmentUrl(person.avatar_file_id)} alt={person.name} />
          ) : (
            <span className="pp-card-initial">{person.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="pp-card-body">
          <h3 className="pp-card-name">{person.name}</h3>
          {person.category_name && (
            <span className="pp-card-badge" style={{ background: `${person.category_color}22`, color: person.category_color, borderColor: `${person.category_color}44` }}>
              {person.category_name}
            </span>
          )}
          <p className="pp-card-desc">{person.description || 'No description'}</p>
          {person.first_met_date && (
            <span className="pp-card-date">Met: {person.first_met_date}</span>
          )}
        </div>
      </Link>
      <button
        type="button"
        className="pp-card-delete"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirming) {
            onDelete(person.id);
          } else {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 3000);
          }
        }}
      >
        {confirming ? 'Sure?' : '×'}
      </button>
    </div>
  );
}

export default function ProfilingPeoplePage() {
  const [people, setPeople] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category_id: '', first_met_date: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([fetchProfilingPeople(), fetchProfilingCategories()]);
      setPeople(p);
      setCategories(c);
    } catch (e) { console.error('Failed to load profiling data:', e); }
    finally { setLoading(false); }
  }

  const filtered = people.filter(p => {
    const matchesCategory = !filterCategory || p.category_id === filterCategory;
    const matchesSearch = !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await createProfilingPerson({
        name: form.name.trim(),
        description: form.description.trim(),
        category_id: form.category_id || null,
        first_met_date: form.first_met_date || null,
      });
      setPeople(prev => [...prev, created]);
      setShowAdd(false);
      setForm({ name: '', description: '', category_id: '', first_met_date: '' });
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    try {
      await deleteProfilingPerson(id);
      setPeople(prev => prev.filter(p => p.id !== id));
    } catch (err) { alert(err.message); }
  }

  return (
    <>
      <div className="page-header">
        <h2 className="pd-page-title">
          <span className="pd-accent-dot" />
          People in My Life
        </h2>
        <p className="page-description">Track the people who have shaped your journey.</p>
      </div>

      <div className="pp-toolbar">
        <input
          type="text"
          className="pp-search"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <ProfilingCategoryPicker
          value={filterCategory}
          onSelect={setFilterCategory}
          onCategoriesChanged={loadData}
          compact={false}
        />
        {filterCategory && (
          <button type="button" className="btn btn-secondary" onClick={() => setFilterCategory('')}>
            Clear filter
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Person
        </button>
      </div>

      {showAdd && (
        <div className="glass-panel pp-add-panel">
          <h4>Add Person</h4>
          <form onSubmit={handleAdd} className="pp-add-form">
            <input
              placeholder="Name *"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
            <ProfilingCategoryPicker
              value={form.category_id}
              onSelect={id => setForm({ ...form, category_id: id })}
              onCategoriesChanged={loadData}
            />
            <input
              type="date"
              value={form.first_met_date}
              onChange={e => setForm({ ...form, first_met_date: e.target.value })}
            />
            <div className="pp-add-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="pp-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="pp-person-card glass-panel skeleton" style={{ height: '180px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="no-analytics-data" style={{ marginTop: '40px' }}>
          <span className="no-data-icon" style={{ fontSize: '32px' }}>👤</span>
          <span>{search || filterCategory ? 'No people match your filters.' : 'No people added yet. Add your first person above.'}</span>
        </div>
      ) : (
        <div className="pp-grid">
          {filtered.map(person => (
            <PersonCard key={person.id} person={person} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </>
  );
}
