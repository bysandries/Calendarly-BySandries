import { useState, useEffect, useCallback } from 'react';
import { fetchTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, deleteTask as apiDeleteTask, fetchTrash as apiFetchTrash, restoreTask as apiRestoreTask, hardDeleteTask as apiHardDeleteTask, emptyTrash as apiEmptyTrash } from '../utils/api/tasks';

export function useTasks(initialFilters = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const loadTasks = useCallback(async (overrideFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTasks(overrideFilters || filters);
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const createTask = async (data) => {
    // Optimistic insert: show the task immediately, reconcile with the
    // server-authoritative record once the request resolves.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = { id: tempId, priority: 0, status: '01 - Inbox', ...data, _pending: true };
    setTasks(prev => [optimistic, ...prev]);
    try {
      const task = await apiCreateTask(data);
      setTasks(prev => prev.map(t => t.id === tempId ? task : t));
      return task;
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      throw err;
    }
  };

  const updateTask = async (id, data) => {
    // Optimistic update with rollback on failure.
    let snapshot;
    setTasks(prev => {
      snapshot = prev;
      return prev.map(t => t.id === id ? { ...t, ...data, _pending: true } : t);
    });
    try {
      const updated = await apiUpdateTask(id, data);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
    } catch (err) {
      setTasks(snapshot);
      throw err;
    }
  };

  const deleteTask = async (id) => {
    // Optimistic remove with rollback on failure.
    let snapshot;
    setTasks(prev => {
      snapshot = prev;
      return prev.filter(t => t.id !== id);
    });
    try {
      await apiDeleteTask(id);
    } catch (err) {
      setTasks(snapshot);
      throw err;
    }
  };

  const refetch = (newFilters) => {
    if (newFilters) setFilters(newFilters);
    loadTasks(newFilters);
  };

  const fetchTrash = async () => {
    const data = await apiFetchTrash();
    return data;
  };

  const restoreTask = async (id) => {
    const restored = await apiRestoreTask(id);
    return restored;
  };

  const hardDeleteTask = async (id) => {
    await apiHardDeleteTask(id);
  };

  const emptyTrash = async () => {
    await apiEmptyTrash();
  };

  return { tasks, loading, error, createTask, updateTask, deleteTask, refetch, filters, setFilters, fetchTrash, restoreTask, hardDeleteTask, emptyTrash };
}
