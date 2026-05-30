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
    const project = await apiCreate(data);
    setProjects(prev => [...prev, project]);
    return project;
  };

  const updateProject = async (id, data) => {
    const updated = await apiUpdate(id, data);
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  };

  const deleteProject = async (id) => {
    const result = await apiDelete(id);
    if (result.action === 'archived') {
      // Update status in place so the list re-renders correctly
      setProjects(prev => prev.map(p => p.id === id ? result.project : p));
    } else {
      // Permanently removed from deleted tables — remove from local state
      setProjects(prev => prev.filter(p => p.id !== id));
    }
    return result;
  };

  const refetch = (newFilters) => {
    if (newFilters) setFilters(newFilters);
    loadProjects(newFilters);
  };

  return { projects, loading, error, createProject, updateProject, deleteProject, refetch };
}
