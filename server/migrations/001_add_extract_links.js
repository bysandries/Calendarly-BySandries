/**
 * Migration: Add extract_links table for extract-to-extract relationships
 *
 * This allows therapy notes and other extracts to link to related extracts,
 * enabling better organization of interconnected knowledge.
 */

async function migrate(db) {
  // Create extract_links table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS extract_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_extract_id TEXT NOT NULL,
      target_extract_id TEXT NOT NULL,
      relationship_type TEXT DEFAULT 'references',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_extract_id) REFERENCES extracts(id) ON DELETE CASCADE,
      FOREIGN KEY(target_extract_id) REFERENCES extracts(id) ON DELETE CASCADE,
      UNIQUE(source_extract_id, target_extract_id)
    );
  `);

  console.log('✓ Migration: extract_links table created');

  // Create index for faster lookups
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_extract_links_source
    ON extract_links(source_extract_id);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_extract_links_target
    ON extract_links(target_extract_id);
  `);

  console.log('✓ Migration: extract_links indexes created');
}

module.exports = { migrate };
