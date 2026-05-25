const path = require('path');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const { open } = require('sqlite');

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'calendarly.db');

let db = null;

async function getDbConnection() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Apply transparent database encryption key if defined in environments
  const encryptionKey = process.env.DB_ENCRYPTION_KEY;
  if (encryptionKey) {
    console.log('🔒 Database encryption key detected. Unlocking secure SQLite storage...');
    await db.run(`PRAGMA key = ${JSON.stringify(encryptionKey)}`);
  } else {
    console.warn('⚠️ Warning: No DB_ENCRYPTION_KEY specified. Database is unencrypted!');
  }

  // Enable foreign keys
  await db.get('PRAGMA foreign_keys = ON');

  return db;
}

async function addColumnIfMissing(database, table, column, columnDef) {
  const cols = await database.all(`PRAGMA table_info(${table})`);
  if (cols.some(c => c.name === column)) return;
  await database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`);
  console.log(`Migration: added ${table}.${column}`);
}

async function initDatabase(forceReset = false) {
  const database = await getDbConnection();

  if (forceReset) {
    console.log('Resetting SQLite database...');
    await database.run('PRAGMA foreign_keys = OFF');
    await database.exec('DROP TABLE IF EXISTS notes;');
    await database.exec('DROP TABLE IF EXISTS DailyLogs;');
    await database.exec('DROP TABLE IF EXISTS CalendarDays;');
    await database.exec('DROP TABLE IF EXISTS events;');
    await database.exec('DROP TABLE IF EXISTS tasks;');
    await database.exec('DROP TABLE IF EXISTS projects;');
    await database.exec('DROP TABLE IF EXISTS areas;');
    await database.exec('DROP TABLE IF EXISTS deleted_tasks;');
    await database.exec('DROP TABLE IF EXISTS deleted_projects;');
    await database.run('PRAGMA foreign_keys = ON');
  }

  console.log('Initializing SQLite database schema with Areas & CalendarDays...');

  // Create areas table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color_hex TEXT NOT NULL,
      description TEXT
    );
  `);

  // Create CalendarDays table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS CalendarDays (
      date_id TEXT PRIMARY KEY, -- Stored as 'YYYY-MM-DD'
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL, -- 0 for Sunday, 1 for Monday, etc.
      is_weekend BOOLEAN DEFAULT 0,
      is_holiday BOOLEAN DEFAULT 0,
      holiday_name TEXT
    );
  `);

  // Create DailyLogs table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS DailyLogs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'default_user',
      date_id TEXT NOT NULL, -- e.g. '2026-05-24'
      note TEXT,
      FOREIGN KEY(date_id) REFERENCES CalendarDays(date_id) ON DELETE CASCADE
    );
  `);

  // Create projects table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'on-hold', 'completed', 'archived')),
      area TEXT NOT NULL,
      pillar TEXT NOT NULL CHECK(pillar IN ('Kindness', 'Authenticity', 'Resilience', 'Innovation')),
      methodology TEXT DEFAULT 'PALM',
      phase TEXT NOT NULL CHECK(phase IN ('Plan', 'Act', 'Measure', 'Learn')),
      goals_aligned TEXT,
      description TEXT,
      person_in_charge TEXT,
      due_date TEXT,
      start_date TEXT,
      end_date TEXT
    );
  `);

  // Migration: add 'archived' to projects status CHECK if not already present
  const projectsSchema = await database.get(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'"
  );
  if (projectsSchema && !projectsSchema.sql.includes("'archived'")) {
    console.log("Migrating projects table to add 'archived' status...");
    await database.run('PRAGMA foreign_keys = OFF');
    await database.exec(`
      CREATE TABLE projects_migrated (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('active', 'on-hold', 'completed', 'archived')),
        area TEXT NOT NULL,
        pillar TEXT NOT NULL CHECK(pillar IN ('Kindness', 'Authenticity', 'Resilience', 'Innovation')),
        methodology TEXT DEFAULT 'PALM',
        phase TEXT NOT NULL CHECK(phase IN ('Plan', 'Act', 'Measure', 'Learn')),
        goals_aligned TEXT,
        description TEXT
      );
    `);
    await database.exec('INSERT INTO projects_migrated SELECT * FROM projects');
    await database.exec('DROP TABLE projects');
    await database.exec('ALTER TABLE projects_migrated RENAME TO projects');
    await database.run('PRAGMA foreign_keys = ON');
    console.log('Projects table migration complete.');
  }

  // Deleted records tables (soft-delete archive)
  await database.exec(`
    CREATE TABLE IF NOT EXISTS deleted_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      area TEXT NOT NULL,
      pillar TEXT NOT NULL,
      methodology TEXT,
      phase TEXT NOT NULL,
      goals_aligned TEXT,
      description TEXT,
      person_in_charge TEXT,
      due_date TEXT,
      start_date TEXT,
      end_date TEXT,
      deleted_at TEXT NOT NULL
    );
  `);

  await database.exec(`
    CREATE TABLE IF NOT EXISTS deleted_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      project_id TEXT,
      date_due TEXT,
      priority INTEGER DEFAULT 0,
      notes TEXT,
      estimated_minutes INTEGER NOT NULL DEFAULT 0,
      received_date TEXT,
      finished_date TEXT,
      deleted_at TEXT NOT NULL,
      deleted_with_project_id TEXT
    );
  `);

  // Create tasks table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '01 - Inbox',
      project_id TEXT,
      date_due TEXT,
      priority INTEGER DEFAULT 0,
      notes TEXT,
      estimated_minutes INTEGER NOT NULL DEFAULT 0,
      received_date TEXT,
      finished_date TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
  `);

  // Idempotent migrations: add columns introduced after initial schema
  await addColumnIfMissing(database, 'tasks', 'estimated_minutes', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(database, 'tasks', 'received_date', 'TEXT');
  await addColumnIfMissing(database, 'tasks', 'finished_date', 'TEXT');
  await addColumnIfMissing(database, 'deleted_tasks', 'estimated_minutes', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(database, 'deleted_tasks', 'received_date', 'TEXT');
  await addColumnIfMissing(database, 'deleted_tasks', 'finished_date', 'TEXT');
  await addColumnIfMissing(database, 'projects', 'person_in_charge', 'TEXT');
  await addColumnIfMissing(database, 'projects', 'due_date', 'TEXT');
  await addColumnIfMissing(database, 'projects', 'start_date', 'TEXT');
  await addColumnIfMissing(database, 'projects', 'end_date', 'TEXT');
  await addColumnIfMissing(database, 'deleted_projects', 'person_in_charge', 'TEXT');
  await addColumnIfMissing(database, 'deleted_projects', 'due_date', 'TEXT');
  await addColumnIfMissing(database, 'deleted_projects', 'start_date', 'TEXT');
  await addColumnIfMissing(database, 'deleted_projects', 'end_date', 'TEXT');

  // Create events table (category -> area)
  await database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      block_signature TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      area TEXT DEFAULT 'general',
      color_hex TEXT NOT NULL,
      date_string TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      column_type TEXT NOT NULL CHECK(column_type IN ('plan', 'measure')),
      notes TEXT,
      is_cloned_checked INTEGER DEFAULT 0,
      timezone TEXT DEFAULT 'America/Los_Angeles',
      rrule TEXT, -- RFC 5545 recurrence rule string
      FOREIGN KEY(area) REFERENCES areas(id) ON DELETE SET NULL
    );
  `);

  await addColumnIfMissing(database, 'events', 'timezone', 'TEXT DEFAULT \'America/Los_Angeles\'');
  await addColumnIfMissing(database, 'events', 'rrule', 'TEXT');

  // Create notes table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      type TEXT,
      tags TEXT,
      linked_task_id TEXT,
      FOREIGN KEY(linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );
  `);

  // Create event_task_links join table (Many-to-Many)
  await database.exec(`
    CREATE TABLE IF NOT EXISTS event_task_links (
      event_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      PRIMARY KEY (event_id, task_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `);

  // Create extracts table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS extracts (
      id TEXT PRIMARY KEY,
      content TEXT,
      bibliography TEXT,
      chapter_section TEXT,
      position TEXT,
      tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      highlight_color TEXT,
      note_id TEXT,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE SET NULL
    );
  `);

  // Create extract_resources linking table (Many-to-Many)
  await database.exec(`
    CREATE TABLE IF NOT EXISTS extract_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      extract_id TEXT NOT NULL,
      project_id TEXT,
      task_id TEXT,
      FOREIGN KEY(extract_id) REFERENCES extracts(id) ON DELETE CASCADE,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      CHECK(project_id IS NOT NULL OR task_id IS NOT NULL)
    );
  `);

  // Create settings table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings if empty
  const settingsCount = await database.get('SELECT COUNT(*) as count FROM settings');
  if (settingsCount.count === 0) {
    const defaultSettings = [
      { key: 'base_timezone', value: 'America/Los_Angeles' },
      { key: 'first_day_of_week', value: 'sunday' },
      { key: 'default_slot_duration', value: '30' },
      { key: 'time_format', value: '12h' },
      { key: 'date_format', value: 'YYYY-MM-DD' },
      { key: 'theme', value: 'midnight-abyss' },
      { key: 'palm_pillars', value: JSON.stringify({
          Kindness: 'Kindness',
          Authenticity: 'Authenticity',
          Resilience: 'Resilience',
          Innovation: 'Innovation'
        }) 
      }
    ];
    for (const s of defaultSettings) {
      await database.run('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
  }

  await seedDatabase(database);
  console.log('Database initialization completed.');
}

async function seedDatabase(database) {
  // Check if calendar days are already seeded
  const daysCount = await database.get('SELECT COUNT(*) as count FROM CalendarDays');
  if (daysCount.count === 0) {
    console.log('Seeding CalendarDays dimension table (2025 - 2030)...');
    
    // We pre-generate days in a transaction for fast inserts
    await database.run('BEGIN TRANSACTION');
    try {
      const startDate = new Date('2025-01-01T00:00:00');
      const endDate = new Date('2030-12-31T00:00:00');
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        const dateId = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
        
        let isHoliday = 0;
        let holidayName = null;
        
        // Simple US Holidays
        if (month === 1 && day === 1) {
          isHoliday = 1;
          holidayName = "New Year's Day";
        } else if (month === 7 && day === 4) {
          isHoliday = 1;
          holidayName = "Independence Day";
        } else if (month === 11 && dayOfWeek === 4 && day >= 22 && day <= 28) {
          isHoliday = 1;
          holidayName = "Thanksgiving Day";
        } else if (month === 12 && day === 25) {
          isHoliday = 1;
          holidayName = "Christmas Day";
        }
        
        await database.run(
          `INSERT INTO CalendarDays (date_id, year, month, day, day_of_week, is_weekend, is_holiday, holiday_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [dateId, year, month, day, dayOfWeek, isWeekend, isHoliday, holidayName]
        );
      }
      await database.run('COMMIT');
      console.log('CalendarDays dimension seeded successfully.');
    } catch (err) {
      await database.run('ROLLBACK');
      console.error('Error seeding CalendarDays:', err);
      throw err;
    }
  }

  // Check if areas are already seeded
  const areasCount = await database.get('SELECT COUNT(*) as count FROM areas');
  if (areasCount.count > 0) {
    console.log('Database already has data. Skipping seeding.');
    return;
  }

  console.log('Seeding default database records...');

  // 1. Seed Areas
  const areas = [
    { id: 'sleep', name: 'Sleep', color_hex: '#2C3E50', description: 'Rest and rejuvenation' },
    { id: 'work', name: 'Work', color_hex: '#E67E22', description: 'Professional work and career tasks' },
    { id: 'math', name: 'Math', color_hex: '#F1C40F', description: 'Mathematics practice and study' },
    { id: 'coding', name: 'Coding', color_hex: '#3498DB', description: 'Software development and programming' },
    { id: 'creative', name: 'Creative', color_hex: '#9B59B6', description: 'Creative work, writing, drawing, and media' },
    { id: 'fitness', name: 'Fitness', color_hex: '#2ECC71', description: 'Exercise and physical health' },
    { id: 'general', name: 'General', color_hex: '#95A5A6', description: 'Miscellaneous daily tasks and activities' }
  ];

  for (const a of areas) {
    await database.run(
      'INSERT INTO areas (id, name, color_hex, description) VALUES (?, ?, ?, ?)',
      [a.id, a.name, a.color_hex, a.description]
    );
  }

  // 2. Seed Projects
  const projects = [
    {
      id: 'project-1',
      title: 'Vivir Grid Development',
      status: 'active',
      area: 'work', // Point to work area ID
      pillar: 'Innovation',
      methodology: 'PALM',
      phase: 'Plan',
      goals_aligned: JSON.stringify(['Build local-first scheduler', 'Implement dual-column UI']),
      description: 'High-performance dark-mode scheduler and retrospective engine.'
    },
    {
      id: 'project-2',
      title: 'Artistic Expression & Content Creation',
      status: 'active',
      area: 'creative', // Point to creative area ID
      pillar: 'Authenticity',
      methodology: 'PALM',
      phase: 'Act',
      goals_aligned: JSON.stringify(['Create digital art portfolio']),
      description: 'Focusing on creative design elements, aesthetics, and user experience.'
    }
  ];

  for (const proj of projects) {
    await database.run(
      `INSERT INTO projects (id, title, status, area, pillar, methodology, phase, goals_aligned, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [proj.id, proj.title, proj.status, proj.area, proj.pillar, proj.methodology, proj.phase, proj.goals_aligned, proj.description]
    );
  }

  // 3. Seed Tasks
  const tasks = [
    {
      id: 'task-1',
      title: 'Set up core Express API and SQLite schema',
      status: '03 - In Progress',
      project_id: 'project-1',
      date_due: '2026-05-24',
      priority: 1,
      notes: 'Verify database file creation and endpoints.'
    },
    {
      id: 'task-2',
      title: 'Design pure black UI mockup',
      status: '02 - Next Step',
      project_id: 'project-2',
      date_due: '2026-05-25',
      priority: 2,
      notes: 'Use neon accent color variables.'
    },
    {
      id: 'task-3',
      title: 'Buy groceries',
      status: '01 - Inbox',
      project_id: null,
      date_due: null,
      priority: 0,
      notes: 'Triage this under 2 minutes.'
    }
  ];

  for (const task of tasks) {
    await database.run(
      `INSERT INTO tasks (id, title, status, project_id, date_due, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [task.id, task.title, task.status, task.project_id, task.date_due, task.priority, task.notes]
    );
  }

  // 4. Seed Events for 2026-05-24
  const events = [
    {
      id: 'event-1',
      block_signature: '2026-05-24_00:00_plan',
      title: 'Sleep (Planned)',
      area: 'sleep',
      color_hex: '#2C3E50',
      date_string: '2026-05-24',
      time_slot: '00:00',
      duration_mins: 480,
      column_type: 'plan',
      notes: 'Solid 8-hour sleep objective.',
      is_cloned_checked: 0
    },
    {
      id: 'event-2',
      block_signature: '2026-05-24_00:30_measure',
      title: 'Actual Sleep',
      area: 'sleep',
      color_hex: '#2C3E50',
      date_string: '2026-05-24',
      time_slot: '00:30',
      duration_mins: 465,
      column_type: 'measure',
      notes: 'Delayed start, but slept well.',
      is_cloned_checked: 0
    },
    {
      id: 'event-3',
      block_signature: '2026-05-24_09:00_plan',
      title: 'Coding session (Planned)',
      area: 'coding',
      color_hex: '#3498DB',
      date_string: '2026-05-24',
      time_slot: '09:00',
      duration_mins: 180,
      column_type: 'plan',
      notes: 'Work on backend API.',
      is_cloned_checked: 0
    },
    {
      id: 'event-4',
      block_signature: '2026-05-24_09:15_measure',
      title: 'Coding session',
      area: 'coding',
      color_hex: '#3498DB',
      date_string: '2026-05-24',
      time_slot: '09:15',
      duration_mins: 165,
      column_type: 'measure',
      notes: 'API setup completed.',
      is_cloned_checked: 0
    },
    {
      id: 'event-5',
      block_signature: '2026-05-24_13:00_plan',
      title: 'Deep Work on Projects (Planned)',
      area: 'work',
      color_hex: '#E67E22',
      date_string: '2026-05-24',
      time_slot: '13:00',
      duration_mins: 240,
      column_type: 'plan',
      notes: 'Work on database schema and seed integrations.',
      is_cloned_checked: 0
    },
    {
      id: 'event-6',
      block_signature: '2026-05-24_13:45_measure',
      title: 'Watching Young Sheldon',
      area: 'creative',
      color_hex: '#9B59B6',
      date_string: '2026-05-24',
      time_slot: '13:45',
      duration_mins: 45,
      column_type: 'measure',
      notes: 'Logged via AI voice command',
      is_cloned_checked: 0
    }
  ];

  for (const ev of events) {
    await database.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ev.id, ev.block_signature, ev.title, ev.area, ev.color_hex, ev.date_string, ev.time_slot, ev.duration_mins, ev.column_type, ev.notes, ev.is_cloned_checked]
    );
  }

  console.log('Database seeded successfully.');
}

