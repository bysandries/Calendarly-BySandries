const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const { getDbConnection } = require('../db');

function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/export  — streams a .zip with tasks.csv, projects.json, notes/*.md, extracts/*.md
router.get('/', async (req, res) => {
  try {
    const db = await getDbConnection();

    const [tasks, projects, notes, extracts] = await Promise.all([
      db.all('SELECT * FROM tasks ORDER BY received_date DESC'),
      db.all('SELECT * FROM projects ORDER BY title ASC'),
      db.all('SELECT * FROM notes ORDER BY title ASC'),
      db.all('SELECT * FROM extracts ORDER BY created_at DESC'),
    ]);

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="calendarly-export-${date}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    // ── tasks.csv ──
    const taskCols = ['id','title','status','project_id','date_due','priority','estimated_minutes','notes','received_date','finished_date','is_starred','person_id'];
    const csvLines = [taskCols.join(',')];
    for (const t of tasks) {
      csvLines.push(taskCols.map(c => escapeCsv(t[c])).join(','));
    }
    archive.append(csvLines.join('\n'), { name: 'tasks.csv' });

    // ── projects.json ──
    archive.append(JSON.stringify(projects, null, 2), { name: 'projects.json' });

    // ── notes/*.md ──
    for (const note of notes) {
      const slug = (note.title || `note-${note.id}`)
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase()
        .slice(0, 60);
      const md = [
        '---',
        `title: ${note.title || ''}`,
        `type: ${note.type || ''}`,
        `tags: ${note.tags || ''}`,
        `linked_task_id: ${note.linked_task_id || ''}`,
        `created_at: ${note.created_at || ''}`,
        '---',
        '',
        note.content || '',
      ].join('\n');
      archive.append(md, { name: `notes/${slug}-${note.id.slice(-6)}.md` });
    }

    // ── extracts/*.md ──
    for (const ex of extracts) {
      const md = [
        '---',
        `bibliography: ${ex.bibliography || ''}`,
        `chapter_section: ${ex.chapter_section || ''}`,
        `tags: ${ex.tags || ''}`,
        `highlight_color: ${ex.highlight_color || ''}`,
        `created_at: ${ex.created_at || ''}`,
        '---',
        '',
        ex.content || '',
      ].join('\n');
      archive.append(md, { name: `extracts/extract-${ex.id}.md` });
    }

    archive.finalize();
  } catch (error) {
    console.error('Export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed' });
    }
  }
});

module.exports = router;
