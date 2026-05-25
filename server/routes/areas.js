const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /api/areas
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const areas = await db.all('SELECT * FROM areas ORDER BY name COLLATE NOCASE');
    res.json(areas);
  } catch (error) {
    console.error('Error fetching areas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/areas
router.post('/', async (req, res) => {
  const { name, color_hex, description } = req.body;
  let { id } = req.body;

  if (!name || !color_hex) {
    return res.status(400).json({ error: 'name and color_hex are required' });
  }
  if (!HEX_RE.test(color_hex)) {
    return res.status(400).json({ error: 'color_hex must be a 6-digit hex like #RRGGBB' });
  }

  const finalId = (id ? slugify(id) : slugify(name));
  if (!finalId) {
    return res.status(400).json({ error: 'Could not derive a valid id from name' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT id FROM areas WHERE id = ?', [finalId]);
    if (existing) {
      return res.status(409).json({ error: `Area with id "${finalId}" already exists` });
    }

    await db.run(
      'INSERT INTO areas (id, name, color_hex, description) VALUES (?, ?, ?, ?)',
      [finalId, name.trim(), color_hex, description || '']
    );
    const area = await db.get('SELECT * FROM areas WHERE id = ?', [finalId]);
    res.status(201).json(area);
  } catch (error) {
    console.error('Error creating area:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/areas/:id
// Body: { name?, color_hex? } — at least one required.
// color_hex update cascades to all events using this area.
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color_hex } = req.body;

  if (!name && !color_hex) {
    return res.status(400).json({ error: 'At least one of name or color_hex is required' });
  }
  if (color_hex && !HEX_RE.test(color_hex)) {
    return res.status(400).json({ error: 'color_hex must be a 6-digit hex like #RRGGBB' });
  }
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM areas WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Area not found' });
    }

    if (name) {
      await db.run('UPDATE areas SET name = ? WHERE id = ?', [name.trim(), id]);
    }
    if (color_hex) {
      await db.run('UPDATE areas SET color_hex = ? WHERE id = ?', [color_hex, id]);
      await db.run('UPDATE events SET color_hex = ? WHERE area = ?', [color_hex, id]);
    }

    const area = await db.get('SELECT * FROM areas WHERE id = ?', [id]);
    res.json({ area });
  } catch (error) {
    console.error('Error updating area:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
