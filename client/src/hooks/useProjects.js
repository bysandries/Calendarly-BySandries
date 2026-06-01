import { useState, useEffect, useCallback } from 'react';
import { fetchProjects, createProject as apiCreate, updateProject as apiUpdate, deleteProject as apiDelete } from '../utils/api/projects';

export function useProjects(initialFilters = {}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const loadProjects = useCallback(async (overrideFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjects(overrideFilters || filters);
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = async (data) => {
    // Optimistic insert; reconcile with the server record on resolve.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setProjects(prev => [...prev, { id: tempId, ...data, _pending: true }]);
    try {
      const project = await apiCreate(data);
      setProjects(prev => prev.map(p => p.id === tempId ? project : p));
      return project;
    } catch (err) {
      setProjects(prev => prev.filter(p => p.id !== tempId));
      throw err;
    }
  };

  const updateProject = async (id, data) => {
    let snapshot;
    setProjects(prev => {
      snapshot = prev;
      return prev.map(p => p.id === id ? { ...p, ...data, _pending: true } : p);
    });
    try {
      const updated = await apiUpdate(id, data);
      setProjects(prev => prev.map(p => p.id === id ? updated : p));
      return updated;
    } catch (err) {
      setProjects(snapshot);
      throw err;
    }
  };

  const deleteProject = async (id) => {
    // Delete may archive (soft) or hard-delete; the server is authoritative, so
    // optimistically remove from the list and roll back / reconcile on response.
    let snapshot;
    setProjects(prev => {
      snapshot = prev;
      return prev.filter(p => p.id !== id);
    });
    try {
      const result = await apiDelete(id);
      if (result.action === 'archived') {
        // Re-insert with the archived status so filtered views render correctly.
        setProjects(prev => snapshot.map(p => p.id === id ? result.project : p));
      }
      return result;
    } catch (err) {
      setProjects(snapshot);
      throw err;
    }
  };

  const refetch = (newFilters) => {
    if (newFilters) setFilters(newFilters);
    loadProjects(newFilters);
  };

  return { projects, loading, error, createProject, updateProject, deleteProject, refetch };
}
