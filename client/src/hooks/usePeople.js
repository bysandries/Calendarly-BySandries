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

  const byName = (a, b) => a.name.localeCompare(b.name);

  const addPerson = async (name) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPeople(prev => [...prev, { id: tempId, name, _pending: true }].sort(byName));
    try {
      const person = await createPerson({ name });
      setPeople(prev => prev.map(p => p.id === tempId ? person : p).sort(byName));
      return person;
    } catch (err) {
      setPeople(prev => prev.filter(p => p.id !== tempId));
      throw err;
    }
  };

  const editPerson = async (id, name) => {
    let snapshot;
    setPeople(prev => {
      snapshot = prev;
      return prev.map(p => p.id === id ? { ...p, name, _pending: true } : p).sort(byName);
    });
    try {
      const updated = await updatePerson(id, { name });
      setPeople(prev => prev.map(p => p.id === id ? updated : p).sort(byName));
      return updated;
    } catch (err) {
      setPeople(snapshot);
      throw err;
    }
  };

  const removePerson = async (id) => {
    let snapshot;
    setPeople(prev => {
      snapshot = prev;
      return prev.filter(p => p.id !== id);
    });
    try {
      await deletePerson(id);
    } catch (err) {
      setPeople(snapshot);
      throw err;
    }
  };

  return { people, loading, error, addPerson, editPerson, removePerson, refetch: loadPeople };
}
