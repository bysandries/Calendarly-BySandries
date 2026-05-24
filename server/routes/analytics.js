const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// GET /api/analytics/weekly-report
router.get('/weekly-report', async (req, res) => {
  let { start_date, end_date } = req.query;

  // Default range: last 7 days ending on the session reference date May 24, 2026 if not specified
  if (!start_date || !end_date) {
    const defaultEnd = new Date('2026-05-24T12:00:00Z');
    const defaultStart = new Date(defaultEnd);
    defaultStart.setDate(defaultEnd.getDate() - 6); // 7 days total

    if (!start_date) start_date = formatDate(defaultStart);
    if (!end_date) end_date = formatDate(defaultEnd);
  }

  console.log(`[Analytics] Generating report from ${start_date} to ${end_date}`);

  try {
    const db = await getDbConnection();

    // 1. Fetch Area Hours: Plan vs Measure for each area
    const areaHours = await db.all(`
      SELECT 
        a.id AS area_id, 
        a.name AS area_name, 
        a.color_hex,
        COALESCE(SUM(CASE WHEN e.column_type = 'plan' THEN e.duration_mins ELSE 0 END), 0) / 60.0 AS planned_hours,
        COALESCE(SUM(CASE WHEN e.column_type = 'measure' THEN e.duration_mins ELSE 0 END), 0) / 60.0 AS measured_hours
      FROM areas a
      LEFT JOIN events e ON a.id = e.area AND e.date_string BETWEEN ? AND ?
      GROUP BY a.id, a.name, a.color_hex
      ORDER BY a.name COLLATE NOCASE
    `, [start_date, end_date]);

    // 2. Fetch Sleep Alignment details specifically
    const sleepData = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN column_type = 'plan' THEN duration_mins ELSE 0 END), 0) / 60.0 AS planned_sleep,
        COALESCE(SUM(CASE WHEN column_type = 'measure' THEN duration_mins ELSE 0 END), 0) / 60.0 AS measured_sleep
      FROM events
      WHERE area = 'sleep' AND date_string BETWEEN ? AND ?
    `, [start_date, end_date]);

    const plannedSleep = sleepData?.planned_sleep || 0;
    const measuredSleep = sleepData?.measured_sleep || 0;
    const sleepAlignment = plannedSleep > 0 
      ? Math.min(Math.round((measuredSleep / plannedSleep) * 100), 200)
      : (measuredSleep > 0 ? 100 : 0);

    // 3. Fetch Task KPIs
    // Planned tasks: tasks due in this window
    const taskPlanned = await db.get(`
      SELECT 
        COALESCE(SUM(estimated_minutes), 0) / 60.0 AS hours,
        COUNT(*) AS count
      FROM tasks
      WHERE date_due BETWEEN ? AND ?
    `, [start_date, end_date]);

    // Completed tasks: tasks completed in this window (finished_date is within window)
    const taskCompleted = await db.get(`
      SELECT 
        COALESCE(SUM(estimated_minutes), 0) / 60.0 AS hours,
        COUNT(*) AS count
      FROM tasks
      WHERE status = '07 - Done' AND date(finished_date) BETWEEN ? AND ?
    `, [start_date, end_date]);

    // Event summary aggregates (total scheduled vs total done)
    const eventSummary = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN column_type = 'plan' THEN duration_mins ELSE 0 END), 0) / 60.0 AS planned_event_hours,
        COALESCE(SUM(CASE WHEN column_type = 'measure' THEN duration_mins ELSE 0 END), 0) / 60.0 AS measured_event_hours
      FROM events
      WHERE date_string BETWEEN ? AND ?
    `, [start_date, end_date]);

    // 4. Fetch Projects progression (all active and completed projects with task metrics)
    const projectsProgression = await db.all(`
      SELECT 
        p.id, 
        p.title, 
        p.status, 
        p.area, 
        p.pillar, 
        p.phase,
        COUNT(t.id) AS total_tasks,
        SUM(CASE WHEN t.status = '07 - Done' THEN 1 ELSE 0 END) AS completed_tasks,
        COALESCE(SUM(t.estimated_minutes), 0) / 60.0 AS total_estimated_hours,
        COALESCE(SUM(CASE WHEN t.status = '07 - Done' THEN t.estimated_minutes ELSE 0 END), 0) / 60.0 AS completed_hours
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id, p.title, p.status, p.area, p.pillar, p.phase
      ORDER BY p.status ASC, p.title COLLATE NOCASE
    `);

    res.json({
      start_date,
      end_date,
      areaHours,
      sleep: {
        planned: Number(plannedSleep.toFixed(1)),
        measured: Number(measuredSleep.toFixed(1)),
        alignment_percentage: sleepAlignment
      },
      tasks: {
        planned_due_hours: Number((taskPlanned?.hours || 0).toFixed(1)),
        planned_due_count: taskPlanned?.count || 0,
        completed_hours: Number((taskCompleted?.hours || 0).toFixed(1)),
        completed_count: taskCompleted?.count || 0
      },
      events: {
        planned_hours: Number((eventSummary?.planned_event_hours || 0).toFixed(1)),
        measured_hours: Number((eventSummary?.measured_event_hours || 0).toFixed(1))
      },
      projects: projectsProgression.map(proj => ({
        ...proj,
        total_estimated_hours: Number((proj.total_estimated_hours || 0).toFixed(1)),
        completed_hours: Number((proj.completed_hours || 0).toFixed(1)),
        progress_percentage: proj.total_tasks > 0 
          ? Math.round((proj.completed_tasks / proj.total_tasks) * 100)
          : 0
      }))
    });
  } catch (error) {
    console.error('Error generating weekly analytics report:', error);
    res.status(500).json({ error: 'Internal server error generating analytics report' });
  }
});

module.exports = router;
