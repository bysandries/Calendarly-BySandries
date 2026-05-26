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
    
    // Fetch reminders for each habit
    for (const h of habits) {
      const reminders = await db.all('SELECT time_of_day FROM habit_reminders WHERE habit_id = ? ORDER BY time_of_day ASC', [h.id]);
      h.reminders = reminders.map(r => r.time_of_day);
    }

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
    
    const reminders = await db.all('SELECT time_of_day FROM habit_reminders WHERE habit_id = ? ORDER BY time_of_day ASC', [habit.id]);
    habit.reminders = reminders.map(r => r.time_of_day);
    
    res.json(habit);
  } catch (error) {
    console.error('Error fetching habit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function syncReminders(db, habitId, reminders) {
  if (!Array.isArray(reminders)) return;
  
  await db.run('DELETE FROM habit_reminders WHERE habit_id = ?', [habitId]);
  
  for (const time of reminders) {
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) continue;
    const rid = `rem-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    await db.run(
      'INSERT INTO habit_reminders (id, habit_id, time_of_day) VALUES (?, ?, ?)',
      [rid, habitId, time]
    );
  }
}

// POST /api/habits
router.post('/', async (req, res) => {
  const { name, area, description, color_hex, icon, sort_order, goal_type, min_per_day, max_per_day, reminders } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (color_hex && !HEX_RE.test(color_hex)) {
    return res.status(400).json({ error: 'color_hex must be a 6-digit hex like #RRGGBB' });
  }
  if (goal_type && !['build', 'quit'].includes(goal_type)) {
    return res.status(400).json({ error: 'goal_type must be either "build" or "quit"' });
  }

  const id = newId();
  const createdAt = new Date().toISOString();

  try {
    const db = await getDbConnection();
    await db.run(
      `INSERT INTO habits (id, name, area, description, color_hex, icon, sort_order, goal_type, min_per_day, max_per_day, is_archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        name.trim(),
        area || null,
        description || null,
        color_hex || null,
        icon || null,
        Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
        goal_type || 'build',
        Number.isFinite(Number(min_per_day)) ? Number(min_per_day) : 1,
        Number.isFinite(Number(max_per_day)) ? Number(max_per_day) : null,
        createdAt,
      ]
    );
    
    if (reminders) {
      await syncReminders(db, id, reminders);
    }
    
    const habit = await db.get('SELECT * FROM habits WHERE id = ?', [id]);
    const savedReminders = await db.all('SELECT time_of_day FROM habit_reminders WHERE habit_id = ? ORDER BY time_of_day ASC', [id]);
    habit.reminders = savedReminders.map(r => r.time_of_day);
    
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
  if (updates.goal_type && !['build', 'quit'].includes(updates.goal_type)) {
    return res.status(400).json({ error: 'goal_type must be either "build" or "quit"' });
  }

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM habits WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Habit not found' });

    const merged = { ...existing, ...updates };
    await db.run(
      `UPDATE habits
       SET name = ?, area = ?, description = ?, color_hex = ?, icon = ?, sort_order = ?, goal_type = ?, min_per_day = ?, max_per_day = ?, is_archived = ?
       WHERE id = ?`,
      [
        String(merged.name).trim(),
        merged.area || null,
        merged.description || null,
        merged.color_hex || null,
        merged.icon || null,
        Number(merged.sort_order) || 0,
        merged.goal_type || 'build',
        Number.isFinite(Number(merged.min_per_day)) ? Number(merged.min_per_day) : 1,
        merged.max_per_day !== undefined && merged.max_per_day !== null ? Number(merged.max_per_day) : null,
        merged.is_archived ? 1 : 0,
        id,
      ]
    );
    
    if (updates.reminders) {
      await syncReminders(db, id, updates.reminders);
    }
    
    const habit = await db.get('SELECT * FROM habits WHERE id = ?', [id]);
    const savedReminders = await db.all('SELECT time_of_day FROM habit_reminders WHERE habit_id = ? ORDER BY time_of_day ASC', [id]);
    habit.reminders = savedReminders.map(r => r.time_of_day);
    
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
