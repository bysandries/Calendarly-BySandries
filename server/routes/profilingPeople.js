const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { getDbConnection } = require('../db');
const router = express.Router();

// ── Helpers ─────────────────────────────────────────────────────────────────
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function idFromName(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── File Storage ────────────────────────────────────────────────────────────
const ATTACHMENTS_ROOT = path.resolve(__dirname, '..', 'attachments', 'people');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Multer Config ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const personId = req.params.id || req.params.personId;
    if (!personId) return cb(new Error('person_id required'));
    const dest = path.join(ATTACHMENTS_ROOT, personId);
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = path.basename(file.originalname).replace(/[\\/]/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
});

// ═══════════════════════════════════════════════════════════════════════════
//  CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/profiling-people/categories
router.get('/categories', async (_req, res) => {
  try {
    const db = await getDbConnection();
    const rows = await db.all(
      'SELECT * FROM profiling_people_categories ORDER BY is_archived ASC, name COLLATE NOCASE'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching profiling people categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profiling-people/categories
router.post('/categories', async (req, res) => {
  const { name, color_hex, description } = req.body;
  if (!name || !color_hex) {
    return res.status(400).json({ error: 'name and color_hex are required' });
  }
  if (!HEX_RE.test(color_hex)) {
    return res.status(400).json({ error: 'color_hex must be a 6-digit hex like #RRGGBB' });
  }

  const finalId = idFromName(name);
  if (!finalId) {
    return res.status(400).json({ error: 'Could not derive a valid id from name' });
  }

  try {
    const db = await getDbConnection();
    const nameCollision = await db.get(
      'SELECT id, is_archived FROM profiling_people_categories WHERE LOWER(name) = LOWER(?)',
      [name.trim()]
    );
    if (nameCollision) {
      return res.status(409).json({
        error: `Category "${name.trim()}" already exists${nameCollision.is_archived ? ' (archived)' : ''}.`,
      });
    }
    const existing = await db.get('SELECT id FROM profiling_people_categories WHERE id = ?', [finalId]);
    if (existing) {
      return res.status(409).json({ error: `Category with id "${finalId}" already exists` });
    }

    await db.run(
      'INSERT INTO profiling_people_categories (id, name, color_hex, description, is_archived) VALUES (?, ?, ?, ?, 0)',
      [finalId, name.trim(), color_hex, description || '']
    );
    const row = await db.get('SELECT * FROM profiling_people_categories WHERE id = ?', [finalId]);
    res.status(201).json(row);
  } catch (error) {
    console.error('Error creating profiling people category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/profiling-people/categories/:id
router.patch('/categories/:id', async (req, res) => {
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
    const existing = await db.get('SELECT * FROM profiling_people_categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    let finalId = id;

    if (name) {
      const trimmedName = name.trim();
      const nameCollision = await db.get(
        'SELECT id, is_archived FROM profiling_people_categories WHERE LOWER(name) = LOWER(?) AND id != ?',
        [trimmedName, id]
      );
      if (nameCollision) {
        return res.status(409).json({
          error: `Category "${trimmedName}" already exists${nameCollision.is_archived ? ' (archived)' : ''}.`,
        });
      }

      const newId = idFromName(trimmedName);
      if (newId !== id) {
        const collision = await db.get('SELECT id FROM profiling_people_categories WHERE id = ?', [newId]);
        if (collision) {
          return res.status(409).json({ error: `Category with id "${newId}" already exists` });
        }
        // Migrate references and swap row id
        await db.run(
          'INSERT INTO profiling_people_categories (id, name, color_hex, description, is_archived) VALUES (?, ?, ?, ?, ?)',
          [newId, trimmedName, existing.color_hex, existing.description || '', existing.is_archived || 0]
        );
        await db.run('UPDATE profiling_people SET category_id = ? WHERE category_id = ?', [newId, id]);
        await db.run('UPDATE profiling_people_category_history SET old_category_id = ? WHERE old_category_id = ?', [newId, id]);
        await db.run('UPDATE profiling_people_category_history SET new_category_id = ? WHERE new_category_id = ?', [newId, id]);
        await db.run('DELETE FROM profiling_people_categories WHERE id = ?', [id]);
        finalId = newId;
      } else {
        await db.run('UPDATE profiling_people_categories SET name = ? WHERE id = ?', [trimmedName, id]);
      }
    }

    if (color_hex) {
      await db.run('UPDATE profiling_people_categories SET color_hex = ? WHERE id = ?', [color_hex, finalId]);
    }
    if (is_archived !== undefined) {
      await db.run('UPDATE profiling_people_categories SET is_archived = ? WHERE id = ?', [is_archived ? 1 : 0, finalId]);
    }

    const row = await db.get('SELECT * FROM profiling_people_categories WHERE id = ?', [finalId]);
    res.json({ category: row });
  } catch (error) {
    console.error('Error updating profiling people category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/profiling-people/categories/:id (soft delete)
router.delete('/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM profiling_people_categories WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Category not found' });
    await db.run('UPDATE profiling_people_categories SET is_archived = 1 WHERE id = ?', [id]);
    res.json({ message: 'Category archived successfully' });
  } catch (error) {
    console.error('Error archiving profiling people category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  PEOPLE
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/profiling-people
router.get('/', async (req, res) => {
  const { category_id } = req.query;
  try {
    const db = await getDbConnection();
    let sql = `
      SELECT
        pp.id, pp.name, pp.description, pp.category_id, pp.first_met_date, pp.avatar_file_id, pp.created_at,
        ppc.name AS category_name, ppc.color_hex AS category_color
      FROM profiling_people pp
      LEFT JOIN profiling_people_categories ppc ON pp.category_id = ppc.id
    `;
    const params = [];
    if (category_id) {
      sql += ' WHERE pp.category_id = ?';
      params.push(category_id);
    }
    sql += ' ORDER BY pp.name COLLATE NOCASE';
    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching profiling people:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profiling-people/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const row = await db.get(
      `SELECT
        pp.id, pp.name, pp.description, pp.category_id, pp.first_met_date, pp.avatar_file_id, pp.created_at,
        ppc.name AS category_name, ppc.color_hex AS category_color
      FROM profiling_people pp
      LEFT JOIN profiling_people_categories ppc ON pp.category_id = ppc.id
      WHERE pp.id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Person not found' });
    res.json(row);
  } catch (error) {
    console.error('Error fetching profiling person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profiling-people
router.post('/', async (req, res) => {
  const { name, description, category_id, first_met_date } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const id = generateId('pp');
  try {
    const db = await getDbConnection();

    if (category_id) {
      const cat = await db.get('SELECT id FROM profiling_people_categories WHERE id = ?', [category_id]);
      if (!cat) return res.status(400).json({ error: 'Invalid category_id' });
    }

    await db.run(
      `INSERT INTO profiling_people (id, name, description, category_id, first_met_date, avatar_file_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), description || '', category_id || null, first_met_date || null, null, new Date().toISOString()]
    );

    // Log category history if provided
    if (category_id) {
      await db.run(
        'INSERT INTO profiling_people_category_history (id, person_id, old_category_id, new_category_id, changed_at) VALUES (?, ?, ?, ?, ?)',
        [generateId('pch'), id, null, category_id, new Date().toISOString()]
      );
    }

    const row = await db.get(
      `SELECT pp.*, ppc.name AS category_name, ppc.color_hex AS category_color
       FROM profiling_people pp
       LEFT JOIN profiling_people_categories ppc ON pp.category_id = ppc.id
       WHERE pp.id = ?`,
      [id]
    );
    res.status(201).json(row);
  } catch (error) {
    console.error('Error creating profiling person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/profiling-people/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, category_id, first_met_date, avatar_file_id } = req.body;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM profiling_people WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Person not found' });

    const updates = [];
    const params = [];

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (first_met_date !== undefined) {
      updates.push('first_met_date = ?');
      params.push(first_met_date);
    }
    if (avatar_file_id !== undefined) {
      updates.push('avatar_file_id = ?');
      params.push(avatar_file_id || null);
    }

    // Category change with history tracking
    if (category_id !== undefined && category_id !== existing.category_id) {
      if (category_id) {
        const cat = await db.get('SELECT id FROM profiling_people_categories WHERE id = ?', [category_id]);
        if (!cat) return res.status(400).json({ error: 'Invalid category_id' });
      }
      updates.push('category_id = ?');
      params.push(category_id || null);

      await db.run(
        'INSERT INTO profiling_people_category_history (id, person_id, old_category_id, new_category_id, changed_at) VALUES (?, ?, ?, ?, ?)',
        [generateId('pch'), id, existing.category_id, category_id || null, new Date().toISOString()]
      );
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.run(`UPDATE profiling_people SET ${updates.join(', ')} WHERE id = ?`, params);

    const row = await db.get(
      `SELECT pp.*, ppc.name AS category_name, ppc.color_hex AS category_color
       FROM profiling_people pp
       LEFT JOIN profiling_people_categories ppc ON pp.category_id = ppc.id
       WHERE pp.id = ?`,
      [id]
    );
    res.json(row);
  } catch (error) {
    console.error('Error updating profiling person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/profiling-people/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM profiling_people WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Person not found' });

    // Delete attachments from disk before DB cascade
    const attachments = await db.all('SELECT file_path FROM person_attachments WHERE person_id = ?', [id]);
    for (const att of attachments) {
      try {
        if (fs.existsSync(att.file_path)) fs.unlinkSync(att.file_path);
      } catch (e) { /* ignore */ }
    }
    // Clean up empty person dir
    const personDir = path.join(ATTACHMENTS_ROOT, id);
    try {
      if (fs.existsSync(personDir)) fs.rmSync(personDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }

    await db.run('DELETE FROM profiling_people WHERE id = ?', [id]);
    res.json({ message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting profiling person:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profiling-people/:id/category-history
router.get('/:id/category-history', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const rows = await db.all(
      `SELECT
        pch.id, pch.changed_at,
        old_cat.name AS old_category_name, old_cat.color_hex AS old_category_color,
        new_cat.name AS new_category_name, new_cat.color_hex AS new_category_color
      FROM profiling_people_category_history pch
      LEFT JOIN profiling_people_categories old_cat ON pch.old_category_id = old_cat.id
      LEFT JOIN profiling_people_categories new_cat ON pch.new_category_id = new_cat.id
      WHERE pch.person_id = ?
      ORDER BY pch.changed_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching category history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  MEMORIES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/profiling-people/:id/memories
router.get('/:id/memories', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const memories = await db.all(
      `SELECT * FROM person_memories WHERE person_id = ? ORDER BY memory_date DESC, created_at DESC`,
      [id]
    );

    // Fetch linked events for each memory
    const enriched = [];
    for (const mem of memories) {
      const events = await db.all(
        `SELECT e.id, e.title, e.date_string, e.time_slot, e.duration_mins
         FROM memory_event_links mel
         JOIN events e ON mel.event_id = e.id
         WHERE mel.memory_id = ?
         ORDER BY e.date_string DESC`,
        [mem.id]
      );
      enriched.push({ ...mem, linked_events: events });
    }
    res.json(enriched);
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profiling-people/:id/memories
router.post('/:id/memories', async (req, res) => {
  const { id } = req.params;
  const { memory_date, title, details, event_ids = [] } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const memoryId = generateId('mem');
  try {
    const db = await getDbConnection();
    const person = await db.get('SELECT id FROM profiling_people WHERE id = ?', [id]);
    if (!person) return res.status(404).json({ error: 'Person not found' });

    await db.run(
      'INSERT INTO person_memories (id, person_id, memory_date, title, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [memoryId, id, memory_date || null, title.trim(), details || '', new Date().toISOString()]
    );

    // Link events (measure-only enforcement is UI-side; we trust the UI here)
    for (const eventId of event_ids) {
      await db.run(
        'INSERT OR IGNORE INTO memory_event_links (memory_id, event_id) VALUES (?, ?)',
        [memoryId, eventId]
      );
    }

    const row = await db.get('SELECT * FROM person_memories WHERE id = ?', [memoryId]);
    res.status(201).json(row);
  } catch (error) {
    console.error('Error creating memory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/memories/:memoryId
router.patch('/memories/:memoryId', async (req, res) => {
  const { memoryId } = req.params;
  const { memory_date, title, details, event_ids } = req.body;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM person_memories WHERE id = ?', [memoryId]);
    if (!existing) return res.status(404).json({ error: 'Memory not found' });

    const updates = [];
    const params = [];
    if (memory_date !== undefined) { updates.push('memory_date = ?'); params.push(memory_date); }
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: 'title cannot be empty' });
      updates.push('title = ?'); params.push(title.trim());
    }
    if (details !== undefined) { updates.push('details = ?'); params.push(details); }

    if (updates.length > 0) {
      params.push(memoryId);
      await db.run(`UPDATE person_memories SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Rebuild event links if provided
    if (Array.isArray(event_ids)) {
      await db.run('DELETE FROM memory_event_links WHERE memory_id = ?', [memoryId]);
      for (const eventId of event_ids) {
        await db.run('INSERT OR IGNORE INTO memory_event_links (memory_id, event_id) VALUES (?, ?)', [memoryId, eventId]);
      }
    }

    const row = await db.get('SELECT * FROM person_memories WHERE id = ?', [memoryId]);
    const events = await db.all(
      `SELECT e.id, e.title, e.date_string, e.time_slot, e.duration_mins
       FROM memory_event_links mel
       JOIN events e ON mel.event_id = e.id
       WHERE mel.memory_id = ?
       ORDER BY e.date_string DESC`,
      [memoryId]
    );
    res.json({ ...row, linked_events: events });
  } catch (error) {
    console.error('Error updating memory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/memories/:memoryId
router.delete('/memories/:memoryId', async (req, res) => {
  const { memoryId } = req.params;
  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM person_memories WHERE id = ?', [memoryId]);
    if (!existing) return res.status(404).json({ error: 'Memory not found' });

    // Unlink attachments from this memory (set memory_id to NULL = general person files)
    await db.run('UPDATE person_attachments SET memory_id = NULL WHERE memory_id = ?', [memoryId]);
    await db.run('DELETE FROM person_memories WHERE id = ?', [memoryId]);
    res.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  EVENT LINKS
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/memories/:memoryId/events
router.post('/memories/:memoryId/events', async (req, res) => {
  const { memoryId } = req.params;
  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ error: 'event_id is required' });

  try {
    const db = await getDbConnection();
    const memory = await db.get('SELECT id FROM person_memories WHERE id = ?', [memoryId]);
    if (!memory) return res.status(404).json({ error: 'Memory not found' });

    await db.run(
      'INSERT OR IGNORE INTO memory_event_links (memory_id, event_id) VALUES (?, ?)',
      [memoryId, event_id]
    );
    res.json({ message: 'Event linked successfully' });
  } catch (error) {
    console.error('Error linking event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/memories/:memoryId/events/:eventId
router.delete('/memories/:memoryId/events/:eventId', async (req, res) => {
  const { memoryId, eventId } = req.params;
  try {
    const db = await getDbConnection();
    await db.run('DELETE FROM memory_event_links WHERE memory_id = ? AND event_id = ?', [memoryId, eventId]);
    res.json({ message: 'Event unlinked successfully' });
  } catch (error) {
    console.error('Error unlinking event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  FILE ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/profiling-people/:id/attachments
router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { memory_id } = req.body;

  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  try {
    const db = await getDbConnection();
    const person = await db.get('SELECT id FROM profiling_people WHERE id = ?', [id]);
    if (!person) {
      // Clean up uploaded file
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(404).json({ error: 'Person not found' });
    }

    // Validate memory_id if provided
    if (memory_id) {
      const memory = await db.get('SELECT id FROM person_memories WHERE id = ? AND person_id = ?', [memory_id, id]);
      if (!memory) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        return res.status(400).json({ error: 'Invalid memory_id' });
      }
    }

    const attId = generateId('att');
    await db.run(
      'INSERT INTO person_attachments (id, person_id, memory_id, file_name, file_path, file_type, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        attId, id, memory_id || null,
        req.file.originalname,
        req.file.path,
        req.file.mimetype || path.extname(req.file.originalname).toLowerCase(),
        req.file.size,
        new Date().toISOString(),
      ]
    );

    const row = await db.get('SELECT * FROM person_attachments WHERE id = ?', [attId]);
    res.status(201).json(row);
  } catch (error) {
    // Clean up uploaded file on error
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (e) {}
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/profiling-people/:id/attachments
router.get('/:id/attachments', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const rows = await db.all(
      `SELECT
        pa.*,
        pm.title AS memory_title,
        pm.memory_date AS memory_date
      FROM person_attachments pa
      LEFT JOIN person_memories pm ON pa.memory_id = pm.id
      WHERE pa.person_id = ?
      ORDER BY pa.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attachments/:id/download
router.get('/attachments/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const att = await db.get('SELECT * FROM person_attachments WHERE id = ?', [id]);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    if (!fs.existsSync(att.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const mime = att.file_type || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    const safeDispName = att.file_name.replace(/["\r\n]/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="${safeDispName}"`);
    const stream = fs.createReadStream(att.file_path);
    stream.pipe(res);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/attachments/:id (update memory link or nothing else for now)
router.patch('/attachments/:id', async (req, res) => {
  const { id } = req.params;
  const { memory_id } = req.body;

  try {
    const db = await getDbConnection();
    const att = await db.get('SELECT * FROM person_attachments WHERE id = ?', [id]);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    // Validate memory_id belongs to same person if provided
    if (memory_id) {
      const memory = await db.get('SELECT id FROM person_memories WHERE id = ? AND person_id = ?', [memory_id, att.person_id]);
      if (!memory) return res.status(400).json({ error: 'Invalid memory_id for this person' });
    }

    await db.run('UPDATE person_attachments SET memory_id = ? WHERE id = ?', [memory_id || null, id]);
    const row = await db.get('SELECT * FROM person_attachments WHERE id = ?', [id]);
    res.json(row);
  } catch (error) {
    console.error('Error updating attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const att = await db.get('SELECT * FROM person_attachments WHERE id = ?', [id]);
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    // Delete from disk
    try {
      if (fs.existsSync(att.file_path)) fs.unlinkSync(att.file_path);
    } catch (e) { /* ignore */ }

    // If this was an avatar, clear avatar_file_id from person
    if (att.person_id) {
      await db.run('UPDATE profiling_people SET avatar_file_id = NULL WHERE avatar_file_id = ?', [id]);
    }

    await db.run('DELETE FROM person_attachments WHERE id = ?', [id]);
    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
