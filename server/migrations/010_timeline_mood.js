// Migration 010: Add mood column to timeline_items for mood-based sorting and display.
async function migrate(db) {
  const cols = await db.all('PRAGMA table_info(timeline_items)');
  if (!cols.some(c => c.name === 'mood')) {
    await db.exec('ALTER TABLE timeline_items ADD COLUMN mood INTEGER');
    console.log('Migration 010: added timeline_items.mood');
  }
}

module.exports = { migrate };
