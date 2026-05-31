const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

function now() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

function newId(prefix = 'tl') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

const hydrate = (item) => ({
  ...item,
  version_history: JSON.parse(item.version_history || '[]'),
});

// GET /api/timeline  — all items (filterable by type, lane, status)
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { type, lane, status } = req.query;
    let sql = 'SELECT * FROM timeline_items WHERE 1=1';
    const params = [];
    if (type)   { sql += ' AND type = ?';   params.push(type);   }
    if (lane)   { sql += ' AND lane = ?';   params.push(lane);   }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    const sort = req.query.sort || 'date';
    if (sort === 'mood') {
      sql += ' ORDER BY mood DESC NULLS LAST, start_date ASC, sort_order ASC';
    } else {
      sql += ' ORDER BY start_date ASC, sort_order ASC';
    }
    const rows = await db.all(sql, params);

    // Attach link counts so the canvas can show a "linked" indicator cheaply.
    const counts = await db.all(
      'SELECT item_id, COUNT(*) AS n FROM timeline_item_links GROUP BY item_id'
    );
    const countMap = Object.fromEntries(counts.map(c => [c.item_id, c.n]));
    res.json(rows.map(r => ({ ...hydrate(r), link_count: countMap[r.id] || 0 })));
  } catch (err) {
    console.error('GET /timeline error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/timeline/export  — full backup payload (items + their links)
// Declared before '/:id' so the literal path isn't captured by the param route.
router.get('/export', async (req, res) => {
  try {
    const db = await getDbConnection();
    const items = await db.all('SELECT * FROM timeline_items ORDER BY start_date ASC, sort_order ASC');
    const links = await db.all('SELECT * FROM timeline_item_links ORDER BY created_at ASC');
    const linksByItem = {};
    links.forEach(l => { (linksByItem[l.item_id] = linksByItem[l.item_id] || []).push(l); });
    res.json({
      type: 'calendarly-timeline-export',
      version: 1,
      exported_at: new Date().toISOString(),
      count: items.length,
      items: items.map(it => ({ ...hydrate(it), links: linksByItem[it.id] || [] })),
    });
  } catch (err) {
    console.error('GET /timeline/export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/timeline/import  — append items from an export payload.
// Generates fresh ids (never overwrites existing items); preserves
// version_history and recreates links (link_id targets are external, so no
// remapping is needed).
router.post('/import', async (req, res) => {
  try {
    const db = await getDbConnection();
    const body = req.body || {};
    const items = Array.isArray(body) ? body : (Array.isArray(body.items) ? body.items : null);
    if (!items) return res.status(400).json({ error: 'Expected an array of items or { items: [...] }' });

    let created = 0, linksCreated = 0, skipped = 0;
    for (const raw of items) {
      if (!raw || !raw.title || !raw.title.trim() || !raw.start_date) { skipped++; continue; }
      const id = newId();
      const ts = now();
      const vh = Array.isArray(raw.version_history)
        ? JSON.stringify(raw.version_history)
        : (typeof raw.version_history === 'string' ? raw.version_history : '[]');
      await db.run(
        `INSERT INTO timeline_items
          (id, title, type, lane, color, start_date, end_date, status, progress, notes, version_history, sort_order, mood, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, raw.title.trim(), raw.type || 'goal', raw.lane || 'general', raw.color || null,
         raw.start_date, raw.end_date || null, raw.status || 'planned', Number(raw.progress) || 0,
         raw.notes || null, vh, Number(raw.sort_order) || 0,
         raw.mood != null ? Number(raw.mood) : null, ts, ts]
      );
      created++;
      const links = Array.isArray(raw.links) ? raw.links : [];
      for (const l of links) {
        if (!l || !l.link_type || !l.link_id) continue;
        await db.run(
          'INSERT INTO timeline_item_links (id, item_id, link_type, link_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [newId('tllink'), id, l.link_type, String(l.link_id), l.notes || null, ts]
        );
        linksCreated++;
      }
    }
    res.json({ ok: true, created, links_created: linksCreated, skipped });
  } catch (err) {
    console.error('POST /timeline/import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/timeline/reorder  — bulk-update sort_order for DnD reorder
router.post('/reorder', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { order } = req.body; // [{ id, sort_order }, ...]
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Expected an order array' });
    await db.run('BEGIN');
    try {
      for (const o of order) {
        await db.run('UPDATE timeline_items SET sort_order = ?, updated_at = ? WHERE id = ?',
          [Number(o.sort_order) || 0, now(), o.id]);
      }
      await db.run('COMMIT');
    } catch (innerErr) {
      await db.run('ROLLBACK');
      throw innerErr;
    }
    res.json({ ok: true, updated: order.length });
  } catch (err) {
    console.error('POST /timeline/reorder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/timeline/:id  — one item with hydrated links
router.get('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const item = await db.get('SELECT * FROM timeline_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const links = await db.all(
      'SELECT * FROM timeline_item_links WHERE item_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ ...hydrate(item), links });
  } catch (err) {
    console.error('GET /timeline/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/timeline
router.post('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const {
      title, type = 'goal', lane = 'general', color = null,
      start_date, end_date = null, status = 'planned',
      progress = 0, notes = null, sort_order = 0, mood = null,
    } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!start_date) return res.status(400).json({ error: 'start_date is required' });
    if (mood != null && (mood < 1 || mood > 10)) return res.status(400).json({ error: 'Mood must be between 1 and 10' });
    const id = newId();
    const ts = now();
    await db.run(
      `INSERT INTO timeline_items
        (id, title, type, lane, color, start_date, end_date, status, progress, notes, sort_order, mood, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title.trim(), type, lane, color, start_date, end_date, status,
       Number(progress) || 0, notes, Number(sort_order) || 0, mood != null ? Number(mood) : null, ts, ts]
    );
    const item = await db.get('SELECT * FROM timeline_items WHERE id = ?', [id]);
    res.status(201).json(hydrate(item));
  } catch (err) {
    console.error('POST /timeline error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/timeline/:id  — snapshots the prior state into version_history first
router.put('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const item = await db.get('SELECT * FROM timeline_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const ts = now();
    const {
      title, type, lane, color, start_date, end_date,
      status, progress, notes, sort_order, mood,
    } = req.body;

    if (mood != null && (mood < 1 || mood > 10)) return res.status(400).json({ error: 'Mood must be between 1 and 10' });

    // Only snapshot when something plan-shaping actually changed, so cosmetic
    // edits (notes, color) don't pollute the history view.
    const planChanged =
      (start_date !== undefined && start_date !== item.start_date) ||
      (end_date   !== undefined && end_date   !== item.end_date)   ||
      (status     !== undefined && status     !== item.status)     ||
      (progress   !== undefined && Number(progress) !== item.progress) ||
      (lane       !== undefined && lane       !== item.lane);

    let history = JSON.parse(item.version_history || '[]');
    if (planChanged) {
      history = [...history, {
        changed_at: ts,
        start_date: item.start_date,
        end_date: item.end_date,
        status: item.status,
        progress: item.progress,
        lane: item.lane,
      }];
    }

    await db.run(
      `UPDATE timeline_items SET
        title = COALESCE(?, title),
        type = COALESCE(?, type),
        lane = COALESCE(?, lane),
        color = ?,
        start_date = COALESCE(?, start_date),
        end_date = ?,
        status = COALESCE(?, status),
        progress = COALESCE(?, progress),
        notes = ?,
        sort_order = COALESCE(?, sort_order),
        mood = ?,
        version_history = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        title?.trim() || null,
        type || null,
        lane || null,
        color !== undefined ? color : item.color,
        start_date || null,
        end_date !== undefined ? end_date : item.end_date,
        status || null,
        progress !== undefined ? Number(progress) : null,
        notes !== undefined ? notes : item.notes,
        sort_order !== undefined ? Number(sort_order) : null,
        mood !== undefined ? (mood != null ? Number(mood) : null) : item.mood,
        JSON.stringify(history),
        ts,
        req.params.id,
      ]
    );
    const updated = await db.get('SELECT * FROM timeline_items WHERE id = ?', [req.params.id]);
    res.json(hydrate(updated));
  } catch (err) {
    console.error('PUT /timeline/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/timeline/:id  (cascades links)
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const item = await db.get('SELECT id FROM timeline_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    await db.run('DELETE FROM timeline_item_links WHERE item_id = ?', [req.params.id]);
    await db.run('DELETE FROM timeline_items WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /timeline/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/timeline/:id/links
router.post('/:id/links', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { link_type, link_id, notes } = req.body;
    if (!link_type || !link_id) return res.status(400).json({ error: 'link_type and link_id are required' });
    const id = newId('tllink');
    const ts = now();
    await db.run(
      'INSERT INTO timeline_item_links (id, item_id, link_type, link_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.id, link_type, link_id, notes || null, ts]
    );
    const link = await db.get('SELECT * FROM timeline_item_links WHERE id = ?', [id]);
    res.status(201).json(link);
  } catch (err) {
    console.error('POST /timeline/:id/links error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/timeline/:id/links/:linkId
router.delete('/:id/links/:linkId', async (req, res) => {
  try {
    const db = await getDbConnection();
    await db.run('DELETE FROM timeline_item_links WHERE id = ? AND item_id = ?', [req.params.linkId, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /timeline/:id/links/:linkId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
