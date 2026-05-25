const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { open } = require('sqlite');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();

const DB_PATH = process.env.DATABASE_PATH || '/data/calendarly.db';
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;

function normalizeName(name) {
  if (!name) return null;
  let n = name.trim();
  // Remove trailing periods from the whole string
  n = n.replace(/\.+$/, '');
  // Normalize "Louis" variations -> "Luis S"
  const louisRegex = /^Louis\.?\s*S\.?$/i;
  if (louisRegex.test(n)) {
    return 'Luis S';
  }
  // Trim any remaining trailing periods (e.g. "Lis C." -> "Lis C")
  n = n.replace(/\.+$/, '');
  return n || null;
}

function parseDescription(description) {
  const result = {
    person_in_charge: null,
    due_date: null,
    start_date: null,
  };

  if (!description) return result;

  // Assigned to
  const assignedMatch = description.match(/\*\*Assigned to:\*\*\s*(.+)/i);
  if (assignedMatch) {
    result.person_in_charge = normalizeName(assignedMatch[1]);
  }

  // Deadline
  const deadlineMatch = description.match(/\*\*Deadline:\*\*\s*(\d{4}-\d{2}-\d{2})/i);
  if (deadlineMatch) {
    result.due_date = deadlineMatch[1];
  }

  // Date Received
  const receivedMatch = description.match(/\*\*Date Received:\*\*\s*(\d{4}-\d{2}-\d{2})/i);
  if (receivedMatch) {
    result.start_date = receivedMatch[1];
  }

  return result;
}

async function main() {
  if (!ENCRYPTION_KEY) {
    console.error('DB_ENCRYPTION_KEY is not set. Aborting.');
    process.exit(1);
  }

  console.log('Opening database at:', DB_PATH);
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.run(`PRAGMA key = ${JSON.stringify(ENCRYPTION_KEY)}`);
  await db.get('PRAGMA foreign_keys = ON');

  // Ensure target columns exist (idempotent migration)
  const columns = await db.all(`PRAGMA table_info(projects)`);
  const colNames = new Set(columns.map(c => c.name));
  const requiredCols = [
    { name: 'person_in_charge', def: 'TEXT' },
    { name: 'due_date', def: 'TEXT' },
    { name: 'start_date', def: 'TEXT' },
    { name: 'end_date', def: 'TEXT' },
  ];
  for (const col of requiredCols) {
    if (!colNames.has(col.name)) {
      console.log(`Adding missing column: projects.${col.name}`);
      await db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  const projects = await db.all(`
    SELECT id, title, description, person_in_charge, due_date, start_date, end_date
    FROM projects
    WHERE description IS NOT NULL AND TRIM(description) != ''
  `);

  console.log(`Found ${projects.length} projects with descriptions.\n`);

  let updatedCount = 0;
  const skipped = [];

  for (const project of projects) {
    const parsed = parseDescription(project.description);

    const updates = {};
    if (parsed.person_in_charge && !project.person_in_charge) {
      updates.person_in_charge = parsed.person_in_charge;
    }
    if (parsed.due_date && !project.due_date) {
      updates.due_date = parsed.due_date;
    }
    if (parsed.start_date && !project.start_date) {
      updates.start_date = parsed.start_date;
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      skipped.push({
        id: project.id,
        title: project.title,
        reason: 'no new fields to update (already populated or not found in description)',
      });
      continue;
    }

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);
    values.push(project.id);

    await db.run(`UPDATE projects SET ${setClause} WHERE id = ?`, values);
    console.log(
      `Updated ${project.id} (${project.title}): ` +
      keys.map(k => `${k}=${updates[k]}`).join(', ')
    );
    updatedCount++;
  }

  console.log(`\nDone. Updated ${updatedCount} projects.`);
  if (skipped.length > 0) {
    console.log(`Skipped ${skipped.length} projects.`);
    for (const s of skipped) {
      console.log(`  - ${s.id}: ${s.title} (${s.reason})`);
    }
  }

  await db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
