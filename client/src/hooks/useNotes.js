import { useState, useEffect, useCallback } from 'react';
import { fetchNotes, createNote as apiCreate, updateNote as apiUpdate, deleteNote as apiDelete } from '../utils/api/notes';

export function useNotes(initialFilters = {}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const loadNotes = useCallback(async (overrideFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotes(overrideFilters || filters);
      setNotes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const createNote = async (data) => {
    const note = await apiCreate(data);
    setNotes(prev => [note, ...prev]);
    return note;
  };

  const updateNote = async (id, data) => {
    const updated = await apiUpdate(id, data);
    setNotes(prev => prev.map(n => n.id === id ? updated : n));
    return updated;
  };

  const deleteNote = async (id) => {
    await apiDelete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const refetch = (newFilters) => {
    if (newFilters) setFilters(newFilters);
    loadNotes(newFilters);
  };

  return { notes, loading, error, createNote, updateNote, deleteNote, refetch, filters, setFilters };
}
