const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function newId() {
  return `habit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

// GET /api/habits
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const conditions = [];
    const params = [];

    if (req.query.area) {
      conditions.push('area = ?');
      params.push(req.query.area);
    }
    if (req.query.include_archived !== 'true') {
      conditions.push('is_archived = 0');
    }

    let query = 'SELECT * FROM habits';
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sort_order ASC, name COLLATE NOCASE';

    const habits = await db.all(query, params);
    res.json(habits);
  } catch (error) {
    console.error('Error fetching habits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/habits/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const habit = await db.get('SELECT * FROM habits WHERE id = ?', [req.params.id]);
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    res.json(habit);
  } catch (error) {
    console.error('Error fetching habit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/habits
router.post('/', async (req, res) => {
  const { name, area, description, color_hex, icon, sort_order } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (color_hex && !HEX_RE.test(color_hex)) {
    return res.status(400).json({ error: 'color_hex must be a 6-digit hex like #RRGGBB' });
  }

  const id = newId();
  const createdAt = new Date().toISOString();

  try {
    const db = await getDbConnection();
    await db.run(
      `INSERT INTO habits (id, name, area, description, color_hex, icon, sort_order, is_archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        name.trim(),
        area || null,
        description || null,
        color_hex || null,
        icon || null,
        Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
        createdAt,
      ]
    );
    const habit = await db.get('SELECT * FROM habits WHERE id = ?', [id]);
    res.status(201).json(habit);
  } catch (error) {
    console.error('Error creating habit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/habits/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (updates.color_hex && !HEX_RE.test(updates.color_hex)) {
    return res.status(400).json({ error: 'color_hex must be a 6-digit hex like #RRGGBB' });
  }
  if (updates.name !== undefined && !String(updates.name).trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM habits WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Habit not found' });

    const merged = { ...existing, ...updates };
    await db.run(
      `UPDATE habits
       SET name = ?, area = ?, description = ?, color_hex = ?, icon = ?, sort_order = ?, is_archived = ?
       WHERE id = ?`,
      [
        String(merged.name).trim(),
        merged.area || null,
        merged.description || null,
        merged.color_hex || null,
        merged.icon || null,
        Number(merged.sort_order) || 0,
        merged.is_archived ? 1 : 0,
        id,
      ]
    );
    const habit = await db.get('SELECT * FROM habits WHERE id = ?', [id]);
    res.json(habit);
  } catch (error) {
    console.error('Error updating habit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/habits/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM habits WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Habit not found' });
    res.json({ message: 'Habit deleted successfully' });
  } catch (error) {
    console.error('Error deleting habit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
