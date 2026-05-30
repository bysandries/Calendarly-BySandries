import { useState, useEffect, useCallback } from 'react';
import { fetchPeople, createPerson, updatePerson, deletePerson } from '../utils/api/people';

export function usePeople() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPeople();
      setPeople(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const addPerson = async (name) => {
    const person = await createPerson({ name });
    setPeople(prev => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)));
    return person;
  };

  const editPerson = async (id, name) => {
    const updated = await updatePerson(id, { name });
    setPeople(prev => prev.map(p => p.id === id ? updated : p).sort((a, b) => a.name.localeCompare(b.name)));
    return updated;
  };

  const removePerson = async (id) => {
    await deletePerson(id);
    setPeople(prev => prev.filter(p => p.id !== id));
  };

  return { people, loading, error, addPerson, editPerson, removePerson, refetch: loadPeople };
}
