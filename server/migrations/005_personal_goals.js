async function migrate(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS personal_goals (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      scope            TEXT NOT NULL DEFAULT 'personal',
      context          TEXT NOT NULL DEFAULT 'personal_care',
      creation_date    TEXT NOT NULL DEFAULT (date('now')),
      completion_date  TEXT,
      archived_at      TEXT,
      archive_history  TEXT DEFAULT '[]',
      status           TEXT NOT NULL DEFAULT 'active',
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS personal_goal_links (
      id         TEXT PRIMARY KEY,
      goal_id    TEXT NOT NULL REFERENCES personal_goals(id) ON DELETE CASCADE,
      link_type  TEXT NOT NULL,
      link_id    TEXT NOT NULL,
      notes      TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { migrate };
