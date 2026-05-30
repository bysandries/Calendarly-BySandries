const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

function now() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

function newId(prefix = 'goal') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

// GET /api/personal-goals
// Query: scope, status, context
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { scope, status, context } = req.query;
    let sql = 'SELECT * FROM personal_goals WHERE 1=1';
    const params = [];
    if (scope)   { sql += ' AND scope = ?';   params.push(scope);   }
    if (status)  { sql += ' AND status = ?';  params.push(status);  }
    if (context) { sql += ' AND context = ?'; params.push(context); }
    sql += ' ORDER BY creation_date DESC, created_at DESC';
    const rows = await db.all(sql, params);
    const goals = rows.map(g => ({
      ...g,
      archive_history: JSON.parse(g.archive_history || '[]'),
    }));
    res.json(goals);
  } catch (err) {
    console.error('GET /personal-goals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/personal-goals
router.post('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { title, scope = 'personal', context = 'personal_care', creation_date } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const id = newId();
    const ts = now();
    const creationDate = creation_date || new Date().toISOString().split('T')[0];
    await db.run(
      `INSERT INTO personal_goals (id, title, scope, context, creation_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      [id, title.trim(), scope, context, creationDate, ts, ts]
    );
    const goal = await db.get('SELECT * FROM personal_goals WHERE id = ?', [id]);
    res.status(201).json({ ...goal, archive_history: JSON.parse(goal.archive_history || '[]') });
  } catch (err) {
    console.error('POST /personal-goals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/personal-goals/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const goal = await db.get('SELECT * FROM personal_goals WHERE id = ?', [req.params.id]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const links = await db.all(
      'SELECT * FROM personal_goal_links WHERE goal_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({
      ...goal,
      archive_history: JSON.parse(goal.archive_history || '[]'),
      links,
    });
  } catch (err) {
    console.error('GET /personal-goals/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/personal-goals/:id
router.put('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const goal = await db.get('SELECT * FROM personal_goals WHERE id = ?', [req.params.id]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const { title, scope, context, creation_date, completion_date } = req.body;
    const ts = now();
    await db.run(
      `UPDATE personal_goals SET
        title = COALESCE(?, title),
        scope = COALESCE(?, scope),
        context = COALESCE(?, context),
        creation_date = COALESCE(?, creation_date),
        completion_date = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        title?.trim() || null,
        scope || null,
        context || null,
        creation_date || null,
        completion_date !== undefined ? completion_date : goal.completion_date,
        ts,
        req.params.id,
      ]
    );
    const updated = await db.get('SELECT * FROM personal_goals WHERE id = ?', [req.params.id]);
    res.json({ ...updated, archive_history: JSON.parse(updated.archive_history || '[]') });
  } catch (err) {
    console.error('PUT /personal-goals/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/personal-goals/:id/archive  — toggles archive/restore
router.post('/:id/archive', async (req, res) => {
  try {
    const db = await getDbConnection();
    const goal = await db.get('SELECT * FROM personal_goals WHERE id = ?', [req.params.id]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const ts = now();
    let newStatus, newArchivedAt, history;

    if (goal.status === 'archived') {
      newStatus     = 'active';
      newArchivedAt = goal.archived_at;
      history       = JSON.parse(goal.archive_history || '[]');
    } else {
      newStatus     = 'archived';
      newArchivedAt = ts;
      history       = [...JSON.parse(goal.archive_history || '[]'), ts];
    }

    await db.run(
      `UPDATE personal_goals SET status = ?, archived_at = ?, archive_history = ?, updated_at = ? WHERE id = ?`,
      [newStatus, newArchivedAt, JSON.stringify(history), ts, req.params.id]
    );
    const updated = await db.get('SELECT * FROM personal_goals WHERE id = ?', [req.params.id]);
    res.json({ ...updated, archive_history: JSON.parse(updated.archive_history || '[]') });
  } catch (err) {
    console.error('POST /personal-goals/:id/archive error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/personal-goals/:id/complete  — marks complete (or undo)
router.post('/:id/complete', async (req, res) => {
  try {
    const db = await getDbConnection();
    const goal = await db.get('SELECT * FROM personal_goals WHERE id = ?', [req.params.id]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const ts = now();
    const isCompleted = goal.status === 'completed';
    const newStatus  = isCompleted ? 'active' : 'completed';
    const compDate   = isCompleted ? null : new Date().toISOString().split('T')[0];

    await db.run(
      `UPDATE personal_goals SET status = ?, completion_date = ?, updated_at = ? WHERE id = ?`,
      [newStatus, compDate, ts, req.params.id]
    );
    const updated = await db.get('SELECT * FROM personal_goals WHERE id = ?', [req.params.id]);
    res.json({ ...updated, archive_history: JSON.parse(updated.archive_history || '[]') });
  } catch (err) {
    console.error('POST /personal-goals/:id/complete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/personal-goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const goal = await db.get('SELECT id FROM personal_goals WHERE id = ?', [req.params.id]);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    await db.run('DELETE FROM personal_goals WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /personal-goals/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/personal-goals/:id/links
router.get('/:id/links', async (req, res) => {
  try {
    const db = await getDbConnection();
    const links = await db.all(
      'SELECT * FROM personal_goal_links WHERE goal_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/personal-goals/:id/links
router.post('/:id/links', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { link_type, link_id, notes } = req.body;
    if (!link_type || !link_id) return res.status(400).json({ error: 'link_type and link_id are required' });
    const id = newId('glink');
    const ts = now();
    await db.run(
      'INSERT INTO personal_goal_links (id, goal_id, link_type, link_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.id, link_type, link_id, notes || null, ts]
    );
    const link = await db.get('SELECT * FROM personal_goal_links WHERE id = ?', [id]);
    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/personal-goals/:id/links/:linkId
router.delete('/:id/links/:linkId', async (req, res) => {
  try {
    const db = await getDbConnection();
    await db.run('DELETE FROM personal_goal_links WHERE id = ? AND goal_id = ?', [req.params.linkId, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
