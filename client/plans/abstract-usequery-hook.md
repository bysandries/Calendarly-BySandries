# Plan: Abstract loading/error pattern into reusable `useQuery`

**Goal:** Eliminate the identical `useState`/`useCallback` triples across 5 hooks
by introducing a single `useQuery` primitive.

---

## Current duplication

```
useTasks (50 lines)    useTasks.js:4-21
useProjects (57 lines) useProjects.js:5-24
useNotes (50 lines)    useNotes.js:4-24
usePeople (44 lines)   usePeople.js:5-20
useExtracts (91 lines) useExtracts.js:12-28
```

Every hook above repeats this exact block:

```js
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

const load = useCallback(async (override) => {
  setLoading(true);
  setError(null);
  try {
    const result = await fetchFn(override || currentFilter);
    setData(result);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}, [currentFilter]);

useEffect(() => { load(); }, [load]);
```

That's 14 lines × 5 hooks = 70 lines of boilerplate that can become 1 line per hook.

---

## Step 1 — Create `hooks/useQuery.js`

```js
import { useState, useEffect, useCallback, useRef } from 'react';

export function useQuery(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const refetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRef.current(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}
```

Key design decisions:
- `fetchFn` is called via a ref so consumers don't need `useCallback` wrapping
- `deps` controls when `refetch` identity changes (for filter-based refetching)
- `setData` is exposed so hooks can optimistically update after mutations
- `refetch` returns the promise so callers can chain off it

---

## Step 2 — Refactor each hook

### 2a. `useTasks.js` — before → after

```js
import { useQuery } from './useQuery';
import { fetchTasks, createTask, updateTask, deleteTask } from '../utils/api/tasks';

export function useTasks(initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const { data: tasks = [], loading, error, refetch, setData: setTasks } = useQuery(
    (override) => fetchTasks(override || filters),
    [filters],
  );

  const create = async (data) => {
    const task = await createTask(data);
    setTasks(prev => [task, ...prev]);
    return task;
  };

  const update = async (id, data) => {
    const updated = await updateTask(id, data);
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  const remove = async (id) => {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return { tasks, loading, error, createTask: create, updateTask: update, deleteTask: remove, refetch, filters, setFilters };
}
```

Savings: 50 → 35 lines.

### 2b. `usePeople.js`

```js
import { useQuery } from './useQuery';
import { fetchPeople, createPerson, updatePerson, deletePerson } from '../utils/api/people';

export function usePeople() {
  const { data: people = [], loading, error, refetch: loadPeople, setData: setPeople } = useQuery(fetchPeople);

  const addPerson = async (name) => {
    const person = await createPerson({ name });
    setPeople(prev => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)));
    return person;
  };
  const editPerson = async (id, name) => {
    const updated = await updatePerson(id, { name });
    setPeople(prev => prev.map(p => p.id === id ? updated : p).sort((a, b) => a.name.localeCompare(b.name)));
    return updated;
  };
  const removePerson = async (id) => {
    await deletePerson(id);
    setPeople(prev => prev.filter(p => p.id !== id));
  };

  return { people, loading, error, addPerson, editPerson, removePerson, refetch: loadPeople };
}
```

Savings: 44 → 28 lines.

### 2c. `useProjects.js`

Notable: deleteProject has special archive-vs-delete logic. The `useQuery` refactor
preserves the custom mutation — only the fetch/loading/error pattern changes.

```js
import { useQuery } from './useQuery';
import { fetchProjects, createProject, updateProject, deleteProject } from '../utils/api/projects';

export function useProjects(initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const { data: projects = [], loading, error, refetch, setData: setProjects } = useQuery(
    (override) => fetchProjects(override || filters),
    [filters],
  );

  const create = async (data) => {
    const project = await createProject(data);
    setProjects(prev => [...prev, project]);
    return project;
  };
  const update = async (id, data) => {
    const updated = await updateProject(id, data);
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  };
  const remove = async (id) => {
    const result = await deleteProject(id);
    if (result.action === 'archived') {
      setProjects(prev => prev.map(p => p.id === id ? result.project : p));
    } else {
      setProjects(prev => prev.filter(p => p.id !== id));
    }
    return result;
  };

  return { projects, loading, error, createProject: create, updateProject: update, deleteProject: remove, refetch };
}
```

