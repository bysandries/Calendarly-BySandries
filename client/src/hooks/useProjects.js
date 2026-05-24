import { useState, useEffect, useCallback } from 'react';
import { fetchProjects, createProject as apiCreate, updateProject as apiUpdate, deleteProject as apiDelete } from '../utils/api';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { projects, loading, error, createProject, updateProject, deleteProject, refetch: loadProjects };
}
