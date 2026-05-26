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

async function getFirstDayOfWeek(db) {
  const row = await db.get("SELECT value FROM settings WHERE key = 'first_day_of_week'");
  return (row && row.value) || 'sunday';
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

function getWeekDays(todayDateId, firstDayOfWeek = 'sunday') {
  // todayDateId is YYYY-MM-DD
  const parts = todayDateId.split('-');
  // Use UTC to avoid local timezone shifts during calculation
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const day = d.getUTCDay(); // 0 (Sun) to 6 (Sat)
  
  let diffToStart = 0;
  if (firstDayOfWeek === 'monday') {
    diffToStart = day === 0 ? -6 : 1 - day;
  } else {
    // Default to Sunday
    diffToStart = -day;
  }
  
  const startDay = new Date(d);
  startDay.setUTCDate(d.getUTCDate() + diffToStart);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const nd = new Date(startDay);
    nd.setUTCDate(startDay.getUTCDate() + i);
    days.push(nd.toISOString().split('T')[0]);
  }
  return days;
}

async function calculateStreak(db, habit, todayDateId) {
  const goalType = habit.goal_type || 'build';
  const minPerDay = habit.min_per_day || 1;

  if (goalType === 'quit') {
    // For 'quit' habits, streak = full days since the last time it was logged.
    // "since the last time I did it"
    const lastLog = await db.get(
      'SELECT logged_at FROM habit_logs WHERE habit_id = ? ORDER BY logged_at DESC LIMIT 1',
      [habit.id]
    );
    const startTime = lastLog ? new Date(lastLog.logged_at).getTime() : new Date(habit.created_at).getTime();
    const now = Date.now();
    const diffMs = now - startTime;
    // Number of full 24-hour periods since the last event
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // For 'build' habits, streak = consecutive days where daily total >= minPerDay.
  const dailyTotals = await db.all(
    `SELECT date_id, SUM(count) as total
     FROM habit_logs
     WHERE habit_id = ? AND date_id <= ?
     GROUP BY date_id
     ORDER BY date_id DESC`,
    [habit.id, todayDateId]
  );
  
  const totalsMap = {};
  dailyTotals.forEach(row => { totalsMap[row.date_id] = row.total; });

  let streak = 0;
  const parts = todayDateId.split('-');
  let current = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  let checkedToday = false;

  while (true) {
    const dStr = current.toISOString().split('T')[0];
    const dailyTotal = totalsMap[dStr] || 0;

    if (dailyTotal >= minPerDay) {
      streak++;
    } else {
      if (!checkedToday && dStr === todayDateId) {
        // Today not met yet, streak is safe if yesterday was met
      } else {
        break; // Missed target
      }
    }

    checkedToday = true;
    current.setUTCDate(current.getUTCDate() - 1);
    
    // Safety & Floor logic
    if (streak > 3650) break;
    if (dailyTotals.length > 0 && dStr < dailyTotals[dailyTotals.length - 1].date_id) break;
    // If no logs, streak is 0 anyway
    if (dailyTotals.length === 0) break;
  }

  return streak;
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
         h.goal_type       AS goal_type,
         h.min_per_day     AS min_per_day,
         h.max_per_day     AS max_per_day,
         h.created_at      AS created_at,
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

    const habits = [];
    for (const r of rows) {
      const reminders = await db.all('SELECT time_of_day FROM habit_reminders WHERE habit_id = ? ORDER BY time_of_day ASC', [r.habit_id]);
      const streak = await calculateStreak(db, { id: r.habit_id, goal_type: r.goal_type, created_at: r.created_at, min_per_day: r.min_per_day }, today);
      
      habits.push({
        habit_id: r.habit_id,
        name: r.name,
        area: r.area,
        color_hex: r.habit_color || r.area_color || null,
        icon: r.icon,
        sort_order: r.sort_order,
        goal_type: r.goal_type,
        min_per_day: r.min_per_day,
        max_per_day: r.max_per_day,
        reminders: reminders.map(rem => rem.time_of_day),
        streak: streak,
        total_count: r.total_count,
        log_count: r.log_count,
        last_logged_at: r.last_logged_at,
      });
    }

    res.json({
      date_id: today,
      timezone: tz,
      habits: habits,
    });
  } catch (error) {
    console.error('Error building today-summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/habit-logs/weekly-summary
router.get('/weekly-summary', async (req, res) => {
  try {
    const db = await getDbConnection();
    const tz = await getBaseTimezone(db);
    const firstDay = await getFirstDayOfWeek(db);
    const today = deriveDateId(new Date().toISOString(), tz);
    const weekDates = getWeekDays(today, firstDay);

    // Fetch all active habits
    const habitsList = await db.all(
      `SELECT h.*, a.color_hex as area_color
       FROM habits h
       LEFT JOIN areas a ON h.area = a.id
       WHERE h.is_archived = 0
       ORDER BY h.sort_order ASC, h.name COLLATE NOCASE`
    );

    const result = [];
    for (const h of habitsList) {
      // Get log counts for the week
      const logs = await db.all(
        `SELECT date_id, SUM(count) as total
         FROM habit_logs
         WHERE habit_id = ? AND date_id IN (${weekDates.map(() => '?').join(',')})
         GROUP BY date_id`,
        [h.id, ...weekDates]
      );

      const logsByDate = {};
      weekDates.forEach(d => { logsByDate[d] = 0; });
      logs.forEach(l => { logsByDate[l.date_id] = l.total; });

      const reminders = await db.all('SELECT time_of_day FROM habit_reminders WHERE habit_id = ? ORDER BY time_of_day ASC', [h.id]);
      const streak = await calculateStreak(db, h, today);

      result.push({
        habit_id: h.id,
        name: h.name,
        area: h.area,
        color_hex: h.color_hex || h.area_color || null,
        icon: h.icon,
        goal_type: h.goal_type,
        min_per_day: h.min_per_day,
        max_per_day: h.max_per_day,
        streak: streak,
        reminders: reminders.map(r => r.time_of_day),
        logs_by_date: logsByDate,
      });
    }

    res.json({
      date_id: today,
      timezone: tz,
      week_dates: weekDates,
      habits: result,
    });
  } catch (error) {
    console.error('Error building weekly-summary:', error);
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

// PATCH /api/habit-logs/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { logged_at, count, notes } = req.body;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM habit_logs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Log not found' });

    let finalTs = existing.logged_at;
    let finalDateId = existing.date_id;

    if (logged_at) {
      const tz = await getBaseTimezone(db);
      finalTs = logged_at;
      finalDateId = deriveDateId(finalTs, tz);
      if (!finalDateId) return res.status(400).json({ error: 'Invalid logged_at timestamp' });
    }

    const finalCount = count !== undefined ? (Number.isFinite(Number(count)) && Number(count) > 0 ? Math.floor(Number(count)) : existing.count) : existing.count;
    const finalNotes = notes !== undefined ? notes : existing.notes;

    await db.run(
      `UPDATE habit_logs
       SET logged_at = ?, date_id = ?, count = ?, notes = ?
       WHERE id = ?`,
      [finalTs, finalDateId, finalCount, finalNotes, id]
    );

    const log = await db.get('SELECT * FROM habit_logs WHERE id = ?', [id]);
    res.json(log);
  } catch (error) {
    console.error('Error updating habit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