### 2d. `useNotes.js`

```js
import { useState } from 'react';
import { useQuery } from './useQuery';
import { fetchNotes, createNote, updateNote, deleteNote } from '../utils/api/notes';

export function useNotes(initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const { data: notes = [], loading, error, refetch, setData: setNotes } = useQuery(
    (override) => fetchNotes(override || filters),
    [filters],
  );

  const create = async (data) => {
    const note = await createNote(data);
    setNotes(prev => [note, ...prev]);
    return note;
  };
  const update = async (id, data) => {
    const updated = await updateNote(id, data);
    setNotes(prev => prev.map(n => n.id === id ? updated : n));
    return updated;
  };
  const remove = async (id) => {
    await deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  return { notes, loading, error, createNote: create, updateNote: update, deleteNote: remove, refetch, filters, setFilters };
}
```

### 2e. `useExtracts.js`

Notable: has `linkResource`/`unlinkResource` mutations that update nested `resources`
on the extract. Only the top `fetchExtracts` call moves into `useQuery`.

```js
import { useState } from 'react';
import { useQuery } from './useQuery';
import { fetchExtracts, createExtract, updateExtract, deleteExtract, linkExtractResource, unlinkExtractResource } from '../utils/api/extracts';

export function useExtracts(initialFilters = {}) {
  const [filters, setFilters] = useState(initialFilters);
  const { data: extracts = [], loading, error, refetch, setData: setExtracts } = useQuery(
    (override) => fetchExtracts(override || filters),
    [filters],
  );

  const create = async (data) => {
    const extract = await createExtract(data);
    setExtracts(prev => [extract, ...prev]);
    return extract;
  };
  const update = async (id, data) => {
    const updated = await updateExtract(id, data);
    setExtracts(prev => prev.map(e => e.id === id ? updated : e));
    return updated;
  };
  const remove = async (id) => {
    await deleteExtract(id);
    setExtracts(prev => prev.filter(e => e.id !== id));
  };
  const link = async (id, data) => {
    const result = await linkExtractResource(id, data);
    setExtracts(prev => prev.map(e => e.id === id ? { ...e, resources: result.resources } : e));
    return result;
  };
  const unlink = async (id, data) => {
    const result = await unlinkExtractResource(id, data);
    setExtracts(prev => prev.map(e => e.id === id ? { ...e, resources: result.resources } : e));
    return result;
  };

  return { extracts, loading, error, createExtract: create, updateExtract: update, deleteExtract: remove, linkResource: link, unlinkResource: unlink, refetch, filters, setFilters };
}
```

### 2f. Not touching `usePomodoro.js`

`usePomodoro` is a state machine (idle → running → paused → break-ready → break-running)
with timers, audio, localStorage persistence. It does not use the fetch/loading/error
triple pattern. No change needed.

---

## Step 3 — Verify

1. `cd client && npm run build` — no import errors
2. Run lint (`npx eslint src/hooks/`) — no dependency warnings
3. Check each page that consumes the refactored hooks still loads data:
   - `/tasks` → useTasks
   - `/projects` → useProjects
   - `/notes` → useNotes
   - `/team` → usePeople
   - `/gtd` (SlideDrawer) → useExtracts
4. Test CRUD operations on each entity (create, update, delete)

---

## Summary of savings

| Hook | Before | After | Saved |
|---|---|---|---|
| useTasks | 50 | 35 | 15 |
| usePeople | 44 | 28 | 16 |
| useProjects | 57 | 38 | 19 |
| useNotes | 50 | 35 | 15 |
| useExtracts | 91 | 70 | 21 |
| **Total** | **292** | **206** | **86 lines** |
