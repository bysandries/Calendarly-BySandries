const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../db');

const TASK_STATS_JOIN = `
  SELECT p.*,
    COALESCE(t.total_tasks, 0)                AS total_tasks,
    COALESCE(t.complete_tasks, 0)             AS complete_tasks,
    COALESCE(t.total_estimated_minutes, 0)    AS total_estimated_minutes,
    COALESCE(t.remaining_estimated_minutes, 0) AS remaining_estimated_minutes
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
`;

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();
    const projects = await db.all(TASK_STATS_JOIN);
    const parsedProjects = projects.map(p => ({
      ...p,
      goals_aligned: p.goals_aligned ? JSON.parse(p.goals_aligned) : []
    }));
    res.json(parsedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  const {
    id,
    title,
    status,
    area,
    pillar,
    methodology,
    phase,
    goals_aligned,
    description,
    person_in_charge,
    due_date,
    start_date,
    end_date,
  } = req.body;

  if (!title || !status || !area || !pillar || !phase) {
    return res.status(400).json({ error: 'title, status, area, pillar, and phase are required' });
  }

  const projectId = id || `project-${Date.now()}`;
  const finalGoals = Array.isArray(goals_aligned) ? JSON.stringify(goals_aligned) : JSON.stringify([]);

  try {
    const db = await getDbConnection();
    await db.run(
      `INSERT INTO projects
         (id, title, status, area, pillar, methodology, phase, goals_aligned, description,
          person_in_charge, due_date, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId, title, status, area, pillar,
        methodology || 'PALM', phase, finalGoals, description || '',
        person_in_charge || null, due_date || null, start_date || null, end_date || null,
      ]
    );

    const project = await db.get(
      `${TASK_STATS_JOIN} WHERE p.id = ?`,
      [projectId]
    );
    res.status(201).json({
      ...project,
      goals_aligned: JSON.parse(project.goals_aligned)
    });
  } catch (error) {
    console.error('Error creating project:', error);
    if (error.message.includes('CHECK constraint failed')) {
      return res.status(400).json({ error: 'Constraint violation (check valid status, pillar, and phase values)' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const db = await getDbConnection();
    const existing = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const merged = { ...existing, ...updates };
    const goalsAligned = Array.isArray(merged.goals_aligned)
      ? JSON.stringify(merged.goals_aligned)
      : (typeof merged.goals_aligned === 'string' && merged.goals_aligned.startsWith('[')
        ? merged.goals_aligned
        : JSON.stringify([]));

    await db.run(
      `UPDATE projects
       SET title = ?, status = ?, area = ?, pillar = ?, methodology = ?, phase = ?,
           goals_aligned = ?, description = ?,
           person_in_charge = ?, due_date = ?, start_date = ?, end_date = ?
       WHERE id = ?`,
      [
        merged.title, merged.status, merged.area, merged.pillar,
        merged.methodology, merged.phase, goalsAligned, merged.description,
        merged.person_in_charge || null, merged.due_date || null,
        merged.start_date || null, merged.end_date || null,
        id,
      ]
    );

    const updated = await db.get(
      `${TASK_STATS_JOIN} WHERE p.id = ?`,
      [id]
    );
    res.json({
      ...updated,
      goals_aligned: updated.goals_aligned ? JSON.parse(updated.goals_aligned) : []
    });
  } catch (error) {
    console.error('Error updating project:', error);
    if (error.message.includes('CHECK constraint failed')) {
      return res.status(400).json({ error: 'Constraint violation (check valid status, pillar, and phase values)' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id
// - Non-archived project → moves to 'archived' status (soft delete)
// - Archived project     → moves project + its tasks to deleted_* tables, then hard-deletes
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDbConnection();
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'archived') {
      await db.run("UPDATE projects SET status = 'archived' WHERE id = ?", [id]);
      const archived = await db.get(
        `${TASK_STATS_JOIN} WHERE p.id = ?`,
        [id]
      );
      return res.json({
        action: 'archived',
        project: { ...archived, goals_aligned: archived.goals_aligned ? JSON.parse(archived.goals_aligned) : [] }
      });
    }

    // Second delete (already archived): move everything to deleted tables
    const deletedAt = new Date().toISOString();
    const tasks = await db.all('SELECT * FROM tasks WHERE project_id = ?', [id]);

    await db.run('BEGIN');
    try {
      for (const task of tasks) {
        await db.run(
          `INSERT INTO deleted_tasks (id, title, status, project_id, date_due, priority, notes, deleted_at, deleted_with_project_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [task.id, task.title, task.status, task.project_id, task.date_due, task.priority, task.notes, deletedAt, id]
        );
        await db.run('DELETE FROM tasks WHERE id = ?', [task.id]);
      }

      await db.run(
        `INSERT INTO deleted_projects
           (id, title, status, area, pillar, methodology, phase, goals_aligned, description,
            person_in_charge, due_date, start_date, end_date, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id, project.title, project.status, project.area, project.pillar,
          project.methodology, project.phase, project.goals_aligned, project.description,
          project.person_in_charge || null, project.due_date || null,
          project.start_date || null, project.end_date || null,
          deletedAt,
        ]
      );
      await db.run('DELETE FROM projects WHERE id = ?', [id]);

      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }

    res.json({ action: 'deleted', tasksRemoved: tasks.length });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
