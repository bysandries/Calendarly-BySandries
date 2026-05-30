const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

const VALID_ENERGY  = new Set(['high', 'low']);
const VALID_EMOTION = new Set(['positive', 'negative']);
const VALID_ENTITY  = new Set(['task', 'event']);

function newId() {
  return `ael-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function now() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

// GET /api/activity-energy-log?entity_type=&entity_id=
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { entity_type, entity_id, start, end, limit = 100 } = req.query;

    let sql = 'SELECT * FROM activity_energy_log WHERE 1=1';
    const params = [];

    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id)   { sql += ' AND entity_id = ?';   params.push(entity_id);   }
    if (start)       { sql += ' AND logged_at >= ?';  params.push(start);       }
    if (end)         { sql += ' AND logged_at <= ?';  params.push(end + ' 23:59:59'); }

    sql += ' ORDER BY logged_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const rows = await db.all(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /activity-energy-log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/activity-energy-log/summary?start=&end=
router.get('/summary', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { start, end, entity_type } = req.query;

    let sql = `
      SELECT
        energy_level,
        emotion_type,
        COUNT(*) AS count
      FROM activity_energy_log
      WHERE 1=1
    `;
    const params = [];
    if (start)       { sql += ' AND logged_at >= ?';  params.push(start);       }
    if (end)         { sql += ' AND logged_at <= ?';  params.push(end + ' 23:59:59'); }
    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    sql += ' GROUP BY energy_level, emotion_type';

    const rows = await db.all(sql, params);

    const quadrants = {
      performance: 0,
      survival:    0,
      renewal:     0,
      burnout:     0,
    };
    for (const r of rows) {
      const key =
        r.energy_level === 'high' && r.emotion_type === 'positive' ? 'performance' :
        r.energy_level === 'high' && r.emotion_type === 'negative' ? 'survival'    :
        r.energy_level === 'low'  && r.emotion_type === 'positive' ? 'renewal'     :
        'burnout';
      quadrants[key] += r.count;
    }
    const total = Object.values(quadrants).reduce((s, v) => s + v, 0);

    res.json({ quadrants, total, breakdown: rows });
  } catch (err) {
    console.error('GET /activity-energy-log/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/activity-energy-log
router.post('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { entity_type, entity_id, energy_level, emotion_type, note, logged_at } = req.body;

    if (!VALID_ENTITY.has(entity_type))   return res.status(400).json({ error: 'Invalid entity_type' });
    if (!entity_id)                        return res.status(400).json({ error: 'entity_id is required' });
    if (!VALID_ENERGY.has(energy_level))   return res.status(400).json({ error: 'Invalid energy_level' });
    if (!VALID_EMOTION.has(emotion_type))  return res.status(400).json({ error: 'Invalid emotion_type' });

    const id = newId();
    const ts = now();
    const loggedAt = logged_at || ts;

    await db.run(
      `INSERT INTO activity_energy_log
         (id, entity_type, entity_id, energy_level, emotion_type, note, logged_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entity_type, entity_id, energy_level, emotion_type, note || null, loggedAt, ts]
    );

    const entry = await db.get('SELECT * FROM activity_energy_log WHERE id = ?', [id]);
    res.status(201).json(entry);
  } catch (err) {
    console.error('POST /activity-energy-log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/activity-energy-log/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    await db.run('DELETE FROM activity_energy_log WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /activity-energy-log/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
