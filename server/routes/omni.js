const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

router.post('/analyze', async (req, res) => {
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
- "memory": { "content": "...", "date": "YYYY-MM-DD" (optional) }

For ALL operations, if a person is mentioned, include:
"people_mentioned": ["First Name"] or ["First Last"]

Return an empty array [] if no operations found.

Example input: "Talked to John Smith. We have a meeting tomorrow. Also I remember going to the beach in 2015."
Example output:
[
  { "type": "task", "data": { "title": "Meeting with John Smith", "date_due": "tomorrow's date", "people_mentioned": ["John Smith"] } },
  { "type": "memory", "data": { "content": "Going to the beach", "date": "2015-01-01", "people_mentioned": [] } }
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
    
    // Check for ambiguities
    const ambiguities = {};
    const exactMatches = {};
    const newPeople = {};

    const allMentioned = new Set();
    for (const op of operations) {
      if (Array.isArray(op.data?.people_mentioned)) {
        for (const p of op.data.people_mentioned) allMentioned.add(p);
      }
    }

    for (const personName of Array.from(allMentioned)) {
      const matches = await db.all('SELECT id, name FROM people WHERE LOWER(name) LIKE LOWER(?)', [`%${personName}%`]);
      if (matches.length === 0) {
        newPeople[personName] = true;
      } else if (matches.length === 1) {
        exactMatches[personName] = matches[0].id;
      } else {
        ambiguities[personName] = matches;
      }
    }

    if (Object.keys(ambiguities).length > 0) {
      return res.status(409).json({
        requires_disambiguation: true,
        ambiguities,
        exactMatches,
        newPeople,
        operations,
        text
      });
    }

    // If no ambiguities, we could execute directly, but let's just return success so frontend calls execute
    // Actually, to save a round trip if there are no ambiguities, let's just tell frontend it's ready to execute
    // or we can just pass the data back to frontend, and frontend will call execute immediately.
    res.json({ success: true, ready_to_execute: true, operations, text, exactMatches, newPeople });

  } catch (err) {
    console.error('[Omni Analyze] Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  const { text, operations, resolvedPeopleMap, newPeopleToCreate } = req.body;
  if (!operations) return res.status(400).json({ error: 'Operations required' });

  try {
    const db = await getDbConnection();
    const results = [];
    const createdEntities = [];
    const nowStr = new Date().toISOString();
    const todayStr = nowStr.split('T')[0];
    
    // 1. Create new people
    const personIdMap = { ...resolvedPeopleMap };
    for (const newName of (newPeopleToCreate || [])) {
      const pId = newId('person');
      await db.run('INSERT INTO people (id, name, created_at) VALUES (?, ?, ?)', [pId, newName, nowStr]);
      personIdMap[newName] = pId;
    }

    // 2. Dispatch operations
    for (const op of operations) {
      let entityId = null;
      let entityType = null;

      if (op.type === 'task') {
        entityId = newId('task');
        entityType = 'task';
        await db.run(
          `INSERT INTO tasks (id, title, status, received_date) VALUES (?, ?, ?, ?)`,
          [entityId, op.data.title, '01 - Inbox', nowStr]
        );
        results.push(`Added task: ${op.data.title}`);
      } else if (op.type === 'pomodoro') {
        const taskId = newId('task');
        await db.run(
          `INSERT INTO tasks (id, title, status, received_date) VALUES (?, ?, ?, ?)`,
          [taskId, op.data.title, '07 - Done', nowStr]
        );
        const pomId = newId('pom');
        entityId = pomId;
        entityType = 'pomodoro';
        await db.run(
          `INSERT INTO pomodoro_sessions (id, task_id, started_at, actual_duration_minutes, planned_duration_minutes, status) VALUES (?, ?, ?, ?, ?, ?)`,
          [pomId, taskId, nowStr, op.data.duration_minutes || 25, op.data.duration_minutes || 25, 'completed']
        );
        results.push(`Logged pomodoro: ${op.data.title}`);
        createdEntities.push({ type: 'task', id: taskId }); // Also track the task
      } else if (op.type === 'distraction') {
        const taskId = newId('task');
        await db.run(
          `INSERT INTO tasks (id, title, status, received_date) VALUES (?, ?, ?, ?)`,
          [taskId, 'Distraction Placeholder', '07 - Done', nowStr]
        );
        const distId = newId('dist');
        entityId = distId;
        entityType = 'distraction';
        await db.run(
          `INSERT INTO distraction_notes (id, task_id, content, created_at) VALUES (?, ?, ?, ?)`,
          [distId, taskId, op.data.content, nowStr]
        );
        results.push(`Logged distraction: ${op.data.content}`);
        createdEntities.push({ type: 'task', id: taskId });
      } else if (op.type === 'therapy') {
        entityId = newId('therapy');
        entityType = 'therapy';
        await db.run(
          `INSERT INTO therapy_entries (id, entry_date, narrative, state, actions_taken, reply_drafts, dimension_assessments) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entityId, todayStr, op.data.narrative, JSON.stringify(op.data.state || {}), '[]', '[]', '{}']
        );
        results.push(`Logged therapy entry`);
      } else if (op.type === 'habit') {
        const habits = await db.all('SELECT id, name FROM habits');
        const habit = habits.find(h => h.name.toLowerCase().includes(op.data.name.toLowerCase()));
        if (habit) {
          const logId = newId('hlog');
          entityId = logId;
          entityType = 'habit_log';
          await db.run(
            `INSERT INTO habit_logs (id, habit_id, logged_at, date_id, count, source) VALUES (?, ?, ?, ?, ?, ?)`,
            [logId, habit.id, nowStr, todayStr, 1, 'omni']
          );
          results.push(`Logged habit: ${habit.name}`);
        } else {
          results.push(`Unknown habit: ${op.data.name}`);
        }
      } else if (op.type === 'memory') {
        entityId = newId('memory');
        entityType = 'memory';
        await db.run(
          `INSERT INTO memories (id, content, memory_date, created_at) VALUES (?, ?, ?, ?)`,
          [entityId, op.data.content, op.data.date || todayStr, nowStr]
        );
        results.push(`Logged memory`);
      }

      if (entityId) {
        createdEntities.push({ type: entityType, id: entityId });
        // Link to people
        if (Array.isArray(op.data?.people_mentioned)) {
          for (const pName of op.data.people_mentioned) {
            const pId = personIdMap[pName];
            if (pId) {
              await db.run(
                'INSERT OR IGNORE INTO entity_people_links (entity_type, entity_id, person_id) VALUES (?, ?, ?)',
                [entityType, entityId, pId]
              );
            }
          }
        }
      }
    }

    // Save history
    const logId = newId('omni_log');
    await db.run(
      `INSERT INTO omni_logs (id, prompt, raw_json, created_entities, is_hidden, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, text, JSON.stringify(operations), JSON.stringify(createdEntities), 0, nowStr]
    );

    res.json({ success: true, results, operations, createdEntities });
  } catch (err) {
    console.error('[Omni Execute] Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const db = await getDbConnection();
    const logs = await db.all('SELECT * FROM omni_logs WHERE is_hidden = 0 ORDER BY created_at DESC');
    
    // We need to verify if the entities still exist or are soft deleted
    for (const log of logs) {
      const entities = JSON.parse(log.created_entities);
      for (const ent of entities) {
        if (ent.type === 'task') {
          const t = await db.get('SELECT id FROM tasks WHERE id = ?', [ent.id]);
          const dt = await db.get('SELECT id FROM deleted_tasks WHERE id = ?', [ent.id]);
          ent.exists = !!t;
          ent.soft_deleted = !!dt;
        } else if (ent.type === 'pomodoro') {
          const p = await db.get('SELECT id FROM pomodoro_sessions WHERE id = ?', [ent.id]);
          ent.exists = !!p;
          ent.soft_deleted = false;
        } else if (ent.type === 'therapy') {
          const p = await db.get('SELECT id FROM therapy_entries WHERE id = ?', [ent.id]);
          ent.exists = !!p;
          ent.soft_deleted = false;
        } else if (ent.type === 'distraction') {
          const d = await db.get('SELECT id FROM distraction_notes WHERE id = ?', [ent.id]);
          ent.exists = !!d;
          ent.soft_deleted = false;
        } else if (ent.type === 'habit_log') {
          const h = await db.get('SELECT id FROM habit_logs WHERE id = ?', [ent.id]);
          ent.exists = !!h;
          ent.soft_deleted = false;
        }
      }
      log.created_entities = JSON.stringify(entities);
    }
    
    res.json(logs);
  } catch (err) {
    console.error('[Omni History] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/entity/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  try {
    const db = await getDbConnection();
    
    if (type === 'task') {
      const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
      if (task) {
        await db.run(
          `INSERT OR REPLACE INTO deleted_tasks
             (id, title, status, project_id, date_due, priority, notes, estimated_minutes,
              received_date, finished_date, is_starred, person_id, stage_week, categoria, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            task.id, task.title, task.status, task.project_id, task.date_due,
            task.priority, task.notes, task.estimated_minutes, task.received_date,
            task.finished_date, task.is_starred, task.person_id,
            task.stage_week || null, task.categoria || null,
            new Date().toISOString()
          ]
        );
        await db.run('DELETE FROM tasks WHERE id = ?', [id]);
      }
    } else if (type === 'pomodoro') {
      await db.run('DELETE FROM pomodoro_sessions WHERE id = ?', [id]);
    } else if (type === 'therapy') {
      await db.run('DELETE FROM therapy_entries WHERE id = ?', [id]);
    } else if (type === 'distraction') {
      await db.run('DELETE FROM distraction_notes WHERE id = ?', [id]);
    } else if (type === 'habit_log') {
      await db.run('DELETE FROM habit_logs WHERE id = ?', [id]);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('[Omni Entity] DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/memories', async (req, res) => {
  try {
    const db = await getDbConnection();
    const memories = await db.all('SELECT * FROM memories ORDER BY created_at DESC');
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
