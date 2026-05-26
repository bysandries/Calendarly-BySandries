const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

function generateId() {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateSeriesId() {
  return `series-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

// ── Simple RRULE expander (server-side) ──
// Supports FREQ=DAILY|WEEKLY|MONTHLY with INTERVAL, COUNT, UNTIL
function parseRRule(rruleStr) {
  const parts = {};
  rruleStr.split(';').forEach(p => {
    const [k, v] = p.split('=');
    if (k && v) parts[k.trim().toUpperCase()] = v.trim();
  });
  return parts;
}

function getDayIndex(dayName) {
  const map = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return map[dayName.toUpperCase()];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function formatISODate(date) {
  return date.toISOString().split('T')[0];
}

function expandRRuleDates(rruleStr, startDateStr) {
  const rule = parseRRule(rruleStr);
  const freq = rule.FREQ;
  const interval = parseInt(rule.INTERVAL, 10) || 1;
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : null;
  const until = rule.UNTIL ? rule.UNTIL : null;

  if (!count && !until) {
    throw new Error('Recurring events must specify COUNT or UNTIL');
  }

  const start = new Date(startDateStr + 'T00:00:00Z');
  const dates = [];
  let current = new Date(start);
  let occurrences = 0;
  const maxOccurrences = count || 1000; // safety cap when using UNTIL
  const untilDate = until ? new Date(until.substring(0, 4) + '-' + until.substring(4, 6) + '-' + until.substring(6, 8) + 'T23:59:59Z') : null;

  while (occurrences < maxOccurrences) {
    if (untilDate && current > untilDate) break;
    if (count && occurrences >= count) break;

    if (freq === 'DAILY') {
      dates.push(formatISODate(current));
      current = addDays(current, interval);
    } else if (freq === 'WEEKLY') {
      if (rule.BYDAY) {
        const days = rule.BYDAY.split(',').map(d => getDayIndex(d.trim()));
        // Generate all days in this week interval that match BYDAY
        const weekStart = new Date(current);
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        for (let w = 0; w < interval; w++) {
          for (const dayIdx of days.sort((a, b) => a - b)) {
            const d = new Date(weekStart);
            d.setUTCDate(d.getUTCDate() + dayIdx + (w * 7));
            if (d < start) continue;
            if (untilDate && d > untilDate) break;
            if (count && dates.length >= count) break;
            dates.push(formatISODate(d));
          }
          if (count && dates.length >= count) break;
        }
        current = addDays(weekStart, interval * 7);
      } else {
        dates.push(formatISODate(current));
        current = addDays(current, interval * 7);
      }
    } else if (freq === 'MONTHLY') {
      dates.push(formatISODate(current));
      current = addMonths(current, interval);
    } else {
      throw new Error(`Unsupported FREQ: ${freq}`);
    }

    occurrences = dates.length;
  }

  return dates;
}

// 1. GET /api/events
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
        'SELECT * FROM events WHERE date_string BETWEEN ? AND ? ORDER BY date_string ASC, time_slot ASC',
        [start_date, end_date]
      );
    } else {
      rows = await db.all(
        'SELECT * FROM events WHERE date_string = ? ORDER BY time_slot ASC',
        [date]
      );
    }

    const allEventIds = rows.map(r => r.id);
    let links = [];
    if (allEventIds.length > 0) {
      const placeholders = allEventIds.map(() => '?').join(',');
      links = await db.all(
        `SELECT event_id, task_id FROM event_task_links WHERE event_id IN (${placeholders})`,
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
    rrule,
    creator,
    participants
  } = req.body;

  if (!title || !date_string || !time_slot || !duration_mins || !column_type) {
    return res.status(400).json({ error: 'Missing required event fields' });
  }

  try {
    const db = await getDbConnection();
    const finalColumnType = column_type.toLowerCase();

    let finalColor = color_hex;
    if (area) {
      const areaRow = await db.get('SELECT color_hex FROM areas WHERE id = ?', [area]);
      if (areaRow) finalColor = areaRow.color_hex;
    }
    if (!finalColor) finalColor = '#95A5A6';

    let existingEvent = null;
    if (id) {
      existingEvent = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    } else if (block_signature) {
      existingEvent = await db.get('SELECT * FROM events WHERE block_signature = ?', [block_signature]);
    }

    // If updating an existing event, keep it simple (single row update)
    if (existingEvent) {
      const eventId = existingEvent.id;
      await db.run(
        `UPDATE events
         SET title = ?, area = ?, color_hex = ?, date_string = ?, time_slot = ?, duration_mins = ?, column_type = ?, notes = ?, is_cloned_checked = ?, timezone = ?, rrule = ?, creator = ?, participants = ?
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
          creator || existingEvent.creator || 'Manual',
          participants !== undefined ? participants : existingEvent.participants,
          eventId
        ]
      );
      const updated = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
      return res.json({ message: 'Event updated successfully', event: updated });
    }

    // New event creation
    // If rrule provided, materialize the series
    if (rrule) {
      let dates;
      try {
        dates = expandRRuleDates(rrule, date_string);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      const seriesId = generateSeriesId();
      const count = dates.length;
      const masterId = generateId();

      for (let i = 0; i < count; i++) {
        const occId = i === 0 ? masterId : generateId();
        const occBlockSig = `${dates[i]}_${time_slot}_${finalColumnType}_${Date.now()}_${i}`;
        await db.run(
          `INSERT INTO events
           (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked, timezone, rrule, series_id, is_series_master, series_index, series_count, creator, participants)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            occId,
            occBlockSig,
            title,
            area || 'general',
            finalColor,
            dates[i],
            time_slot,
            duration_mins,
            finalColumnType,
            notes || '',
            is_cloned_checked || 0,
            timezone || 'America/Los_Angeles',
            rrule,
            seriesId,
            i === 0 ? 1 : 0,
            i,
            count,
            creator || 'Manual',
            participants || null
          ]
        );
      }

      const master = await db.get('SELECT * FROM events WHERE id = ?', [masterId]);
      return res.status(201).json({ message: 'Recurring series created successfully', event: master });
    }

    // Single non-recurring event
    const newId = id || generateId();
    const finalBlockSignature = block_signature || `${date_string}_${time_slot}_${finalColumnType}`;
    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked, timezone, rrule, creator, participants)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        rrule || null,
        creator || 'Manual',
        participants || null
      ]
    );
    const inserted = await db.get('SELECT * FROM events WHERE id = ?', [newId]);
    return res.status(201).json({ message: 'Event created successfully', event: inserted });
  } catch (error) {
    console.error('Error syncing event block:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. PATCH /api/events/:id — update with scope
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { scope = 'single', title, area, color_hex, time_slot, duration_mins, notes, date_string, creator, participants } = req.body;

  try {
    const db = await getDbConnection();
    const event = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // If single scope or no series, just update this row
    if (scope === 'single' || !event.series_id) {
      const updates = [];
      const params = [];
      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (area !== undefined) { updates.push('area = ?'); params.push(area); }
      if (color_hex !== undefined) { updates.push('color_hex = ?'); params.push(color_hex); }
      if (time_slot !== undefined) { updates.push('time_slot = ?'); params.push(time_slot); }
      if (duration_mins !== undefined) { updates.push('duration_mins = ?'); params.push(duration_mins); }
      if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
      if (date_string !== undefined) { updates.push('date_string = ?'); params.push(date_string); }
      if (creator !== undefined) { updates.push('creator = ?'); params.push(creator); }
      if (participants !== undefined) { updates.push('participants = ?'); params.push(participants); }

      if (event.series_id) {
        // Break away from series
        updates.push('series_id = ?'); params.push(null);
        updates.push('is_series_master = ?'); params.push(0);
        updates.push('series_index = ?'); params.push(0);
        updates.push('series_count = ?'); params.push(0);
        updates.push('rrule = ?'); params.push(null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(id);
      await db.run(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`, params);
      const updated = await db.get('SELECT * FROM events WHERE id = ?', [id]);
      return res.json({ message: 'Event updated successfully', event: updated });
    }

    // scope === 'series' or 'forward' — update multiple rows
    const updates = [];
    const params = [];
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (area !== undefined) { updates.push('area = ?'); params.push(area); }
    if (color_hex !== undefined) { updates.push('color_hex = ?'); params.push(color_hex); }
    if (time_slot !== undefined) { updates.push('time_slot = ?'); params.push(time_slot); }
    if (duration_mins !== undefined) { updates.push('duration_mins = ?'); params.push(duration_mins); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (creator !== undefined) { updates.push('creator = ?'); params.push(creator); }
    if (participants !== undefined) { updates.push('participants = ?'); params.push(participants); }

    if (updates.length === 0 && date_string === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (scope === 'series') {
      // Update ALL rows in this series
      if (date_string !== undefined) {
        // For series-wide date changes, we need to shift each occurrence relative to the master
        const master = await db.get('SELECT * FROM events WHERE series_id = ? AND is_series_master = 1', [event.series_id]);
        const allRows = await db.all('SELECT * FROM events WHERE series_id = ? ORDER BY series_index ASC', [event.series_id]);
        const baseDate = new Date(master.date_string + 'T00:00:00Z');
        const newBaseDate = new Date(date_string + 'T00:00:00Z');
        const dayDiff = Math.round((newBaseDate - baseDate) / (1000 * 60 * 60 * 24));

        for (const row of allRows) {
          const rowDate = new Date(row.date_string + 'T00:00:00Z');
          const shifted = new Date(rowDate);
          shifted.setUTCDate(shifted.getUTCDate() + dayDiff);
          const shiftedStr = shifted.toISOString().split('T')[0];
          await db.run(
            `UPDATE events SET date_string = ?, time_slot = ? ${updates.length ? ', ' + updates.join(', ') : ''} WHERE id = ?`,
            [shiftedStr, time_slot !== undefined ? time_slot : row.time_slot, ...params.map(() => row.id).flat(), row.id]
          );
        }
      } else {
        const setClause = updates.join(', ');
        const allParams = [...params, event.series_id];
        await db.run(`UPDATE events SET ${setClause} WHERE series_id = ?`, allParams);
      }
    } else if (scope === 'forward') {
      // Update this row and all rows with series_index >= this row's index
      if (date_string !== undefined) {
        const master = await db.get('SELECT * FROM events WHERE series_id = ? AND is_series_master = 1', [event.series_id]);
        const targetRows = await db.all(
          'SELECT * FROM events WHERE series_id = ? AND series_index >= ? ORDER BY series_index ASC',
          [event.series_id, event.series_index]
        );
        const baseDate = new Date(master.date_string + 'T00:00:00Z');
        const newBaseDate = new Date(date_string + 'T00:00:00Z');
        const dayDiff = Math.round((newBaseDate - baseDate) / (1000 * 60 * 60 * 24));

        for (const row of targetRows) {
          const rowDate = new Date(row.date_string + 'T00:00:00Z');
          const shifted = new Date(rowDate);
          shifted.setUTCDate(shifted.getUTCDate() + dayDiff);
          const shiftedStr = shifted.toISOString().split('T')[0];
          await db.run(
            `UPDATE events SET date_string = ?, time_slot = ? ${updates.length ? ', ' + updates.join(', ') : ''} WHERE id = ?`,
            [shiftedStr, time_slot !== undefined ? time_slot : row.time_slot, ...params.map(() => row.id).flat(), row.id]
          );
        }
      } else {
        const setClause = updates.join(', ');
        const allParams = [...params, event.series_id, event.series_index];
        await db.run(`UPDATE events SET ${setClause} WHERE series_id = ? AND series_index >= ?`, allParams);
      }
    }

    const updated = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    res.json({ message: 'Series updated successfully', event: updated });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. POST /api/events/log-measure
router.post('/log-measure', async (req, res) => {
  const { date_string, time_slot, duration_mins, title, area, notes, timezone, creator, participants } = req.body;
  if (!date_string || !time_slot || !duration_mins || !title) {
    return res.status(400).json({ error: 'Missing date_string, time_slot, duration_mins, or title' });
  }
  try {
    const db = await getDbConnection();
    const finalArea = area || 'general';
    const areaRow = await db.get('SELECT color_hex FROM areas WHERE id = ?', [finalArea]);
    const colorHex = areaRow ? areaRow.color_hex : '#95A5A6';
    const newId = generateId();
    const blockSignature = `${date_string}_${time_slot}_measure`;
    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked, timezone, creator, participants)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'measure', ?, 0, ?, ?, ?)`,
      [newId, blockSignature, title, finalArea, colorHex, date_string, time_slot, duration_mins, notes || '', timezone || 'America/Los_Angeles', creator || 'Manual', participants || null]
    );
    const inserted = await db.get('SELECT * FROM events WHERE id = ?', [newId]);
    res.status(201).json({ message: 'Measure logged successfully', event: inserted });
  } catch (error) {
    console.error('Error logging measure:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. POST /api/events/clone-plan
router.post('/clone-plan', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id of the plan event to clone is required' });
  }
  try {
    const db = await getDbConnection();
    const planEvent = await db.get('SELECT * FROM events WHERE id = ? AND column_type = "plan"', [id]);
    if (!planEvent) {
      return res.status(404).json({ error: 'Planned event not found' });
    }
    await db.run('UPDATE events SET is_cloned_checked = 1 WHERE id = ?', [id]);
    const newId = generateId();
    const newBlockSignature = `${planEvent.date_string}_${planEvent.time_slot}_measure`;
    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked, timezone, creator, participants)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'measure', ?, 1, ?, ?, ?)`,
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
        planEvent.timezone || 'America/Los_Angeles',
        planEvent.creator || 'Manual',
        planEvent.participants || null
      ]
    );
    const clonedEvent = await db.get('SELECT * FROM events WHERE id = ?', [newId]);
    const updatedPlanEvent = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    const originalLinks = await db.all('SELECT task_id FROM event_task_links WHERE event_id = ?', [id]);
    for (const link of originalLinks) {
      await db.run('INSERT OR IGNORE INTO event_task_links (event_id, task_id) VALUES (?, ?)', [newId, link.task_id]);
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

// 6. DELETE /api/events/:id — with scope
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { scope = 'single' } = req.query;

  try {
    const db = await getDbConnection();
    const event = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (scope === 'series' && event.series_id) {
      await db.run('DELETE FROM events WHERE series_id = ?', [event.series_id]);
      res.json({ message: 'Series deleted successfully' });
    } else {
      await db.run('DELETE FROM events WHERE id = ?', [id]);
      res.json({ message: 'Event deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
