import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePeople } from '../hooks/usePeople';

export default function TeamPage() {
  const { people, loading, error, addPerson, editPerson, removePerson } = usePeople();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addPerson(newName);
      setNewName('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartEdit = (person) => {
    setEditingId(person.id);
    setEditName(person.name);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await editPerson(editingId, editName);
      setEditingId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this person? This will unassign them from all tasks and projects.')) {
      try {
        await removePerson(id);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="team-page">
      <div className="page-header">
        <h2>Team Management</h2>
        <p className="page-description">Add and manage people who can be assigned to tasks and projects.</p>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Add New Person</label>
            <input
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full Name"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
            Add Person
          </button>
        </form>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '24px' }}>Loading people...</div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--accent-danger)' }}>Error: {error}</div>
      ) : (
        <div className="glass-panel data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: '150px' }}>Created</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map(person => (
                <tr key={person.id}>
                  <td>
                    {editingId === person.id ? (
                      <input
                        className="form-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        onBlur={handleSaveEdit}
                      />
                    ) : (
                      <Link 
                        to={`/team/${person.id}`} 
                        style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}
                        className="hover-underline"
                      >
                        {person.name}
                      </Link>
                    )}
                  </td>
                  <td className="desktop-only-cell text-dimmed" style={{ fontSize: '0.8rem' }}>
                    {new Date(person.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-icon" onClick={() => handleStartEdit(person)} title="Edit Name">
                        ✎
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(person.id)} title="Delete Person">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No people added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
