const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { open } = require('sqlite');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();

const DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, 'calendarly.db');
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;

async function main() {
  if (!ENCRYPTION_KEY) {
    console.error('❌ Error: DB_ENCRYPTION_KEY is not set in server/.env');
    process.exit(1);
  }

  const TARGET_NAME = 'Luis Sandries';
  let db;

  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    await db.run(`PRAGMA key = ${JSON.stringify(ENCRYPTION_KEY)}`);
    await db.get('PRAGMA foreign_keys = ON');

    console.log(`\n🚀 Starting migration to assign unassigned items to "${TARGET_NAME}"...`);

    // 1. Find or create the person
    let person = await db.get('SELECT id FROM people WHERE name = ?', [TARGET_NAME]);
    
    if (!person) {
      console.log(`👤 Person "${TARGET_NAME}" not found. Creating entry...`);
      const personId = `person-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await db.run(
        'INSERT INTO people (id, name, created_at) VALUES (?, ?, ?)',
        [personId, TARGET_NAME, new Date().toISOString()]
      );
      person = { id: personId };
      console.log(`✅ Created person with ID: ${personId}`);
    } else {
      console.log(`✅ Found person "${TARGET_NAME}" with ID: ${person.id}`);
    }

    const personId = person.id;

    // 2. Update Projects
    console.log('\n📁 Checking unassigned projects...');
    const projectResult = await db.run(
      'UPDATE projects SET person_id = ? WHERE person_id IS NULL OR person_id = ""',
      [personId]
    );
    console.log(`✅ Updated ${projectResult.changes} project(s).`);

    // 3. Update Tasks
    console.log('\n📝 Checking unassigned tasks...');
    const taskResult = await db.run(
      'UPDATE tasks SET person_id = ? WHERE person_id IS NULL OR person_id = ""',
      [personId]
    );
    console.log(`✅ Updated ${taskResult.changes} task(s).`);

    console.log('\n🎉 Migration complete!\n');

  } catch (error) {
    console.error('\n❌ Error during migration:', error.message);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

main();
