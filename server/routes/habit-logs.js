const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

function newId() {
  return `hlog-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

async function getBaseTimezone(db) {
  const row = await db.get("SELECT value FROM settings WHERE key = 'base_timezone'");
  return (row && row.value) || 'America/Los_Angeles';
}

function deriveDateId(isoTimestamp, timezone) {
  const dt = new Date(isoTimestamp);
  if (Number.isNaN(dt.getTime())) return null;
  // en-CA produces YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

async function insertLog(db, { habit_id, count, notes, source, logged_at, timezone }) {
  const exists = await db.get('SELECT id FROM habits WHERE id = ?', [habit_id]);
  if (!exists) return { error: { status: 404, message: 'Habit not found' } };

  const id = newId();
  const ts = logged_at || new Date().toISOString();
  const dateId = deriveDateId(ts, timezone);
  if (!dateId) return { error: { status: 400, message: 'Invalid logged_at timestamp' } };

  const finalCount = Number.isFinite(Number(count)) && Number(count) > 0 ? Math.floor(Number(count)) : 1;

  await db.run(
    `INSERT INTO habit_logs (id, habit_id, logged_at, date_id, count, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, habit_id, ts, dateId, finalCount, notes || null, source || 'manual']
  );
  const log = await db.get('SELECT * FROM habit_logs WHERE id = ?', [id]);
  return { log };
}

// GET /api/habit-logs
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const conditions = [];
    const params = [];

    if (req.query.habit_id) {
      conditions.push('habit_id = ?');
      params.push(req.query.habit_id);
    }
    if (req.query.date) {
      conditions.push('date_id = ?');
      params.push(req.query.date);
    }
    if (req.query.date_from) {
      conditions.push('date_id >= ?');
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      conditions.push('date_id <= ?');
      params.push(req.query.date_to);
    }
    if (req.query.source) {
      conditions.push('source = ?');
      params.push(req.query.source);
    }

    let query = 'SELECT * FROM habit_logs';
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY logged_at DESC';

    const logs = await db.all(query, params);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching habit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/habit-logs/today-summary
// Returns one row per habit (including those with 0 logs today), with aggregated count.
router.get('/today-summary', async (req, res) => {
  try {
    const db = await getDbConnection();
    const tz = await getBaseTimezone(db);
    const today = deriveDateId(new Date().toISOString(), tz);

    const rows = await db.all(
      `SELECT
         h.id              AS habit_id,
         h.name            AS name,
         h.area            AS area,
         h.color_hex       AS habit_color,
         a.color_hex       AS area_color,
         h.icon            AS icon,
         h.sort_order      AS sort_order,
         COALESCE(SUM(l.count), 0) AS total_count,
         COUNT(l.id)               AS log_count,
         MAX(l.logged_at)          AS last_logged_at
       FROM habits h
       LEFT JOIN areas a ON h.area = a.id
       LEFT JOIN habit_logs l
              ON l.habit_id = h.id AND l.date_id = ?
       WHERE h.is_archived = 0
       GROUP BY h.id
       ORDER BY h.sort_order ASC, h.name COLLATE NOCASE`,
      [today]
    );

    res.json({
      date_id: today,
      timezone: tz,
      habits: rows.map(r => ({
        habit_id: r.habit_id,
        name: r.name,
        area: r.area,
        color_hex: r.habit_color || r.area_color || null,
        icon: r.icon,
        sort_order: r.sort_order,
        total_count: r.total_count,
        log_count: r.log_count,
        last_logged_at: r.last_logged_at,
      })),
    });
  } catch (error) {
    console.error('Error building today-summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/habit-logs
router.post('/', async (req, res) => {
  const { habit_id, count, notes, source, logged_at } = req.body;
  if (!habit_id) return res.status(400).json({ error: 'habit_id is required' });

  try {
    const db = await getDbConnection();
    const tz = await getBaseTimezone(db);
    const result = await insertLog(db, { habit_id, count, notes, source, logged_at, timezone: tz });
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    res.status(201).json(result.log);
  } catch (error) {
    console.error('Error creating habit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/habit-logs/quick/:habit_id — convenience one-tap endpoint
router.post('/quick/:habit_id', async (req, res) => {
  const { habit_id } = req.params;
  const { count, notes, source, logged_at } = req.body || {};

  try {
    const db = await getDbConnection();
    const tz = await getBaseTimezone(db);
    const result = await insertLog(db, { habit_id, count, notes, source, logged_at, timezone: tz });
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    res.status(201).json(result.log);
  } catch (error) {
    console.error('Error creating quick habit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/habit-logs/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM habit_logs WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Log not found' });
    res.json({ message: 'Log deleted successfully' });
  } catch (error) {
    console.error('Error deleting habit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
