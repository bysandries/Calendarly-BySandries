async function migrate(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_entries (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      session_date TEXT,
      session_label TEXT,
      context TEXT,
      therapist_summary TEXT,
      narrative TEXT,
      state TEXT,
      actions_taken TEXT,
      reply_drafts TEXT,
      notes_to_self TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_patterns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      first_entry_id TEXT REFERENCES therapy_entries(id) ON DELETE SET NULL,
      category TEXT DEFAULT 'other',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_entry_patterns (
      entry_id TEXT NOT NULL REFERENCES therapy_entries(id) ON DELETE CASCADE,
      pattern_id TEXT NOT NULL REFERENCES therapy_patterns(id) ON DELETE CASCADE,
      notes TEXT,
      PRIMARY KEY (entry_id, pattern_id)
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_goals (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      first_entry_id TEXT REFERENCES therapy_entries(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_questions (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      entry_id TEXT REFERENCES therapy_entries(id) ON DELETE CASCADE,
      answered INTEGER NOT NULL DEFAULT 0,
      answer_notes TEXT,
      answered_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`CREATE INDEX IF NOT EXISTS idx_therapy_entries_date ON therapy_entries(entry_date DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_therapy_goals_status ON therapy_goals(status, priority);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_therapy_questions_entry ON therapy_questions(entry_id);`);

  console.log('✓ Migration 002: therapy journal tables created');
}

module.exports = { migrate };
