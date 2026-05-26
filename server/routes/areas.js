const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function idFromName(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /api/areas
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const areas = await db.all('SELECT * FROM areas ORDER BY is_archived ASC, name COLLATE NOCASE');
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

  const finalId = (id ? idFromName(id) : idFromName(name));
  if (!finalId) {
    return res.status(400).json({ error: 'Could not derive a valid id from name' });
  }

  try {
    const db = await getDbConnection();

    // Prevent duplicate names (active or archived)
    const nameCollision = await db.get(
      'SELECT id, is_archived FROM areas WHERE LOWER(name) = LOWER(?)',
      [name.trim()]
    );
    if (nameCollision) {
      return res.status(409).json({
        error: `Category "${name.trim()}" already exists${nameCollision.is_archived ? ' (archived)' : ''}. Unarchive it or choose a different name.`
      });
    }

    const existing = await db.get('SELECT id FROM areas WHERE id = ?', [finalId]);
    if (existing) {
      return res.status(409).json({ error: `Area with id "${finalId}" already exists` });
    }

    await db.run(
      'INSERT INTO areas (id, name, color_hex, description, is_archived) VALUES (?, ?, ?, ?, 0)',
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
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color_hex, is_archived } = req.body;

  if (!name && !color_hex && is_archived === undefined) {
    return res.status(400).json({ error: 'At least one of name, color_hex, or is_archived is required' });
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

    let finalId = id;

    if (name) {
      const trimmedName = name.trim();

      // Prevent duplicate names (active or archived) excluding self
      const nameCollision = await db.get(
        'SELECT id, is_archived FROM areas WHERE LOWER(name) = LOWER(?) AND id != ?',
        [trimmedName, id]
      );
      if (nameCollision) {
        return res.status(409).json({
          error: `Category "${trimmedName}" already exists${nameCollision.is_archived ? ' (archived)' : ''}. Unarchive it or choose a different name.`
        });
      }

      const newId = idFromName(trimmedName);

      if (newId !== id) {
        const collision = await db.get('SELECT id FROM areas WHERE id = ?', [newId]);
        if (collision) {
          return res.status(409).json({ error: `Area with id "${newId}" already exists` });
        }

        // Migrate references and swap the row id
        await db.run(
          'INSERT INTO areas (id, name, color_hex, description, is_archived) VALUES (?, ?, ?, ?, ?)',
          [newId, trimmedName, existing.color_hex, existing.description || '', existing.is_archived || 0]
        );
        await db.run('UPDATE events SET area = ? WHERE area = ?', [newId, id]);
        await db.run('UPDATE projects SET area = ? WHERE area = ?', [newId, id]);
        await db.run('DELETE FROM areas WHERE id = ?', [id]);
        finalId = newId;
      } else {
        await db.run('UPDATE areas SET name = ? WHERE id = ?', [trimmedName, id]);
      }
    }

    if (color_hex) {
      await db.run('UPDATE areas SET color_hex = ? WHERE id = ?', [color_hex, finalId]);
      await db.run('UPDATE events SET color_hex = ? WHERE area = ?', [color_hex, finalId]);
    }

    if (is_archived !== undefined) {
      await db.run('UPDATE areas SET is_archived = ? WHERE id = ?', [is_archived ? 1 : 0, finalId]);
    }

    const area = await db.get('SELECT * FROM areas WHERE id = ?', [finalId]);
    res.json({ area });
  } catch (error) {
    console.error('Error updating area:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/areas/:id — soft delete (archive)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM areas WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Area not found' });
    }

    // Soft delete: mark as archived instead of hard deleting
    await db.run('UPDATE areas SET is_archived = 1 WHERE id = ?', [id]);
    res.json({ message: 'Area archived successfully' });
  } catch (error) {
    console.error('Error archiving area:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
