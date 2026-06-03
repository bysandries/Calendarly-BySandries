const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    let query = 'SELECT * FROM tasks';
    const params = [];

    const conditions = [];

    if (req.query.project_id) {
      conditions.push('project_id = ?');
      params.push(req.query.project_id);
    }
    if (req.query.person_id) {
      conditions.push('person_id = ?');
      params.push(req.query.person_id);
    }
    if (req.query.status) {
      conditions.push('status = ?');
      params.push(req.query.status);
    }
    if (req.query.unassigned === 'true') {
      conditions.push('project_id IS NULL');
    }
    if (req.query.q) {
      conditions.push('LOWER(title) LIKE LOWER(?)');
      params.push(`%${req.query.q}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY priority DESC, date_due ASC';
    const tasks = await db.all(query, params);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/trash — list soft-deleted tasks
router.get('/trash', async (req, res) => {
  try {
    const db = await getDbConnection();
    const tasks = await db.all(
      'SELECT * FROM deleted_tasks ORDER BY deleted_at DESC'
    );
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching trash:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/trash/restore/:id — restore a task from trash
router.post('/trash/restore/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const deleted = await db.get('SELECT * FROM deleted_tasks WHERE id = ?', [id]);
    if (!deleted) return res.status(404).json({ error: 'Task not found in trash' });

    await db.run(
      `INSERT INTO tasks (id, title, status, project_id, date_due, priority, notes, estimated_minutes, received_date, finished_date, is_starred, person_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deleted.id, deleted.title, deleted.status, deleted.project_id,
        deleted.date_due, deleted.priority, deleted.notes, deleted.estimated_minutes,
        deleted.received_date, deleted.finished_date, deleted.is_starred, deleted.person_id
      ]
    );
    await db.run('DELETE FROM deleted_tasks WHERE id = ?', [id]);

    const restored = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(restored);
  } catch (error) {
    console.error('Error restoring task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/trash — permanently empty the entire trash
router.delete('/trash', async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM deleted_tasks');
    res.json({ message: `Trash emptied. ${result.changes} task(s) permanently deleted.` });
  } catch (error) {
    console.error('Error emptying trash:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/trash/:id — permanently delete a single trashed task
router.delete('/trash/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM deleted_tasks WHERE id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found in trash' });
    res.json({ message: 'Task permanently deleted.' });
  } catch (error) {
    console.error('Error hard-deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  const { title, status, project_id, date_due, priority, notes, estimated_minutes, is_starred, person_id } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const finalStatus = status || 'inbox';
  const receivedDate = new Date().toISOString();
  const finishedDate = finalStatus === '07 - Done' ? receivedDate : null;

  try {
    const db = await getDbConnection();

    let finalPersonId = person_id;
    if (!finalPersonId) {
      const defaultAssigneeSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['default_assignee']);
      if (defaultAssigneeSetting) {
        finalPersonId = defaultAssigneeSetting.value;
      }
    }

    const task = {
      id: taskId,
      title,
      status: finalStatus,
      project_id: project_id || null,
      date_due: date_due || null,
      priority: priority || 0,
      notes: notes || '',
      estimated_minutes: Number.isFinite(Number(estimated_minutes)) ? Number(estimated_minutes) : 0,
      received_date: receivedDate,
      finished_date: finishedDate,
      is_starred: is_starred ? 1 : 0,
      person_id: finalPersonId || null
    };

    await db.run(
      `INSERT INTO tasks (id, title, status, project_id, date_due, priority, notes, estimated_minutes, received_date, finished_date, is_starred, person_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id, task.title, task.status, task.project_id, task.date_due,
        task.priority, task.notes, task.estimated_minutes, task.received_date,
        task.finished_date, task.is_starred, task.person_id
      ]
    );

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return res.status(400).json({ error: 'Invalid project_id reference' });
    }
    if (error.message.includes('CHECK constraint failed')) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const db = await getDbConnection();

    const existingTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const merged = { ...existingTask, ...updates };

    const wasDone = existingTask.status === '07 - Done';
    const isDone = merged.status === '07 - Done';
    if (isDone && !wasDone) {
      merged.finished_date = new Date().toISOString();
    } else if (!isDone && wasDone) {
      merged.finished_date = null;
    }

    const estimatedMinutes = Number.isFinite(Number(merged.estimated_minutes))
      ? Number(merged.estimated_minutes)
      : 0;

    await db.run(
      `UPDATE tasks
       SET title = ?, status = ?, project_id = ?, date_due = ?, priority = ?, notes = ?,
           estimated_minutes = ?, received_date = ?, finished_date = ?, is_starred = ?, person_id = ?
       WHERE id = ?`,
      [
        merged.title, merged.status, merged.project_id || null,
        merged.date_due || null, merged.priority, merged.notes,
        estimatedMinutes, merged.received_date || null, merged.finished_date || null,
        merged.is_starred ? 1 : 0, merged.person_id || null, id
      ]
    );

    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return res.status(400).json({ error: 'Invalid project_id reference' });
    }
    if (error.message.includes('CHECK constraint failed')) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id — soft-delete (moves to deleted_tasks)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await db.run(
      `INSERT OR REPLACE INTO deleted_tasks
         (id, title, status, project_id, date_due, priority, notes, estimated_minutes,
          received_date, finished_date, is_starred, person_id, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id, task.title, task.status, task.project_id, task.date_due,
        task.priority, task.notes, task.estimated_minutes, task.received_date,
        task.finished_date, task.is_starred, task.person_id,
        new Date().toISOString()
      ]
    );
    await db.run('DELETE FROM tasks WHERE id = ?', [id]);

    res.json({ message: 'Task moved to trash.' });
  } catch (error) {
    console.error('Error soft-deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
