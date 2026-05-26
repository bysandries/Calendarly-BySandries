const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// GET /api/extracts
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    let query = 'SELECT * FROM extracts';
    const conditions = [];
    const params = [];

    if (req.query.project_id) {
      query = `
        SELECT e.* FROM extracts e
        INNER JOIN extract_resources er ON e.id = er.extract_id
      `;
      conditions.push('er.project_id = ?');
      params.push(req.query.project_id);
    }
    if (req.query.task_id) {
      if (!query.includes('extract_resources')) {
        query = `
          SELECT e.* FROM extracts e
          INNER JOIN extract_resources er ON e.id = er.extract_id
        `;
      }
      conditions.push('er.task_id = ?');
      params.push(req.query.task_id);
    }
    if (req.query.tags) {
      if (!query.includes('FROM extracts e')) {
        query = 'SELECT * FROM extracts';
      }
      conditions.push('tags LIKE ?');
      params.push(`%${req.query.tags}%`);
    }
    if (req.query.search) {
      if (!query.includes('FROM extracts e')) {
        query = 'SELECT * FROM extracts';
      }
      conditions.push('(content LIKE ? OR bibliography LIKE ? OR chapter_section LIKE ?)');
      params.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`);
    }
    if (req.query.bibliography) {
      if (!query.includes('FROM extracts e')) {
        query = 'SELECT * FROM extracts';
      }
      conditions.push('bibliography LIKE ?');
      params.push(`%${req.query.bibliography}%`);
    }

    if (conditions.length > 0) {
      const whereKeyword = query.includes('WHERE') ? ' AND' : ' WHERE';
      query += whereKeyword + ' ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';
    const extracts = await db.all(query, params);

    // Fetch resources for each extract
    for (const extract of extracts) {
      const resources = await db.all(
        'SELECT * FROM extract_resources WHERE extract_id = ?',
        [extract.id]
      );
      extract.resources = resources;
    }

    res.json(extracts);
  } catch (error) {
    console.error('Error fetching extracts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/extracts/:id
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const extract = await db.get('SELECT * FROM extracts WHERE id = ?', [req.params.id]);
    if (!extract) {
      return res.status(404).json({ error: 'Extract not found' });
    }
    const resources = await db.all(
      'SELECT * FROM extract_resources WHERE extract_id = ?',
      [extract.id]
    );
    extract.resources = resources;
    res.json(extract);
  } catch (error) {
    console.error('Error fetching extract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/extracts
router.post('/', async (req, res) => {
  const {
    content, bibliography, chapter_section, position,
    tags, highlight_color, note_id, resource_ids
  } = req.body;

  const extractId = `extract-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  try {
    const db = await getDbConnection();
    await db.run(
      `INSERT INTO extracts (id, content, bibliography, chapter_section, position, tags, highlight_color, note_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [extractId, content || null, bibliography || null, chapter_section || null, position || null, tags || null, highlight_color || null, note_id || null]
    );

    // Insert resource links if provided
    if (Array.isArray(resource_ids)) {
      for (const resource of resource_ids) {
        if (resource.project_id || resource.task_id) {
          await db.run(
            'INSERT INTO extract_resources (extract_id, project_id, task_id) VALUES (?, ?, ?)',
            [extractId, resource.project_id || null, resource.task_id || null]
          );
        }
      }
    }

    const extract = await db.get('SELECT * FROM extracts WHERE id = ?', [extractId]);
    const resources = await db.all('SELECT * FROM extract_resources WHERE extract_id = ?', [extractId]);
    extract.resources = resources;
    res.status(201).json(extract);
  } catch (error) {
    console.error('Error creating extract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/extracts/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM extracts WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Extract not found' });
    }

    const merged = { ...existing, ...updates };
    await db.run(
      `UPDATE extracts
       SET content = ?, bibliography = ?, chapter_section = ?, position = ?, tags = ?, created_at = ?, highlight_color = ?, note_id = ?
       WHERE id = ?`,
      [
        merged.content,
        merged.bibliography,
        merged.chapter_section,
        merged.position,
        merged.tags,
        merged.created_at,
        merged.highlight_color,
        merged.note_id || null,
        id
      ]
    );

    const extract = await db.get('SELECT * FROM extracts WHERE id = ?', [id]);
    const resources = await db.all('SELECT * FROM extract_resources WHERE extract_id = ?', [id]);
    extract.resources = resources;
    res.json(extract);
  } catch (error) {
    console.error('Error updating extract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/extracts/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM extracts WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Extract not found' });
    }
    res.json({ message: 'Extract deleted successfully' });
  } catch (error) {
    console.error('Error deleting extract:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/extracts/:id/links — all linked extracts (both directions)
router.get('/:id/links', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const linked = await db.all(`
      SELECT e.* FROM extracts e
      INNER JOIN extract_links el ON el.target_id = e.id
      WHERE el.source_id = ?
      UNION
      SELECT e.* FROM extracts e
      INNER JOIN extract_links el ON el.source_id = e.id
      WHERE el.target_id = ?
    `, [id, id]);
    res.json(linked);
  } catch (error) {
    console.error('Error fetching extract links:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/extracts/:id/links — add a link between two extracts
router.post('/:id/links', async (req, res) => {
  const { id } = req.params;
  const { target_id } = req.body;

  if (!target_id) return res.status(400).json({ error: 'target_id required' });
  if (id === target_id) return res.status(400).json({ error: 'Cannot link an extract to itself' });

  try {
    const db = await getDbConnection();
    // Normalize order so (A,B) and (B,A) map to the same row
    const [src, tgt] = id < target_id ? [id, target_id] : [target_id, id];
    await db.run(
      'INSERT OR IGNORE INTO extract_links (source_id, target_id) VALUES (?, ?)',
      [src, tgt]
    );
    res.json({ message: 'Link added', source_id: src, target_id: tgt });
  } catch (error) {
    console.error('Error adding extract link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/extracts/:id/links/:targetId — remove a link
router.delete('/:id/links/:targetId', async (req, res) => {
  const { id, targetId } = req.params;
  try {
    const db = await getDbConnection();
    await db.run(
      `DELETE FROM extract_links
       WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)`,
      [id, targetId, targetId, id]
    );
    res.json({ message: 'Link removed' });
  } catch (error) {
    console.error('Error removing extract link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/extracts/:id/resources — link a project or task
router.post('/:id/resources', async (req, res) => {
  const { id } = req.params;
  const { project_id, task_id } = req.body;

  if (!project_id && !task_id) {
    return res.status(400).json({ error: 'project_id or task_id is required' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM extracts WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Extract not found' });
    }

    await db.run(
      'INSERT INTO extract_resources (extract_id, project_id, task_id) VALUES (?, ?, ?)',
      [id, project_id || null, task_id || null]
    );

    const resources = await db.all('SELECT * FROM extract_resources WHERE extract_id = ?', [id]);
    res.json({ message: 'Resource linked', resources });
  } catch (error) {
    console.error('Error linking resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/extracts/:id/resources — unlink a project or task
router.delete('/:id/resources', async (req, res) => {
  const { id } = req.params;
  const { project_id, task_id } = req.body;

  if (!project_id && !task_id) {
    return res.status(400).json({ error: 'project_id or task_id is required' });
  }

  try {
    const db = await getDbConnection();
    let query = 'DELETE FROM extract_resources WHERE extract_id = ?';
    const params = [id];

    if (project_id) {
      query += ' AND project_id = ?';
      params.push(project_id);
    }
    if (task_id) {
      query += ' AND task_id = ?';
      params.push(task_id);
    }

    await db.run(query, params);
    const resources = await db.all('SELECT * FROM extract_resources WHERE extract_id = ?', [id]);
    res.json({ message: 'Resource unlinked', resources });
  } catch (error) {
    console.error('Error unlinking resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
