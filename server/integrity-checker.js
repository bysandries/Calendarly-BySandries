const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { open } = require('sqlite');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const { closeDbConnection } = require('./db');

const DB_FILENAME = 'calendarly.db';
const ACTIVE_DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, DB_FILENAME);
const LOCAL_BACKUP_DIR = path.join(__dirname, 'backups');
const encryptionKey = process.env.DB_ENCRYPTION_KEY;

// Finds the absolute best backup (highest task count) to use as reference
async function findGoldenBackup() {
  if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
    throw new Error(`Backups directory not found at ${LOCAL_BACKUP_DIR}`);
  }

  const files = fs.readdirSync(LOCAL_BACKUP_DIR)
    .filter(file => file.startsWith('calendarly_') && file.endsWith('.db'))
    .sort();

  if (files.length === 0) {
    return null;
  }

  let goldenBackupPath = null;
  let maxTasks = -1;
  let goldenDetails = null;

  for (const file of files) {
    const filePath = path.join(LOCAL_BACKUP_DIR, file);
    let db;
    try {
      db = await open({
        filename: filePath,
        driver: sqlite3.Database
      });

      // Unlock DB
      await db.run(`PRAGMA key = ${JSON.stringify(encryptionKey)}`);
      
      // Verify schema and count tasks
      const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
      if (tables.some(t => t.name === 'tasks')) {
        const res = await db.get("SELECT COUNT(*) as count FROM tasks");
        const taskCount = res.count;
        
        let projectCount = 0;
        if (tables.some(t => t.name === 'projects')) {
          const projRes = await db.get("SELECT COUNT(*) as count FROM projects");
          projectCount = projRes.count;
        }

        // We choose the one with the maximum task count.
        // If there's a tie, we prefer the newer timestamp file.
        if (taskCount > maxTasks || (taskCount === maxTasks && taskCount >= 0)) {
          maxTasks = taskCount;
          goldenBackupPath = filePath;
          goldenDetails = {
            filename: file,
            tasks: taskCount,
            projects: projectCount
          };
        }
      }
    } catch (err) {
      // Ignore reading errors for corrupted files, just proceed
    } finally {
      if (db) {
        await db.close();
      }
    }
  }

  return { path: goldenBackupPath, details: goldenDetails };
}

