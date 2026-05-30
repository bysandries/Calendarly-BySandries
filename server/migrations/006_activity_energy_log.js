async function migrate(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS activity_energy_log (
      id          TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      energy_level TEXT NOT NULL,
      emotion_type TEXT NOT NULL,
      note        TEXT,
      logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ael_entity
      ON activity_energy_log(entity_type, entity_id);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ael_logged_at
      ON activity_energy_log(logged_at);
  `);
}

module.exports = { migrate };
