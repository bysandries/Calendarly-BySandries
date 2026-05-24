const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// 1. GET /api/daily-logs?date=YYYY-MM-DD or start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const { date, start_date, end_date } = req.query;
  if (!date && (!start_date || !end_date)) {
    return res.status(400).json({ error: 'date or start_date/end_date parameter is required' });
  }

  try {
    const db = await getDbConnection();
    let rows;
    if (start_date && end_date) {
      rows = await db.all(
        'SELECT * FROM DailyLogs WHERE date_id BETWEEN ? AND ?',
        [start_date, end_date]
      );
    } else {
      rows = await db.all(
        'SELECT * FROM DailyLogs WHERE date_id = ?',
        [date]
      );
    }
    res.json(rows);
  } catch (error) {
    console.error('Error fetching daily logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. POST /api/daily-logs (UPSERT note)
router.post('/', async (req, res) => {
  const { date_id, note, user_id } = req.body;
  const userId = user_id || 'default_user';

  console.log(`[DailyLogs] Received POST request: date=${date_id}, noteLength=${note?.length}, user=${userId}`);

  if (!date_id) {
    return res.status(400).json({ error: 'date_id is required' });
  }

  try {
    const db = await getDbConnection();

    // Check if log already exists for this date and user
    // We use a simple query first
    const existingLog = await db.get('SELECT id FROM DailyLogs WHERE date_id = ? AND user_id = ?', [date_id, userId]);

    if (existingLog) {
      console.log(`[DailyLogs] Updating existing record: ${existingLog.id}`);
      await db.run(
        'UPDATE DailyLogs SET note = ? WHERE id = ?',
        [note || '', existingLog.id]
      );
      return res.json({ success: true, message: 'Updated', id: existingLog.id });
    } else {
      const newId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      console.log(`[DailyLogs] Inserting new record: ${newId}`);
      await db.run(
        'INSERT INTO DailyLogs (id, user_id, date_id, note) VALUES (?, ?, ?, ?)',
        [newId, userId, date_id, note || '']
      );
      return res.status(201).json({ success: true, message: 'Created', id: newId });
    }
  } catch (error) {
    console.error('[DailyLogs] Critical UPSERT Error:', error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
});

module.exports = router;
