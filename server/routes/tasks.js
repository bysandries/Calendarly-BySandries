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

// POST /api/tasks
// Creates a new task (GTD capture or Kanban card)
router.post('/', async (req, res) => {
  const { title, status, project_id, date_due, priority, notes, estimated_minutes, is_starred, person_id } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const finalStatus = status || 'inbox'; // default to GTD Inbox
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

    await db.run(
      `INSERT INTO tasks (id, title, status, project_id, date_due, priority, notes, estimated_minutes, received_date, finished_date, is_starred, person_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        title,
        finalStatus,
        project_id || null,
        date_due || null,
        priority || 0,
        notes || '',
        Number.isFinite(Number(estimated_minutes)) ? Number(estimated_minutes) : 0,
        receivedDate,
        finishedDate,
        is_starred ? 1 : 0,
        finalPersonId || null
      ]
    );

    const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
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
// Partially updates a task (e.g. changing status, priority, project_id)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const db = await getDbConnection();
    
    // Check if task exists
    const existingTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const merged = { ...existingTask, ...updates };

    // Auto-manage finished_date on status transitions to/from Done
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
        merged.title,
        merged.status,
        merged.project_id || null,
        merged.date_due || null,
        merged.priority,
        merged.notes,
        estimatedMinutes,
        merged.received_date || null,
        merged.finished_date || null,
        merged.is_starred ? 1 : 0,
        merged.person_id || null,
        id
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

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
