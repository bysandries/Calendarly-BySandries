async function migrate(db) {
  // Add linked_sleep and linked_habits JSON columns to therapy_entries
  const cols = await db.all('PRAGMA table_info(therapy_entries)');
  const names = cols.map(c => c.name);

  if (!names.includes('linked_sleep')) {
    await db.run('ALTER TABLE therapy_entries ADD COLUMN linked_sleep TEXT');
    console.log('✓ Migration 003: added therapy_entries.linked_sleep');
  }
  if (!names.includes('linked_habits')) {
    await db.run('ALTER TABLE therapy_entries ADD COLUMN linked_habits TEXT');
    console.log('✓ Migration 003: added therapy_entries.linked_habits');
  }
}

module.exports = { migrate };