async function closeDbConnection() {
  if (db) {
    try {
      await db.close();
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
    db = null;
  }
}

/**
 * Verifies a temporary SQLite database using a candidate key,
 * runs integrity checks, and re-keys it if the candidate key differs from the target key.
 * 
 * @param {string} tmpDbPath - Path to the temporary SQLite database
 * @param {string} candidateKey - The key to attempt to open the DB with
 * @param {string} targetKey - The key the DB should be encrypted with after operation
 * @returns {Promise<boolean>} - True if verification and re-key was successful
 */
async function verifyAndRekeyDatabase(tmpDbPath, candidateKey, targetKey) {
  // We open a separate temp connection using the journeyapps verbose driver
  const tempDb = await open({
    filename: tmpDbPath,
    driver: sqlite3.Database
  });

  try {
    // Apply candidate key
    if (candidateKey) {
      await tempDb.run(`PRAGMA key = ${JSON.stringify(candidateKey)}`);
    }

    // Verify it is readable by querying sqlite_master
    await tempDb.get('SELECT count(*) FROM sqlite_master');

    // Run a quick integrity check
    const integrity = await tempDb.get('PRAGMA integrity_check');
    if (!integrity || integrity.integrity_check !== 'ok') {
      throw new Error('Database integrity check failed: ' + JSON.stringify(integrity));
    }

    // If key needs to be changed to match targetKey
    if (candidateKey !== targetKey) {
      console.log('Rekeying temporary database to match active server key...');
      // SQLCipher rekey syntax
      await tempDb.run(`PRAGMA rekey = ${JSON.stringify(targetKey || '')}`);
    }

    await tempDb.close();
    return true;
  } catch (err) {
    console.error('Failed to verify or rekey database:', err);
    try {
      await tempDb.close();
    } catch (_) {}
    throw err;
  }
}

module.exports = {
  getDbConnection,
  initDatabase,
  closeDbConnection,
  verifyAndRekeyDatabase
};

