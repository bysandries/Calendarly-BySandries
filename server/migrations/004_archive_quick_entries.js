async function migrate(db) {
  // Archive support for full journal entries
  const cols = await db.all('PRAGMA table_info(therapy_entries)');
  if (!cols.find(c => c.name === 'is_archived')) {
    await db.run('ALTER TABLE therapy_entries ADD COLUMN is_archived INTEGER DEFAULT 0');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_therapy_entries_archived ON therapy_entries(is_archived)');
    console.log('✓ Migration 004: therapy_entries.is_archived added');
  }

  // Quick journal entries (brain-dump / quick capture)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS quick_journal_entries (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      description TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  await db.exec('CREATE INDEX IF NOT EXISTS idx_quick_entries_created ON quick_journal_entries(is_archived, created_at DESC)');
  console.log('✓ Migration 004: quick_journal_entries table created');
}

module.exports = { migrate };