// Compares the active database against the golden backup
async function runIntegrityCheck(options = { checkOnly: false }) {
  if (!encryptionKey) {
    return {
      healthy: false,
      error: 'DB_ENCRYPTION_KEY environment variable is not defined in server/.env.',
      restored: false,
      problems: []
    };
  }

  console.log('🔍 Locating Golden Reference Backup...');
  const golden = await findGoldenBackup();

  if (!golden || !golden.path) {
    console.log('⚠️ No valid backups found to compare against.');
    return {
      healthy: true,
      message: 'No valid backups found to run integrity comparison.',
      problems: []
    };
  }

  console.log(`⭐ Golden Backup identified: ${golden.details.filename} (${golden.details.tasks} tasks, ${golden.details.projects} projects)`);

  let activeDb;
  let backupDb;
  const problems = [];

  try {
    // Open Golden Backup
    backupDb = await open({
      filename: golden.path,
      driver: sqlite3.Database
    });
    await backupDb.run(`PRAGMA key = ${JSON.stringify(encryptionKey)}`);

    // Open Active DB
    activeDb = await open({
      filename: ACTIVE_DB_PATH,
      driver: sqlite3.Database
    });
    await activeDb.run(`PRAGMA key = ${JSON.stringify(encryptionKey)}`);

    // 1. Fetch Golden records
    const goldenTasks = await backupDb.all("SELECT id, title FROM tasks");
    const goldenProjects = await backupDb.all("SELECT id, title FROM projects");
    const goldenNotes = await backupDb.all("SELECT id, title FROM notes");
    const goldenEvents = await backupDb.all("SELECT id, title FROM events");
    const goldenAreas = await backupDb.all("SELECT id, name FROM areas");
    const goldenDailyLogs = await backupDb.all("SELECT id, date_id FROM DailyLogs");

    // 2. Fetch Active main + soft-delete records
    const activeTasksList = await activeDb.all("SELECT id FROM tasks");
    const activeDeletedTasksList = await activeDb.all("SELECT id FROM deleted_tasks");
    const activeTasksSet = new Set([
      ...activeTasksList.map(t => t.id),
      ...activeDeletedTasksList.map(t => t.id)
    ]);

    const activeProjectsList = await activeDb.all("SELECT id FROM projects");
    const activeDeletedProjectsList = await activeDb.all("SELECT id FROM deleted_projects");
    const activeProjectsSet = new Set([
      ...activeProjectsList.map(p => p.id),
      ...activeDeletedProjectsList.map(p => p.id)
    ]);

    const activeNotesList = await activeDb.all("SELECT id FROM notes");
    const activeNotesSet = new Set(activeNotesList.map(n => n.id));

    const activeEventsList = await activeDb.all("SELECT id FROM events");
    const activeEventsSet = new Set(activeEventsList.map(e => e.id));

    const activeAreasList = await activeDb.all("SELECT id FROM areas");
    const activeAreasSet = new Set(activeAreasList.map(a => a.id));

    const activeDailyLogsList = await activeDb.all("SELECT id FROM DailyLogs");
    const activeDailyLogsSet = new Set(activeDailyLogsList.map(d => d.id));

    // 3. Compare Tasks (must exist in either tasks or deleted_tasks)
    for (const task of goldenTasks) {
      if (!activeTasksSet.has(task.id)) {
        problems.push({
          table: 'tasks',
          id: task.id,
          description: `Task "${task.title}" was physically deleted/lost from the database.`
        });
      }
    }

    // 4. Compare Projects (must exist in either projects or deleted_projects)
    for (const proj of goldenProjects) {
      if (!activeProjectsSet.has(proj.id)) {
        problems.push({
          table: 'projects',
          id: proj.id,
          description: `Project "${proj.title}" was physically deleted/lost from the database.`
        });
      }
    }

    // 5. Compare Notes
    for (const note of goldenNotes) {
      if (!activeNotesSet.has(note.id)) {
        problems.push({
          table: 'notes',
          id: note.id,
          description: `Note "${note.title}" was physically deleted/lost from the database.`
        });
      }
    }

    // 6. Compare Events
    for (const ev of goldenEvents) {
      if (!activeEventsSet.has(ev.id)) {
        problems.push({
          table: 'events',
          id: ev.id,
          description: `Event "${ev.title}" was physically deleted/lost from the database.`
        });
      }
    }

    // 7. Compare Areas
    for (const area of goldenAreas) {
      if (!activeAreasSet.has(area.id)) {
        problems.push({
          table: 'areas',
          id: area.id,
          description: `Area "${area.name}" was physically deleted/lost from the database.`
        });
      }
    }

    // 8. Compare DailyLogs
    for (const log of goldenDailyLogs) {
      if (!activeDailyLogsSet.has(log.id)) {
        problems.push({
          table: 'DailyLogs',
          id: log.id,
          description: `DailyLog for Date "${log.date_id}" was physically deleted/lost from the database.`
        });
      }
    }

  } catch (error) {
    console.error('❌ Error executing database integrity queries:', error.message);
    return {
      healthy: false,
      error: `Database query failed: ${error.message}`,
      restored: false,
      problems: []
    };
  } finally {
    if (activeDb) await activeDb.close();
    if (backupDb) await backupDb.close();
  }

  // Report and optionally Auto-Restore
  if (problems.length > 0) {
    console.log(`\n🚨 INTEGRITY CHECK FAILED: Found ${problems.length} physically deleted record(s).`);
    problems.forEach(p => console.log(`   - [${p.table}] ID: ${p.id} | ${p.description}`));

    if (options.checkOnly) {
      console.log('\n⚠️ Check-only mode active. Database restoration skipped.');
      return {
        healthy: false,
        problems,
        restored: false
      };
    }

    console.log('\n🛠️ Restoring database integrity from Golden Backup...');
    try {
      // 1. Close current connection pool in the app to prevent locks
      await closeDbConnection();

      // 2. Overwrite active database with Golden Backup
      fs.copyFileSync(golden.path, ACTIVE_DB_PATH);
      console.log(`✅ Copy complete. Restored: ${golden.details.filename} -> ${DB_FILENAME}`);
      
      return {
        healthy: false,
        problems,
        restored: true,
        restoredFrom: golden.details.filename
      };
    } catch (restoreErr) {
      console.error('❌ Failed to restore database from backup:', restoreErr.message);
      return {
        healthy: false,
        problems,
        restored: false,
        error: `Restoration failed: ${restoreErr.message}`
      };
    }
  } else {
    console.log('✅ DATABASE INTEGRITY VERIFIED: No missing data detected. Active database is perfectly healthy.');
    return {
      healthy: true,
      problems: [],
      restored: false
    };
  }
}

// Direct Execution support
if (require.main === module) {
  const checkOnly = process.argv.includes('--check-only') || process.argv.includes('-c');
  runIntegrityCheck({ checkOnly })
    .then((result) => {
      if (result.healthy) {
        process.exit(0);
      } else {
        process.exit(result.restored ? 0 : 1);
      }
    })
    .catch((err) => {
      console.error('Fatal error running integrity check:', err);
      process.exit(1);
    });
}

module.exports = {
  findGoldenBackup,
  runIntegrityCheck
};
