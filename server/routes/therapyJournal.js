const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ── Entries ────────────────────────────────────────────────────────────────────

router.get('/entries', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { pattern_id } = req.query;

    const entries = pattern_id
      ? await db.all(`
          SELECT
            e.*,
            (SELECT COUNT(*) FROM therapy_entry_patterns ep2 WHERE ep2.entry_id = e.id) AS pattern_count,
            (SELECT COUNT(*) FROM therapy_questions q WHERE q.entry_id = e.id AND q.answered = 0) AS open_question_count,
            (SELECT COUNT(*) FROM therapy_questions q WHERE q.entry_id = e.id) AS question_count
          FROM therapy_entries e
          INNER JOIN therapy_entry_patterns fep ON fep.entry_id = e.id AND fep.pattern_id = ?
          GROUP BY e.id
          ORDER BY e.entry_date DESC, e.created_at DESC
        `, [pattern_id])
      : await db.all(`
          SELECT
            e.*,
            COUNT(DISTINCT ep.pattern_id) AS pattern_count,
            (SELECT COUNT(*) FROM therapy_questions q WHERE q.entry_id = e.id AND q.answered = 0) AS open_question_count,
            (SELECT COUNT(*) FROM therapy_questions q WHERE q.entry_id = e.id) AS question_count
          FROM therapy_entries e
          LEFT JOIN therapy_entry_patterns ep ON ep.entry_id = e.id
          GROUP BY e.id
          ORDER BY e.entry_date DESC, e.created_at DESC
        `);
    res.json(entries.map(e => ({
      ...e,
      state: e.state ? JSON.parse(e.state) : null,
      actions_taken: e.actions_taken ? JSON.parse(e.actions_taken) : [],
      reply_drafts: e.reply_drafts ? JSON.parse(e.reply_drafts) : [],
      linked_sleep: e.linked_sleep ? JSON.parse(e.linked_sleep) : [],
      linked_habits: e.linked_habits ? JSON.parse(e.linked_habits) : [],
    })));
  } catch (err) {
    console.error('therapy GET /entries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/entries/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const entry = await db.get('SELECT * FROM therapy_entries WHERE id = ?', [req.params.id]);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    const patterns = await db.all(`
      SELECT p.*, ep.notes AS entry_notes
      FROM therapy_patterns p
      JOIN therapy_entry_patterns ep ON ep.pattern_id = p.id
      WHERE ep.entry_id = ?
      ORDER BY p.name
    `, [entry.id]);

    const goals = await db.all(
      'SELECT * FROM therapy_goals WHERE first_entry_id = ? ORDER BY priority, created_at',
      [entry.id]
    );

    const questions = await db.all(
      'SELECT * FROM therapy_questions WHERE entry_id = ? ORDER BY created_at',
      [entry.id]
    );

    res.json({
      ...entry,
      state: entry.state ? JSON.parse(entry.state) : null,
      actions_taken: entry.actions_taken ? JSON.parse(entry.actions_taken) : [],
      reply_drafts: entry.reply_drafts ? JSON.parse(entry.reply_drafts) : [],
      linked_sleep: entry.linked_sleep ? JSON.parse(entry.linked_sleep) : [],
      linked_habits: entry.linked_habits ? JSON.parse(entry.linked_habits) : [],
      patterns,
      goals,
      questions,
    });
  } catch (err) {
    console.error('therapy GET /entries/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/entries', async (req, res) => {
  try {
    const db = await getDbConnection();
    const {
      entry_date = today(),
      session_date,
      session_label,
      context,
      therapist_summary,
      narrative,
      state,
      actions_taken = [],
      reply_drafts = [],
      notes_to_self,
      patterns = [],
      goals = [],
      questions = [],
    } = req.body;

    const id = newId('therapy');
    await db.run(`
      INSERT INTO therapy_entries
        (id, entry_date, session_date, session_label, context, therapist_summary,
         narrative, state, actions_taken, reply_drafts, notes_to_self)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, entry_date, session_date || null, session_label || null,
      context || null, therapist_summary || null, narrative || null,
      state ? JSON.stringify(state) : null,
      JSON.stringify(actions_taken),
      JSON.stringify(reply_drafts),
      notes_to_self || null,
    ]);

    for (const p of patterns) {
      let patternId = p.id;
      if (!patternId) {
        patternId = newId('pattern');
        await db.run(
          'INSERT INTO therapy_patterns (id, name, description, first_entry_id, category) VALUES (?, ?, ?, ?, ?)',
          [patternId, p.name, p.description || null, id, p.category || 'other']
        );
      }
      await db.run(
        'INSERT OR IGNORE INTO therapy_entry_patterns (entry_id, pattern_id, notes) VALUES (?, ?, ?)',
        [id, patternId, p.notes || null]
      );
    }

    for (let i = 0; i < goals.length; i++) {
      const g = goals[i];
      const status = ['open','in_progress','resolved'].includes(g.status) ? g.status : 'open';
      await db.run(
        'INSERT INTO therapy_goals (id, text, priority, status, first_entry_id) VALUES (?, ?, ?, ?, ?)',
        [newId('tgoal'), g.text, g.priority ?? i, status, id]
      );
    }

    for (const q of questions) {
      const answered = q.answered ? 1 : 0;
      await db.run(
        'INSERT INTO therapy_questions (id, text, entry_id, answered, answered_at) VALUES (?, ?, ?, ?, ?)',
        [newId('tq'), q.text, id, answered, answered && q.answered_at ? q.answered_at : null]
      );
    }

    const created = await db.get('SELECT * FROM therapy_entries WHERE id = ?', [id]);
    res.status(201).json({
      ...created,
      state: created.state ? JSON.parse(created.state) : null,
      actions_taken: JSON.parse(created.actions_taken || '[]'),
      reply_drafts: JSON.parse(created.reply_drafts || '[]'),
    });
  } catch (err) {
    console.error('therapy POST /entries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/entries/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const allowed = [
      'entry_date', 'session_date', 'session_label', 'context',
      'therapist_summary', 'narrative', 'state',
      'actions_taken', 'reply_drafts', 'notes_to_self',
      'linked_sleep', 'linked_habits',
    ];
    const sets = [], vals = [];
    for (const key of allowed) {
      if (key in req.body) {
        sets.push(`${key} = ?`);
        const v = req.body[key];
        vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(req.params.id);
    await db.run(`UPDATE therapy_entries SET ${sets.join(', ')} WHERE id = ?`, vals);
    const updated = await db.get('SELECT * FROM therapy_entries WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      state: updated.state ? JSON.parse(updated.state) : null,
      actions_taken: JSON.parse(updated.actions_taken || '[]'),
      reply_drafts: JSON.parse(updated.reply_drafts || '[]'),
      linked_sleep: updated.linked_sleep ? JSON.parse(updated.linked_sleep) : [],
      linked_habits: updated.linked_habits ? JSON.parse(updated.linked_habits) : [],
    });
  } catch (err) {
    console.error('therapy PATCH /entries/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/entries/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    await db.run('DELETE FROM therapy_entries WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('therapy DELETE /entries/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Patterns ───────────────────────────────────────────────────────────────────

router.get('/patterns', async (req, res) => {
  try {
    const db = await getDbConnection();
    const patterns = await db.all(`
      SELECT p.*, COUNT(ep.entry_id) AS occurrence_count
      FROM therapy_patterns p
      LEFT JOIN therapy_entry_patterns ep ON ep.pattern_id = p.id
      GROUP BY p.id
      ORDER BY occurrence_count DESC, p.name
    `);
    res.json(patterns);
  } catch (err) {
    console.error('therapy GET /patterns:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/patterns/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const pattern = await db.get(`
      SELECT p.*, COUNT(ep.entry_id) AS occurrence_count
      FROM therapy_patterns p
      LEFT JOIN therapy_entry_patterns ep ON ep.pattern_id = p.id
      WHERE p.id = ?
      GROUP BY p.id
    `, [req.params.id]);
    if (!pattern) return res.status(404).json({ error: 'Not found' });
    res.json(pattern);
  } catch (err) {
    console.error('therapy GET /patterns/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/patterns', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { name, description, category = 'other', first_entry_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const id = newId('pattern');
    await db.run(
      'INSERT INTO therapy_patterns (id, name, description, first_entry_id, category) VALUES (?, ?, ?, ?, ?)',
      [id, name, description || null, first_entry_id || null, category]
    );
    const created = await db.get('SELECT * FROM therapy_patterns WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) {
    console.error('therapy POST /patterns:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/patterns/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { name, description, category } = req.body;
    const sets = [], vals = [];
    if (name !== undefined)        { sets.push('name = ?');        vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (category !== undefined)    { sets.push('category = ?');    vals.push(category); }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(req.params.id);
    await db.run(`UPDATE therapy_patterns SET ${sets.join(', ')} WHERE id = ?`, vals);
    const updated = await db.get('SELECT * FROM therapy_patterns WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('therapy PATCH /patterns/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/entries/:id/patterns', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { pattern_id, notes } = req.body;
    if (!pattern_id) return res.status(400).json({ error: 'pattern_id required' });
    await db.run(
      'INSERT OR IGNORE INTO therapy_entry_patterns (entry_id, pattern_id, notes) VALUES (?, ?, ?)',
      [req.params.id, pattern_id, notes || null]
    );
    res.status(201).json({ entry_id: req.params.id, pattern_id });
  } catch (err) {
    console.error('therapy POST /entries/:id/patterns:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/entries/:id/patterns/:patternId', async (req, res) => {
  try {
    const db = await getDbConnection();
    await db.run(
      'DELETE FROM therapy_entry_patterns WHERE entry_id = ? AND pattern_id = ?',
      [req.params.id, req.params.patternId]
    );
    res.status(204).end();
  } catch (err) {
    console.error('therapy DELETE /entries/:id/patterns/:patternId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Goals ──────────────────────────────────────────────────────────────────────

router.get('/goals', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { status } = req.query;
    let sql = 'SELECT * FROM therapy_goals';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY priority, created_at';
    res.json(await db.all(sql, params));
  } catch (err) {
    console.error('therapy GET /goals:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/goals', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { text, priority = 0, first_entry_id } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const id = newId('tgoal');
    await db.run(
      "INSERT INTO therapy_goals (id, text, priority, status, first_entry_id) VALUES (?, ?, ?, 'open', ?)",
      [id, text, priority, first_entry_id || null]
    );
    res.status(201).json(await db.get('SELECT * FROM therapy_goals WHERE id = ?', [id]));
  } catch (err) {
    console.error('therapy POST /goals:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/goals/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { text, status, priority } = req.body;
    const sets = ["updated_at = datetime('now')"], vals = [];
    if (text !== undefined)     { sets.push('text = ?');     vals.push(text); }
    if (status !== undefined)   { sets.push('status = ?');   vals.push(status); }
    if (priority !== undefined) { sets.push('priority = ?'); vals.push(priority); }
    vals.push(req.params.id);
    await db.run(`UPDATE therapy_goals SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json(await db.get('SELECT * FROM therapy_goals WHERE id = ?', [req.params.id]));
  } catch (err) {
    console.error('therapy PATCH /goals/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/goals/reorder', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
    for (const { id, priority } of order) {
      await db.run("UPDATE therapy_goals SET priority = ?, updated_at = datetime('now') WHERE id = ?", [priority, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('therapy POST /goals/reorder:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Questions ──────────────────────────────────────────────────────────────────

router.patch('/questions/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { answered, answer_notes, text } = req.body;
    const sets = [], vals = [];
    if (text !== undefined)         { sets.push('text = ?');         vals.push(text); }
    if (answered !== undefined)     { sets.push('answered = ?');     vals.push(answered ? 1 : 0); }
    if (answer_notes !== undefined) { sets.push('answer_notes = ?'); vals.push(answer_notes); }
    if (answered)                   { sets.push("answered_at = datetime('now')"); }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(req.params.id);
    await db.run(`UPDATE therapy_questions SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json(await db.get('SELECT * FROM therapy_questions WHERE id = ?', [req.params.id]));
  } catch (err) {
    console.error('therapy PATCH /questions/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Linked data pickers ────────────────────────────────────────────────────────

// GET /api/therapy/available-sleep?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/available-sleep', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });
    const rows = await db.all(
      `SELECT date_string AS date_id, SUM(duration_mins) AS minutes
       FROM events
       WHERE area = 'sleep' AND column_type = 'measure'
         AND date_string >= ? AND date_string <= ?
       GROUP BY date_string
       ORDER BY date_string DESC`,
      [start, end]
    );
    res.json(rows);
  } catch (err) {
    console.error('therapy GET /available-sleep:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/therapy/available-habits?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/available-habits', async (req, res) => {
  try {
    const db = await getDbConnection();
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });

    const habits = await db.all(
      `SELECT id, name, goal_type, color_hex, icon FROM habits WHERE COALESCE(is_archived, 0) = 0 ORDER BY name`
    );

    const logs = await db.all(
      `SELECT habit_id, date_id, SUM(count) AS total
       FROM habit_logs
       WHERE date_id >= ? AND date_id <= ?
       GROUP BY habit_id, date_id`,
      [start, end]
    );

    // Count distinct days with at least one log per habit in range
    const logMap = {};
    for (const l of logs) {
      if (!logMap[l.habit_id]) logMap[l.habit_id] = new Set();
      if (l.total > 0) logMap[l.habit_id].add(l.date_id);
    }

    // Count total days in range
    const startD = new Date(start + 'T12:00:00');
    const endD   = new Date(end   + 'T12:00:00');
    const totalDays = Math.round((endD - startD) / 86400000) + 1;

    res.json(habits.map(h => ({
      ...h,
      completed_days: logMap[h.id]?.size || 0,
      total_days: totalDays,
      date_start: start,
      date_end: end,
    })));
  } catch (err) {
    console.error('therapy GET /available-habits:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
