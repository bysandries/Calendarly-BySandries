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
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotes(prev => [{ id: tempId, ...data, _pending: true }, ...prev]);
    try {
      const note = await apiCreate(data);
      setNotes(prev => prev.map(n => n.id === tempId ? note : n));
      return note;
    } catch (err) {
      setNotes(prev => prev.filter(n => n.id !== tempId));
      throw err;
    }
  };

  const updateNote = async (id, data) => {
    let snapshot;
    setNotes(prev => {
      snapshot = prev;
      return prev.map(n => n.id === id ? { ...n, ...data, _pending: true } : n);
    });
    try {
      const updated = await apiUpdate(id, data);
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      return updated;
    } catch (err) {
      setNotes(snapshot);
      throw err;
    }
  };

  const deleteNote = async (id) => {
    let snapshot;
    setNotes(prev => {
      snapshot = prev;
      return prev.filter(n => n.id !== id);
    });
    try {
      await apiDelete(id);
    } catch (err) {
      setNotes(snapshot);
      throw err;
    }
  };

  const refetch = (newFilters) => {
    if (newFilters) setFilters(newFilters);
    loadNotes(newFilters);
  };

  return { notes, loading, error, createNote, updateNote, deleteNote, refetch, filters, setFilters };
}
