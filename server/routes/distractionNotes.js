const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// GET /api/distraction-notes
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    let query = 'SELECT * FROM distraction_notes';
    const params = [];
    const conditions = [];

    if (req.query.task_id) {
      conditions.push('task_id = ?');
      params.push(req.query.task_id);
    }
    if (req.query.session_id) {
      conditions.push('pomodoro_session_id = ?');
      params.push(req.query.session_id);
    }
    if (req.query.date_from) {
      conditions.push('created_at >= ?');
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      conditions.push('created_at <= ?');
      params.push(req.query.date_to);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    const notes = await db.all(query, params);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching distraction notes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/distraction-notes/with-tasks
// Returns distraction notes joined with task titles for the reflection dashboard
router.get('/with-tasks', async (req, res) => {
  try {
    const db = await getDbConnection();
    let query = `
      SELECT
        dn.id,
        dn.task_id,
        dn.pomodoro_session_id,
        dn.content,
        dn.created_at,
        t.title AS task_title,
        t.status AS task_status
      FROM distraction_notes dn
      LEFT JOIN tasks t ON dn.task_id = t.id
    `;
    const params = [];
    const conditions = [];

    if (req.query.date_from) {
      conditions.push('dn.created_at >= ?');
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      conditions.push('dn.created_at <= ?');
      params.push(req.query.date_to);
    }
    if (req.query.task_id) {
      conditions.push('dn.task_id = ?');
      params.push(req.query.task_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY dn.created_at DESC';
    const notes = await db.all(query, params);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching distraction notes with tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/distraction-notes
router.post('/', async (req, res) => {
  const { task_id, pomodoro_session_id, content, created_at } = req.body;

  if (!task_id || !content) {
    return res.status(400).json({ error: 'task_id and content are required' });
  }

  const noteId = `dist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const finalCreatedAt = created_at || new Date().toISOString();

  try {
    const db = await getDbConnection();
    await db.run(
      `INSERT INTO distraction_notes (id, task_id, pomodoro_session_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [noteId, task_id, pomodoro_session_id || null, content.trim(), finalCreatedAt]
    );
    const note = await db.get('SELECT * FROM distraction_notes WHERE id = ?', [noteId]);
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating distraction note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/distraction-notes/batch
router.post('/batch', async (req, res) => {
  const { task_id, pomodoro_session_id, entries } = req.body;

  if (!task_id || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'task_id and entries array are required' });
  }

  try {
    const db = await getDbConnection();
    const createdIds = [];

    await db.run('BEGIN TRANSACTION');
    try {
      for (const entry of entries) {
        if (!entry.content || !entry.content.trim()) continue;
        const noteId = `dist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const finalCreatedAt = entry.created_at || new Date().toISOString();
        await db.run(
          `INSERT INTO distraction_notes (id, task_id, pomodoro_session_id, content, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [noteId, task_id, pomodoro_session_id || null, entry.content.trim(), finalCreatedAt]
        );
        createdIds.push(noteId);
      }
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }

    const notes = await db.all(
      `SELECT * FROM distraction_notes WHERE id IN (${createdIds.map(() => '?').join(',')})`,
      createdIds
    );
    res.status(201).json(notes);
  } catch (error) {
    console.error('Error creating distraction notes batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/distraction-notes/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM distraction_notes WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Distraction note not found' });
    }
    res.json({ message: 'Distraction note deleted successfully' });
  } catch (error) {
    console.error('Error deleting distraction note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
