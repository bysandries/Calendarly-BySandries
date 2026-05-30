import { useState, useEffect, useCallback } from 'react';
import { fetchTasks, createTask as apiCreateTask, updateTask as apiUpdateTask, deleteTask as apiDeleteTask } from '../utils/api/tasks';

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
    const task = await apiCreateTask(data);
    setTasks(prev => [task, ...prev]);
    return task;
  };

  const updateTask = async (id, data) => {
    const updated = await apiUpdateTask(id, data);
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  const deleteTask = async (id) => {
    await apiDeleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const refetch = (newFilters) => {
    if (newFilters) setFilters(newFilters);
    loadTasks(newFilters);
  };

  return { tasks, loading, error, createTask, updateTask, deleteTask, refetch, filters, setFilters };
}
