import { usePeople } from '../hooks/usePeople';

export default function PersonPicker({ value, onSelect, placeholder = 'Unassigned' }) {
  const { people, loading } = usePeople();

  if (loading) return <div className="skeleton" style={{ height: '38px', width: '100%' }} />;

  return (
    <select
      className="form-select"
      value={value || ''}
      onChange={(e) => onSelect(e.target.value || null)}
      style={{ padding: '4px 10px', fontSize: '0.85rem' }}
    >
      <option value="">{placeholder}</option>
      {people.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
