// Migration 009: Timeline ("Life Map") — multi-year life-planning canvas.
// Items (dreams / goals / milestones) sit on swimlanes by life area, span
// full date ranges, and keep a JSON version_history so plan changes over the
// years are auditable (mirrors personal_goals.archive_history).
async function migrate(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_items (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT 'goal',    -- dream | goal | milestone
      lane            TEXT NOT NULL DEFAULT 'general', -- career | education | travel | ...
      color           TEXT,
      start_date      TEXT NOT NULL,                   -- 'YYYY-MM-DD'
      end_date        TEXT,                            -- null for milestones (point-in-time)
      status          TEXT NOT NULL DEFAULT 'planned', -- planned | active | completed | abandoned
      progress        INTEGER NOT NULL DEFAULT 0,      -- 0-100, for goals
      notes           TEXT,
      version_history TEXT NOT NULL DEFAULT '[]',      -- JSON array of prior-state snapshots
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_item_links (
      id         TEXT PRIMARY KEY,
      item_id    TEXT NOT NULL REFERENCES timeline_items(id) ON DELETE CASCADE,
      link_type  TEXT NOT NULL,   -- project | task | event | goal
      link_id    TEXT NOT NULL,
      notes      TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timeline_item_links_item
      ON timeline_item_links(item_id);
  `);
}

module.exports = { migrate };
