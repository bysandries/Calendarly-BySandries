const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { open } = require('sqlite');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();

const dbPath = path.resolve(__dirname, 'calendarly.db');

async function runQuery() {
  const query = process.argv.slice(2).join(' ');

  if (!query) {
    console.log('\n❌ Error: Please provide a SQL query to execute.');
    console.log('💡 Usage: node server/query.js "SELECT * FROM areas"\n');
    process.exit(1);
  }

  const encryptionKey = process.env.DB_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('❌ Error: DB_ENCRYPTION_KEY environment variable is not defined in server/.env.');
    process.exit(1);
  }

  let db;
  try {
    // Open connection
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Unlock database using SQLCipher
    await db.run(`PRAGMA key = ${JSON.stringify(encryptionKey)}`);
    
    // Enable foreign keys
    await db.get('PRAGMA foreign_keys = ON');

    console.log(`\n🔍 Executing: "${query}"`);
    console.log('------------------------------------------------------------');

    const isSelect = query.trim().toUpperCase().startsWith('SELECT');

    if (isSelect) {
      const rows = await db.all(query);
      if (rows.length === 0) {
        console.log('✅ Query completed. No rows returned.');
      } else {
        console.table(rows);
        console.log(`🎉 Returned ${rows.length} row(s).`);
      }
    } else {
      const result = await db.run(query);
      console.log('✅ Statement executed successfully.');
      console.log(`🔧 Changes: ${result.changes}, Last Insert Row ID: ${result.lastID}`);
    }

  } catch (error) {
    console.error('\n❌ SQL Execution Error:', error.message);
  } finally {
    if (db) {
      await db.close();
    }
    console.log('------------------------------------------------------------\n');
  }
}

runQuery();
