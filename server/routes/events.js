const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// Helper to generate a unique ID
function generateId() {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 1. GET /api/events?date=YYYY-MM-DD or GET /api/events?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// Returns { plan: [], measure: [] }
router.get('/', async (req, res) => {
  const { date, start_date, end_date } = req.query;
  if (!date && (!start_date || !end_date)) {
    return res.status(400).json({ error: 'Either date or (start_date and end_date) query parameters are required' });
  }

  try {
    const db = await getDbConnection();
    let rows;
    if (start_date && end_date) {
      rows = await db.all(
        `SELECT * FROM events 
         WHERE (date_string BETWEEN ? AND ?) 
            OR (rrule IS NOT NULL AND date_string <= ?) 
         ORDER BY date_string ASC, time_slot ASC`,
        [start_date, end_date, end_date]
      );
    } else {
      rows = await db.all(
        'SELECT * FROM events WHERE date_string = ? ORDER BY time_slot ASC',
        [date]
      );
    }

    const plan = rows.filter(row => row.column_type === 'plan');
    const measure = rows.filter(row => row.column_type === 'measure');

    // Fetch linked task IDs for each event
    const allEventIds = rows.map(r => r.id);
    let links = [];
    if (allEventIds.length > 0) {
      links = await db.all(
        `SELECT event_id, task_id FROM event_task_links WHERE event_id IN (${allEventIds.map(() => '?').join(',')})`,
        allEventIds
      );
    }

    const rowsWithLinks = rows.map(row => ({
      ...row,
      task_ids: links.filter(l => l.event_id === row.id).map(l => l.task_id)
    }));

    res.json({ 
      plan: rowsWithLinks.filter(r => r.column_type === 'plan'), 
      measure: rowsWithLinks.filter(r => r.column_type === 'measure') 
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1.5 GET /api/events/:id/tasks
// Returns all tasks linked to a specific event
router.get('/:id/tasks', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const tasks = await db.all(
      `SELECT t.* FROM tasks t
       JOIN event_task_links etl ON t.id = etl.task_id
       WHERE etl.event_id = ?`,
      [id]
    );
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching event tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1.6 POST /api/events/:id/tasks
// Link a task to an event
router.post('/:id/tasks', async (req, res) => {
  const { id } = req.params;
  const { task_id } = req.body;

  if (!task_id) {
    return res.status(400).json({ error: 'task_id is required' });
  }

  try {
    const db = await getDbConnection();
    await db.run(
      'INSERT OR IGNORE INTO event_task_links (event_id, task_id) VALUES (?, ?)',
      [id, task_id]
    );
    res.json({ message: 'Task linked successfully' });
  } catch (error) {
    console.error('Error linking task to event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1.7 DELETE /api/events/:id/tasks/:taskId
// Unlink a task from an event
router.delete('/:id/tasks/:taskId', async (req, res) => {
  const { id, taskId } = req.params;
  try {
    const db = await getDbConnection();
    await db.run(
      'DELETE FROM event_task_links WHERE event_id = ? AND task_id = ?',
      [id, taskId]
    );
    res.json({ message: 'Task unlinked successfully' });
  } catch (error) {
    console.error('Error unlinking task from event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. POST /api/events/sync-block
// UPSERT block. Inserts or updates an event based on block_signature or id.
router.post('/sync-block', async (req, res) => {
  const {
    id,
    block_signature,
    title,
    area,
    color_hex,
    date_string,
    time_slot,
    duration_mins,
    column_type,
    notes,
    is_cloned_checked,
    timezone,
    rrule
  } = req.body;

  if (!title || !date_string || !time_slot || !duration_mins || !column_type) {
    return res.status(400).json({ error: 'Missing required event fields' });
  }

  try {
    const db = await getDbConnection();
    const finalColumnType = column_type.toLowerCase();
    const finalBlockSignature = block_signature || `${date_string}_${time_slot}_${finalColumnType}`;

    // Color is owned by the area: when area is provided, always re-derive from it
    // so changing an event's category updates its color. Fall back to the sent
    // color_hex (or the neutral default) when no area is given.
    let finalColor = color_hex;
    if (area) {
      const areaRow = await db.get('SELECT color_hex FROM areas WHERE id = ?', [area]);
      if (areaRow) {
        finalColor = areaRow.color_hex;
      }
    }
    if (!finalColor) {
      finalColor = '#95A5A6'; // Default color
    }

    let existingEvent = null;

    // Check if ID is provided and exists
    if (id) {
      existingEvent = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    } else if (block_signature) {
      // Check by block signature if ID not provided
      existingEvent = await db.get('SELECT * FROM events WHERE block_signature = ?', [block_signature]);
    }

    if (existingEvent) {
      // Perform Update
      const eventId = existingEvent.id;
      await db.run(
        `UPDATE events
         SET title = ?, area = ?, color_hex = ?, date_string = ?, time_slot = ?, duration_mins = ?, column_type = ?, notes = ?, is_cloned_checked = ?, timezone = ?, rrule = ?
         WHERE id = ?`,
        [
          title,
          area || existingEvent.area,
          finalColor,
          date_string,
          time_slot,
          duration_mins,
          finalColumnType,
          notes !== undefined ? notes : existingEvent.notes,
          is_cloned_checked !== undefined ? is_cloned_checked : existingEvent.is_cloned_checked,
          timezone || existingEvent.timezone || 'America/Los_Angeles',
          rrule !== undefined ? rrule : existingEvent.rrule,
          eventId
        ]
      );
      const updated = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
      return res.json({ message: 'Event updated successfully', event: updated });
    } else {
      // Perform Insert
      const newId = id || generateId();
      await db.run(
        `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked, timezone, rrule)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          finalBlockSignature,
          title,
          area || 'general',
          finalColor,
          date_string,
          time_slot,
          duration_mins,
          finalColumnType,
          notes || '',
          is_cloned_checked || 0,
          timezone || 'America/Los_Angeles',
          rrule || null
        ]
      );
      const inserted = await db.get('SELECT * FROM events WHERE id = ?', [newId]);
      return res.status(201).json({ message: 'Event created successfully', event: inserted });
    }
  } catch (error) {
    console.error('Error syncing event block:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. POST /api/events/log-measure
// Spontaneous event logging in Measure column at a specific time
router.post('/log-measure', async (req, res) => {
  const { date_string, time_slot, duration_mins, title, area, notes, timezone } = req.body;

  if (!date_string || !time_slot || !duration_mins || !title) {
    return res.status(400).json({ error: 'Missing date_string, time_slot, duration_mins, or title' });
  }

  try {
    const db = await getDbConnection();
    const finalArea = area || 'general';

    // Get color hex for this area
    const areaRow = await db.get('SELECT color_hex FROM areas WHERE id = ?', [finalArea]);
    const colorHex = areaRow ? areaRow.color_hex : '#95A5A6';

    const newId = generateId();
    const blockSignature = `${date_string}_${time_slot}_measure`;

    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'measure', ?, 0, ?)`,
      [newId, blockSignature, title, finalArea, colorHex, date_string, time_slot, duration_mins, notes || '', timezone || 'America/Los_Angeles']
    );

    const inserted = await db.get('SELECT * FROM events WHERE id = ?', [newId]);
    res.status(201).json({ message: 'Measure logged successfully', event: inserted });
  } catch (error) {
    console.error('Error logging measure:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. POST /api/events/clone-plan
// Clones plan event to measure track and sets is_cloned_checked = 1
router.post('/clone-plan', async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'id of the plan event to clone is required' });
  }

  try {
    const db = await getDbConnection();

    // Find the plan event
    const planEvent = await db.get('SELECT * FROM events WHERE id = ? AND column_type = "plan"', [id]);
    if (!planEvent) {
      return res.status(404).json({ error: 'Planned event not found' });
    }

    // Set plan event's is_cloned_checked to 1
    await db.run('UPDATE events SET is_cloned_checked = 1 WHERE id = ?', [id]);

    // Create cloned measure event
    const newId = generateId();
    const newBlockSignature = `${planEvent.date_string}_${planEvent.time_slot}_measure`;

    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'measure', ?, 1, ?)`,
      [
        newId,
        newBlockSignature,
        planEvent.title,
        planEvent.area,
        planEvent.color_hex,
        planEvent.date_string,
        planEvent.time_slot,
        planEvent.duration_mins,
        planEvent.notes,
        planEvent.timezone || 'America/Los_Angeles'
      ]
    );

    const clonedEvent = await db.get('SELECT * FROM events WHERE id = ?', [newId]);
    const updatedPlanEvent = await db.get('SELECT * FROM events WHERE id = ?', [id]);

    // Copy task links
    const originalLinks = await db.all('SELECT task_id FROM event_task_links WHERE event_id = ?', [id]);
    for (const link of originalLinks) {
      await db.run(
        'INSERT OR IGNORE INTO event_task_links (event_id, task_id) VALUES (?, ?)',
        [newId, link.task_id]
      );
    }

    res.status(201).json({
      message: 'Plan cloned to measure track successfully',
      planEvent: updatedPlanEvent,
      measureEvent: clonedEvent
    });
  } catch (error) {
    console.error('Error cloning plan event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. DELETE /api/events/:id
// Simple event deletion
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM events WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
