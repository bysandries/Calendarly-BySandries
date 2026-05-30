import { useState, useEffect, useCallback } from 'react';
import {
  fetchTherapyEntries, fetchTherapyEntry,
  createTherapyEntry, updateTherapyEntry, deleteTherapyEntry,
  fetchTherapyPatterns, createTherapyPattern, updateTherapyPattern,
  linkEntryPattern, unlinkEntryPattern,
  fetchTherapyGoals, createTherapyGoal, updateTherapyGoal, reorderTherapyGoals,
  updateTherapyQuestion,
} from '../utils/api/therapyJournal';

export function useTherapyJournal() {
  const [entries, setEntries]   = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [goals, setGoals]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, p, g] = await Promise.all([
        fetchTherapyEntries(),
        fetchTherapyPatterns(),
        fetchTherapyGoals(),
      ]);
      setEntries(e);
      setPatterns(p);
      setGoals(g);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Entries ──────────────────────────────────────────────────────────────────

  const createEntry = useCallback(async (data) => {
    const entry = await createTherapyEntry(data);
    setEntries(prev => [entry, ...prev]);
    if (data.goals?.length) await load(); // refresh goals list
    if (data.patterns?.some(p => !p.id)) await load(); // refresh patterns if new ones were created
    return entry;
  }, [load]);

  const updateEntry = useCallback(async (id, data) => {
    const entry = await updateTherapyEntry(id, data);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...entry } : e));
    return entry;
  }, []);

  const removeEntry = useCallback(async (id) => {
    await deleteTherapyEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  // ── Patterns ─────────────────────────────────────────────────────────────────

  const addPattern = useCallback(async (data) => {
    const pattern = await createTherapyPattern(data);
    setPatterns(prev => [...prev, { ...pattern, occurrence_count: 0 }]);
    return pattern;
  }, []);

  const editPattern = useCallback(async (id, data) => {
    const pattern = await updateTherapyPattern(id, data);
    setPatterns(prev => prev.map(p => p.id === id ? { ...p, ...pattern } : p));
    return pattern;
  }, []);

  const linkPattern = useCallback(async (entryId, data) => {
    await linkEntryPattern(entryId, data);
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, pattern_count: (e.pattern_count || 0) + 1 } : e
    ));
    setPatterns(prev => prev.map(p =>
      p.id === data.pattern_id ? { ...p, occurrence_count: (p.occurrence_count || 0) + 1 } : p
    ));
  }, []);

  const unlinkPattern = useCallback(async (entryId, patternId) => {
    await unlinkEntryPattern(entryId, patternId);
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, pattern_count: Math.max(0, (e.pattern_count || 0) - 1) } : e
    ));
    setPatterns(prev => prev.map(p =>
      p.id === patternId ? { ...p, occurrence_count: Math.max(0, (p.occurrence_count || 0) - 1) } : p
    ));
  }, []);

  // ── Goals ────────────────────────────────────────────────────────────────────

  const addGoal = useCallback(async (data) => {
    const goal = await createTherapyGoal(data);
    setGoals(prev => [...prev, goal].sort((a, b) => a.priority - b.priority));
    return goal;
  }, []);

  const editGoal = useCallback(async (id, data) => {
    const goal = await updateTherapyGoal(id, data);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...goal } : g));
    return goal;
  }, []);

  const reorderGoals = useCallback(async (order) => {
    setGoals(prev => {
      const map = Object.fromEntries(order.map(o => [o.id, o.priority]));
      return [...prev].map(g => ({ ...g, priority: map[g.id] ?? g.priority }))
        .sort((a, b) => a.priority - b.priority);
    });
    await reorderTherapyGoals(order);
  }, []);

  // ── Questions ────────────────────────────────────────────────────────────────

  const answerQuestion = useCallback(async (id, data) => {
    const q = await updateTherapyQuestion(id, data);
    setEntries(prev => prev.map(e => ({
      ...e,
      open_question_count: e.questions
        ? e.questions.filter(q2 => !q2.answered && q2.id !== id).length
        : e.open_question_count,
    })));
    return q;
  }, []);

  return {
    entries, patterns, goals, loading, error,
    createEntry, updateEntry, removeEntry,
    addPattern, editPattern, linkPattern, unlinkPattern,
    addGoal, editGoal, reorderGoals,
    answerQuestion,
    refetch: load,
  };
}
