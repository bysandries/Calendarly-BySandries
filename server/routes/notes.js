const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// GET /api/notes
// Supports query params: ?task_id=, ?type=, ?tags=
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    let query = 'SELECT n.*, t.title as task_title FROM notes n LEFT JOIN tasks t ON n.linked_task_id = t.id';
    const conditions = [];
    const params = [];

    if (req.query.task_id) {
      conditions.push('n.linked_task_id = ?');
      params.push(req.query.task_id);
    }
    if (req.query.type) {
      conditions.push('n.type = ?');
      params.push(req.query.type);
    }
    if (req.query.tags) {
      conditions.push('n.tags LIKE ?');
      params.push(`%${req.query.tags}%`);
    }
    if (req.query.search) {
      conditions.push('(n.title LIKE ? OR n.content LIKE ?)');
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY n.title ASC';

    const notes = await db.all(query, params);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notes/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const note = await db.get(
      'SELECT n.*, t.title as task_title FROM notes n LEFT JOIN tasks t ON n.linked_task_id = t.id WHERE n.id = ?',
      [req.params.id]
    );
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes
router.post('/', async (req, res) => {
  const { title, content, type, tags, linked_task_id } = req.body;

  const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  try {
    const db = await getDbConnection();
    await db.run(
      'INSERT INTO notes (id, title, content, type, tags, linked_task_id) VALUES (?, ?, ?, ?, ?, ?)',
      [noteId, title || null, content || null, type || null, tags || null, linked_task_id || null]
    );

    const note = await db.get(
      'SELECT n.*, t.title as task_title FROM notes n LEFT JOIN tasks t ON n.linked_task_id = t.id WHERE n.id = ?',
      [noteId]
    );
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return res.status(400).json({ error: 'Invalid linked_task_id reference' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/notes/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM notes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const merged = { ...existing, ...updates };
    await db.run(
      'UPDATE notes SET title = ?, content = ?, type = ?, tags = ?, linked_task_id = ? WHERE id = ?',
      [merged.title, merged.content, merged.type, merged.tags, merged.linked_task_id || null, id]
    );

    const updated = await db.get(
      'SELECT n.*, t.title as task_title FROM notes n LEFT JOIN tasks t ON n.linked_task_id = t.id WHERE n.id = ?',
      [id]
    );
    res.json(updated);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM notes WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
