const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// Pricing per million tokens (May 2026 Anthropic rates)
const CLAUDE_RATES = {
  'claude-opus-4-7':    { input: 15,   output: 75,  cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-sonnet-4-6':  { input: 3,    output: 15,  cacheRead: 0.3,  cacheWrite: 3.75 },
  'claude-haiku-4-5':   { input: 0.8,  output: 4,   cacheRead: 0.08, cacheWrite: 1 },
};
const DEFAULT_CLAUDE_RATE = CLAUDE_RATES['claude-sonnet-4-6'];

function estimateCost(agent, model, inputTokens, outputTokens, cacheRead, cacheWrite) {
  if (agent !== 'Claude') return 0;
  const rate = CLAUDE_RATES[model] || DEFAULT_CLAUDE_RATE;
  return (
    (inputTokens  / 1_000_000) * rate.input +
    (outputTokens / 1_000_000) * rate.output +
    (cacheRead    / 1_000_000) * rate.cacheRead +
    (cacheWrite   / 1_000_000) * rate.cacheWrite
  );
}

// GET /api/code-agents/stats — aggregated per-agent totals
router.get('/stats', async (req, res) => {
  try {
    const db = await getDbConnection();
    const rows = await db.all(`
      SELECT
        agent,
        COUNT(*)                         AS session_count,
        COALESCE(SUM(duration_minutes), 0) AS total_minutes,
        COALESCE(SUM(input_tokens), 0)   AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0)  AS total_output_tokens,
        COALESCE(SUM(cache_read_tokens), 0)  AS total_cache_read_tokens,
        COALESCE(SUM(cache_write_tokens), 0) AS total_cache_write_tokens,
        COALESCE(SUM(total_cost_usd), 0) AS total_cost_usd
      FROM code_agent_sessions
      GROUP BY agent
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching code agent stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/code-agents — list sessions
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const conditions = [];
    const params = [];

    if (req.query.agent) {
      conditions.push('agent = ?');
      params.push(req.query.agent);
    }
    if (req.query.date_from) {
      conditions.push('session_date >= ?');
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      conditions.push('session_date <= ?');
      params.push(req.query.date_to);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const sessions = await db.all(
      `SELECT * FROM code_agent_sessions ${where} ORDER BY started_at DESC LIMIT 200`,
      params
    );
    res.json(sessions);
  } catch (err) {
    console.error('Error fetching code agent sessions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/code-agents — create session
router.post('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const {
      agent, session_date, started_at, ended_at,
      duration_minutes = 0,
      input_tokens = 0, output_tokens = 0,
      cache_read_tokens = 0, cache_write_tokens = 0,
      model, project_context, notes, source = 'manual'
    } = req.body;

    if (!agent || !session_date || !started_at) {
      return res.status(400).json({ error: 'agent, session_date, and started_at are required' });
    }

    const cost = estimateCost(agent, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens);
    // Allow caller to supply a stable id (e.g. import scripts) for deduplication
    const id = req.body.id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const result = await db.run(
      `INSERT OR IGNORE INTO code_agent_sessions
        (id, agent, session_date, started_at, ended_at, duration_minutes,
         input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         total_cost_usd, model, project_context, notes, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, agent, session_date, started_at, ended_at || null,
       duration_minutes, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
       cost, model || null, project_context || null, notes || null, source]
    );

    // changes === 0 means the id already existed (duplicate) — return 409
    if (result.changes === 0) {
      return res.status(409).json({ error: 'Session already imported', id });
    }

    const created = await db.get('SELECT * FROM code_agent_sessions WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) {
    console.error('Error creating code agent session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/code-agents/:id — update session
router.patch('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const allowed = [
      'ended_at', 'duration_minutes', 'input_tokens', 'output_tokens',
      'cache_read_tokens', 'cache_write_tokens', 'model', 'project_context', 'notes'
    ];
    const updates = [];
    const params = [];

    for (const key of allowed) {
      if (key in req.body) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    // Recompute cost if token fields changed
    const existing = await db.get('SELECT * FROM code_agent_sessions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Session not found' });

    const merged = { ...existing, ...req.body };
    const cost = estimateCost(
      merged.agent, merged.model,
      merged.input_tokens, merged.output_tokens,
      merged.cache_read_tokens, merged.cache_write_tokens
    );
    updates.push('total_cost_usd = ?');
    params.push(cost);

    params.push(req.params.id);
    await db.run(`UPDATE code_agent_sessions SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await db.get('SELECT * FROM code_agent_sessions WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error('Error updating code agent session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/code-agents/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM code_agent_sessions WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting code agent session:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
