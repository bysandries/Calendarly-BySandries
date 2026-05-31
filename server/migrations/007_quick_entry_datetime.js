async function migrate(db) {
  const cols = await db.all('PRAGMA table_info(quick_journal_entries)');
  if (!cols.find(c => c.name === 'entry_date')) {
    await db.run('ALTER TABLE quick_journal_entries ADD COLUMN entry_date TEXT');
    console.log('✓ Migration 007: quick_journal_entries.entry_date added');
  }
  if (!cols.find(c => c.name === 'entry_time')) {
    await db.run('ALTER TABLE quick_journal_entries ADD COLUMN entry_time TEXT');
    console.log('✓ Migration 007: quick_journal_entries.entry_time added');
  }
}

module.exports = { migrate };
