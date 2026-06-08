const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const apiKey = process.env.OPENCODE_GO_API_KEY;
  const baseUrl = process.env.OPENCODE_GO_BASE_URL || 'https://opencode.ai/api/v1';
  const model = process.env.OPENCODE_GO_MODEL || 'gpt-4o';

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENCODE_GO_API_KEY is not configured.' });
  }

  const systemPrompt = `You are an Omni-Capture AI router. Parse the user's brain dump into structured operations.
You must return a raw JSON array of operations, with NO markdown formatting (no \`\`\`json).
Valid operation types:
- "task": { "title": "...", "date_due": "YYYY-MM-DD" (optional) }
- "pomodoro": { "title": "...", "duration_minutes": 25 }
- "distraction": { "content": "..." }
- "therapy": { "narrative": "...", "state": { "mood": "..." } }
- "habit": { "name": "..." }

Return an empty array [] if no operations found.

Example input: "I'm feeling really anxious today. I did a 25 minute pomodoro on my math homework, but I got distracted by Twitter. Also remind me to buy milk tomorrow."
Example output:
[
  { "type": "therapy", "data": { "narrative": "I'm feeling really anxious today.", "state": { "mood": "anxious" } } },
  { "type": "pomodoro", "data": { "title": "math homework", "duration_minutes": 25 } },
  { "type": "distraction", "data": { "content": "Twitter" } },
  { "type": "task", "data": { "title": "buy milk", "date_due": "tomorrow's date" } }
]`;

  try {
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.1
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[Omni] API Error:', aiResponse.status, errText);
      return res.status(502).json({ error: 'Failed to communicate with OpenCode GO API' });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || '[]';
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let operations = [];
    try {
      operations = JSON.parse(content);
    } catch (e) {
      console.error('[Omni] JSON Parse Error:', e, content);
      return res.status(500).json({ error: 'AI returned invalid JSON' });
    }

    const db = await getDbConnection();
    const results = [];
    const nowStr = new Date().toISOString();
    const todayStr = nowStr.split('T')[0];

    // Dispatch operations
    for (const op of operations) {
      if (op.type === 'task') {
        const id = newId('task');
        await db.run(
          `INSERT INTO tasks (id, title, status, received_date) VALUES (?, ?, ?, ?)`,
          [id, op.data.title, '01 - Inbox', nowStr]
        );
        results.push(`Added task: ${op.data.title}`);
      } else if (op.type === 'pomodoro') {
        const taskId = newId('task');
        await db.run(
          `INSERT INTO tasks (id, title, status, received_date) VALUES (?, ?, ?, ?)`,
          [taskId, op.data.title, '07 - Done', nowStr]
        );
        const pomId = newId('pom');
        await db.run(
          `INSERT INTO pomodoro_sessions (id, task_id, started_at, actual_duration_minutes, planned_duration_minutes, status) VALUES (?, ?, ?, ?, ?, ?)`,
          [pomId, taskId, nowStr, op.data.duration_minutes || 25, op.data.duration_minutes || 25, 'completed']
        );
        results.push(`Logged pomodoro: ${op.data.title}`);
      } else if (op.type === 'distraction') {
        // Just create a general distraction note mapped to a generic inbox task or similar.
        // Distractions need a task_id according to schema. We'll create a dummy one or use a general one.
        const taskId = newId('task');
        await db.run(
          `INSERT INTO tasks (id, title, status, received_date) VALUES (?, ?, ?, ?)`,
          [taskId, 'Distraction Placeholder', '07 - Done', nowStr]
        );
        const distId = newId('dist');
        await db.run(
          `INSERT INTO distraction_notes (id, task_id, content, created_at) VALUES (?, ?, ?, ?)`,
          [distId, taskId, op.data.content, nowStr]
        );
        results.push(`Logged distraction: ${op.data.content}`);
      } else if (op.type === 'therapy') {
        const id = newId('therapy');
        await db.run(
          `INSERT INTO therapy_entries (id, entry_date, narrative, state, actions_taken, reply_drafts, dimension_assessments) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, todayStr, op.data.narrative, JSON.stringify(op.data.state || {}), '[]', '[]', '{}']
        );
        results.push(`Logged therapy entry`);
      } else if (op.type === 'habit') {
        // We need habit_id, assuming we do a soft match
        const habits = await db.all('SELECT id, name FROM habits');
        const habit = habits.find(h => h.name.toLowerCase().includes(op.data.name.toLowerCase()));
        if (habit) {
          const logId = newId('hlog');
          await db.run(
            `INSERT INTO habit_logs (id, habit_id, logged_at, date_id, count, source) VALUES (?, ?, ?, ?, ?, ?)`,
            [logId, habit.id, nowStr, todayStr, 1, 'omni']
          );
          results.push(`Logged habit: ${habit.name}`);
        } else {
          results.push(`Unknown habit: ${op.data.name}`);
        }
      }
    }

    res.json({ success: true, results, operations });
  } catch (err) {
    console.error('[Omni] Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
