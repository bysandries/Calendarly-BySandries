import { useState, useEffect, useCallback } from 'react';
import {
  fetchExtracts,
  createExtract as apiCreate,
  updateExtract as apiUpdate,
  deleteExtract as apiDelete,
  linkExtractResource as apiLink,
  unlinkExtractResource as apiUnlink,
} from '../utils/api/extracts';

export function useExtracts(initialFilters = {}) {
  const [extracts, setExtracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const loadExtracts = useCallback(async (overrideFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExtracts(overrideFilters || filters);
      setExtracts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadExtracts();
  }, [loadExtracts]);

  const createExtract = async (data) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setExtracts(prev => [{ id: tempId, resources: [], ...data, _pending: true }, ...prev]);
    try {
      const extract = await apiCreate(data);
      setExtracts(prev => prev.map(e => e.id === tempId ? extract : e));
      return extract;
    } catch (err) {
      setExtracts(prev => prev.filter(e => e.id !== tempId));
      throw err;
    }
  };

  const updateExtract = async (id, data) => {
    let snapshot;
    setExtracts(prev => {
      snapshot = prev;
      return prev.map(e => e.id === id ? { ...e, ...data, _pending: true } : e);
    });
    try {
      const updated = await apiUpdate(id, data);
      setExtracts(prev => prev.map(e => e.id === id ? updated : e));
      return updated;
    } catch (err) {
      setExtracts(snapshot);
      throw err;
    }
  };

  const deleteExtract = async (id) => {
    let snapshot;
    setExtracts(prev => {
      snapshot = prev;
      return prev.filter(e => e.id !== id);
    });
    try {
      await apiDelete(id);
    } catch (err) {
      setExtracts(snapshot);
      throw err;
    }
  };

  const linkResource = async (id, data) => {
    const result = await apiLink(id, data);
    setExtracts(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, resources: result.resources };
      }
      return e;
    }));
    return result;
  };

  const unlinkResource = async (id, data) => {
    const result = await apiUnlink(id, data);
    setExtracts(prev => prev.map(e => {
      if (e.id === id) {
        return { ...e, resources: result.resources };
      }
      return e;
    }));
    return result;
  };

  const refetch = (newFilters) => {
    if (newFilters) setFilters(newFilters);
    loadExtracts(newFilters);
  };

  return {
    extracts,
    loading,
    error,
    createExtract,
    updateExtract,
    deleteExtract,
    linkResource,
    unlinkResource,
    refetch,
    filters,
    setFilters,
  };
}
