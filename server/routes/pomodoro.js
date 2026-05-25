const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// GET /api/pomodoro-sessions
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    let query = 'SELECT * FROM pomodoro_sessions';
    const params = [];
    const conditions = [];

    if (req.query.task_id) {
      conditions.push('task_id = ?');
      params.push(req.query.task_id);
    }
    if (req.query.status) {
      conditions.push('status = ?');
      params.push(req.query.status);
    }
    if (req.query.date_from) {
      conditions.push('started_at >= ?');
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      conditions.push('started_at <= ?');
      params.push(req.query.date_to);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY started_at DESC';
    const sessions = await db.all(query, params);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching pomodoro sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/pomodoro-sessions/by-task
// Returns aggregated time per task: total minutes, session count, last session date
router.get('/by-task', async (req, res) => {
  try {
    const db = await getDbConnection();
    const rows = await db.all(`
      SELECT
        pst.task_id,
        t.title AS task_title,
        COALESCE(SUM(ps.actual_duration_minutes), 0) AS total_minutes,
        COUNT(ps.id) AS session_count,
        MAX(ps.started_at) AS last_session_at
      FROM pomodoro_session_tasks pst
      JOIN pomodoro_sessions ps ON pst.session_id = ps.id
      LEFT JOIN tasks t ON pst.task_id = t.id
      WHERE ps.status IN ('completed', 'abandoned')
      GROUP BY pst.task_id
      ORDER BY total_minutes DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error aggregating pomodoro sessions by task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/pomodoro-sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const session = await db.get('SELECT * FROM pomodoro_sessions WHERE id = ?', [req.params.id]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Error fetching pomodoro session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/pomodoro-sessions
router.post('/', async (req, res) => {
  const { task_id, planned_duration_minutes, break_duration_minutes, notes } = req.body;

  if (!task_id) {
    return res.status(400).json({ error: 'task_id is required' });
  }
  if (!planned_duration_minutes || planned_duration_minutes <= 0) {
    return res.status(400).json({ error: 'planned_duration_minutes must be > 0' });
  }

  const sessionId = `pomo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const startedAt = new Date().toISOString();

  try {
    const db = await getDbConnection();
    await db.run(
      `INSERT INTO pomodoro_sessions (id, task_id, started_at, planned_duration_minutes, break_duration_minutes, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        task_id,
        startedAt,
        planned_duration_minutes,
        break_duration_minutes || 5,
        'active',
        notes || ''
      ]
    );
    // Populate junction table
    await db.run(
      `INSERT INTO pomodoro_session_tasks (session_id, task_id) VALUES (?, ?)`,
      [sessionId, task_id]
    );
    const session = await db.get('SELECT * FROM pomodoro_sessions WHERE id = ?', [sessionId]);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating pomodoro session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/pomodoro-sessions/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM pomodoro_sessions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const merged = { ...existing, ...updates };

    // If completing or abandoning, compute actual_duration_minutes
    if ((merged.status === 'completed' || merged.status === 'abandoned') && !merged.actual_duration_minutes && existing.started_at) {
      const endedAt = merged.ended_at ? new Date(merged.ended_at) : new Date();
      const startedAt = new Date(existing.started_at);
      const diffMs = endedAt.getTime() - startedAt.getTime();
      // Don't exceed planned duration (pomodoro shouldn't run over planned time naturally,
      // but abandoned might run longer if user walked away)
      merged.actual_duration_minutes = Math.max(0, Math.round(diffMs / 60000));
    }

    await db.run(
      `UPDATE pomodoro_sessions
       SET task_id = ?, started_at = ?, ended_at = ?, planned_duration_minutes = ?,
           actual_duration_minutes = ?, break_duration_minutes = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        merged.task_id,
        merged.started_at,
        merged.ended_at || null,
        merged.planned_duration_minutes,
        merged.actual_duration_minutes || null,
        merged.break_duration_minutes || null,
        merged.status,
        merged.notes || '',
        id
      ]
    );

    // Sync junction table if task_id changed
    if (updates.task_id && updates.task_id !== existing.task_id) {
      await db.run(
        `UPDATE pomodoro_session_tasks SET task_id = ? WHERE session_id = ?`,
        [updates.task_id, id]
      );
    }

    const updated = await db.get('SELECT * FROM pomodoro_sessions WHERE id = ?', [id]);
    res.json(updated);
  } catch (error) {
    console.error('Error updating pomodoro session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/pomodoro-sessions/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM pomodoro_sessions WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting pomodoro session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
