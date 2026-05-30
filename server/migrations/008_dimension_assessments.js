async function migrate(db) {
  const cols = await db.all('PRAGMA table_info(therapy_entries)');
  if (!cols.map(c => c.name).includes('dimension_assessments')) {
    await db.run('ALTER TABLE therapy_entries ADD COLUMN dimension_assessments TEXT');
    console.log('✓ Migration 008: added therapy_entries.dimension_assessments');
  }
}

module.exports = { migrate };
