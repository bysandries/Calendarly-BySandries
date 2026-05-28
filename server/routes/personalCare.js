const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

const PERSONAL_CARE_AREA = 'personal-care';
const SLEEP_AREA = 'sleep';
const SLEEP_GOAL_MINUTES = 7 * 60; // 420
const SLEEP_LOOKBACK_DAYS = 7;
const GOALS_LIMIT = 5;

// Mirror of TASK_STATS_JOIN in routes/projects.js, scoped to a single area.
const PROJECTS_WITH_STATS = `
  SELECT p.*,
    COALESCE(t.total_tasks, 0)                AS total_tasks,
    COALESCE(t.complete_tasks, 0)             AS complete_tasks,
    COALESCE(t.total_estimated_minutes, 0)    AS total_estimated_minutes,
    COALESCE(t.remaining_estimated_minutes, 0) AS remaining_estimated_minutes,
    COALESCE(ps.pomodoro_minutes, 0)          AS pomodoro_minutes
  FROM projects p
  LEFT JOIN (
    SELECT project_id,
      COUNT(*)                                                                    AS total_tasks,
      SUM(CASE WHEN status = '07 - Done' THEN 1 ELSE 0 END)                     AS complete_tasks,
      SUM(estimated_minutes)                                                      AS total_estimated_minutes,
      SUM(CASE WHEN status != '07 - Done' THEN estimated_minutes ELSE 0 END)    AS remaining_estimated_minutes
    FROM tasks
    GROUP BY project_id
  ) t ON t.project_id = p.id
  LEFT JOIN (
    SELECT tk.project_id,
      SUM(COALESCE(po.actual_duration_minutes, po.planned_duration_minutes, 0)) AS pomodoro_minutes
    FROM pomodoro_session_tasks tps
    JOIN pomodoro_sessions po ON po.id = tps.session_id
    JOIN tasks tk ON tk.id = tps.task_id
    WHERE tk.project_id IS NOT NULL AND po.status IN ('completed', 'abandoned')
    GROUP BY tk.project_id
  ) ps ON ps.project_id = p.id
  WHERE p.area = ? AND p.status != 'archived'
  ORDER BY
    CASE p.status WHEN 'active' THEN 0 WHEN 'on-hold' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
    p.due_date IS NULL, p.due_date ASC, p.title ASC
`;

function todayDateId(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDateId(dateId, deltaDays) {
  const [y, m, d] = dateId.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return todayDateId(dt);
}

// GET /api/personal-care/summary
// One-shot read used by the Personal Care dashboard.
router.get('/summary', async (req, res) => {
  try {
    const db = await getDbConnection();
    const today = todayDateId();
    const weekStart = shiftDateId(today, -(SLEEP_LOOKBACK_DAYS - 1));

    // 1. Next personal-care calendar event (plan column, today or later).
    const nextSession = await db.get(
      `SELECT id, title, date_string, time_slot, duration_mins, notes
       FROM events
       WHERE area = ? AND column_type = 'plan' AND date_string >= ?
       ORDER BY date_string ASC, time_slot ASC
       LIMIT 1`,
      [PERSONAL_CARE_AREA, today]
    );

    // 2. Sleep — 7-day rolling window from the measure column.
    const sleepRows = await db.all(
      `SELECT date_string AS date_id, SUM(duration_mins) AS minutes
       FROM events
       WHERE area = ? AND column_type = 'measure'
         AND date_string >= ? AND date_string <= ?
       GROUP BY date_string`,
      [SLEEP_AREA, weekStart, today]
    );
    const sleepByDate = new Map(sleepRows.map(r => [r.date_id, r.minutes || 0]));
    const sleepDaily = [];
    for (let i = 0; i < SLEEP_LOOKBACK_DAYS; i++) {
      const dateId = shiftDateId(weekStart, i);
      sleepDaily.push({ date_id: dateId, minutes: sleepByDate.get(dateId) || 0 });
    }
    const sleepTotal = sleepDaily.reduce((sum, d) => sum + d.minutes, 0);
    const sleepAvg = Math.round(sleepTotal / SLEEP_LOOKBACK_DAYS);

    // 3. Previous-session goals — extracts tagged with both "therapy" and "goal".
    const previousGoals = await db.all(
      `SELECT id, content, tags, created_at
       FROM extracts
       WHERE LOWER(tags) LIKE '%therapy%' AND LOWER(tags) LIKE '%goal%'
       ORDER BY created_at DESC
       LIMIT ?`,
      [GOALS_LIMIT]
    );

    // 4a. Habit build/quit counts (non-archived).
    const habitCounts = await db.all(
      `SELECT goal_type, COUNT(*) AS count
       FROM habits
       WHERE COALESCE(is_archived, 0) = 0
       GROUP BY goal_type`
    );
    const buildCount = (habitCounts.find(r => r.goal_type === 'build')?.count) || 0;
    const quitCount  = (habitCounts.find(r => r.goal_type === 'quit')?.count)  || 0;

    // 4b. Weekly completion across the 7-day window.
    //   - build habits: (habit, day) cells with at least one log → "completed"
    //   - quit habits:  (habit, day) cells with zero logs → "completed"
    const activeHabits = await db.all(
      `SELECT id, goal_type FROM habits WHERE COALESCE(is_archived, 0) = 0`
    );
    const logRows = await db.all(
      `SELECT habit_id, date_id, SUM(count) AS total
       FROM habit_logs
       WHERE date_id >= ? AND date_id <= ?
       GROUP BY habit_id, date_id`,
      [weekStart, today]
    );
    const loggedSet = new Set(logRows.filter(r => r.total > 0).map(r => `${r.habit_id}|${r.date_id}`));

    const days = sleepDaily.map(d => d.date_id);
    let buildSlots = 0, buildHit = 0, quitSlots = 0, quitHit = 0;
    for (const h of activeHabits) {
      for (const day of days) {
        const logged = loggedSet.has(`${h.id}|${day}`);
        if (h.goal_type === 'build') {
          buildSlots++;
          if (logged) buildHit++;
        } else if (h.goal_type === 'quit') {
          quitSlots++;
          if (!logged) quitHit++;
        }
      }
    }
    const buildPct = buildSlots ? Math.round((buildHit / buildSlots) * 100) : null;
    const quitPct  = quitSlots  ? Math.round((quitHit  / quitSlots)  * 100) : null;

    // 5. Personal-care projects with task stats.
    const projectRows = await db.all(PROJECTS_WITH_STATS, [PERSONAL_CARE_AREA]);
    const personalCareProjects = projectRows.map(p => ({
      ...p,
      goals_aligned: p.goals_aligned ? JSON.parse(p.goals_aligned) : [],
    }));

    res.json({
      generated_at: new Date().toISOString(),
      today,
      window: { start: weekStart, end: today, days: SLEEP_LOOKBACK_DAYS },
      next_session: nextSession || null,
      sleep_7d: {
        goal_minutes: SLEEP_GOAL_MINUTES,
        avg_minutes: sleepAvg,
        total_minutes: sleepTotal,
        daily: sleepDaily,
      },
      previous_goals: previousGoals,
      habit_ratio: {
        build: buildCount,
        quit: quitCount,
        weekly_completion: {
          build_pct: buildPct,
          quit_pct: quitPct,
        },
      },
      personal_care_projects: personalCareProjects,
    });
  } catch (error) {
    console.error('Error building personal-care summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
