/** Migration 011: Profiling People System
 *  Tables for therapy-life people, their categories, memories,
 *  calendar event links, file attachments, and category history.
 */

async function migrate(database) {
  console.log('Running migration 011: profiling_people system...');

  // ── Categories (mirrors areas table pattern) ──
  await database.exec(`
    CREATE TABLE IF NOT EXISTS profiling_people_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color_hex TEXT NOT NULL,
      description TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed default categories if empty
  const catCount = await database.get('SELECT COUNT(*) as count FROM profiling_people_categories');
  if (catCount.count === 0) {
    const defaults = [
      { id: 'family',      name: 'Family',       color_hex: '#2ECC71' },
      { id: 'friends',     name: 'Friends',      color_hex: '#3498DB' },
      { id: 'romantic',    name: 'Romantic',     color_hex: '#E74C3C' },
      { id: 'professional',name: 'Professional', color_hex: '#F1C40F' },
      { id: 'therapist',   name: 'Therapist',    color_hex: '#9B59B6' },
      { id: 'other',       name: 'Other',        color_hex: '#95A5A6' },
    ];
    for (const c of defaults) {
      await database.run(
        'INSERT INTO profiling_people_categories (id, name, color_hex, description, is_archived) VALUES (?, ?, ?, ?, 0)',
        [c.id, c.name, c.color_hex, '']
      );
    }
    console.log('Migration 011: seeded default profiling people categories');
  }

  // ── Profiling People ──
  await database.exec(`
    CREATE TABLE IF NOT EXISTS profiling_people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT REFERENCES profiling_people_categories(id) ON DELETE SET NULL,
      first_met_date TEXT,
      avatar_file_id TEXT REFERENCES person_attachments(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
  `);

  // ── Category History ──
  await database.exec(`
    CREATE TABLE IF NOT EXISTS profiling_people_category_history (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES profiling_people(id) ON DELETE CASCADE,
      old_category_id TEXT REFERENCES profiling_people_categories(id) ON DELETE SET NULL,
      new_category_id TEXT REFERENCES profiling_people_categories(id) ON DELETE SET NULL,
      changed_at TEXT NOT NULL
    );
  `);

  // ── Memories ──
  await database.exec(`
    CREATE TABLE IF NOT EXISTS person_memories (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES profiling_people(id) ON DELETE CASCADE,
      memory_date TEXT,
      title TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // ── Memory-Event Links ──
  await database.exec(`
    CREATE TABLE IF NOT EXISTS memory_event_links (
      memory_id TEXT NOT NULL REFERENCES person_memories(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      PRIMARY KEY (memory_id, event_id)
    );
  `);

  // ── Attachments ──
  // NOTE: person_attachments has a self-referencing FK to profiling_people
  // for avatar_file_id above. SQLite defers FK checks, but we create the
  // table after the parent to avoid issues in some SQLite builds.
  await database.exec(`
    CREATE TABLE IF NOT EXISTS person_attachments (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES profiling_people(id) ON DELETE CASCADE,
      memory_id TEXT REFERENCES person_memories(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL
    );
  `);

  // ── Indexes ──
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_pp_category ON profiling_people(category_id);`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_pp_name ON profiling_people(name COLLATE NOCASE);`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_pp_history_person ON profiling_people_category_history(person_id);`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_person_memories_person ON person_memories(person_id);`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_person_memories_date ON person_memories(memory_date);`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_person ON person_attachments(person_id);`);
  await database.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_memory ON person_attachments(memory_id);`);

  console.log('Migration 011: profiling_people system complete.');
}

module.exports = { migrate };
