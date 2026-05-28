const path = require('path');
const fs = require('fs');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();
const { open } = require('sqlite');

const dbPath = path.resolve(__dirname, '../calendarly.db');

async function testKey(keyName, keyValue) {
  let db;
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    if (keyValue) {
      await db.run(`PRAGMA key = ${JSON.stringify(keyValue)}`);
    }

    // Try a simple query that requires unlocking the DB
    const row = await db.get("SELECT COUNT(*) as count FROM sqlite_master");
    console.log(`✅ Success with key "${keyName}" (value: "${keyValue}"): Found ${row.count} schema objects.`);
    
    // Check if areas table exists and has rows
    try {
      const areasCount = await db.get("SELECT COUNT(*) as count FROM areas");
      console.log(`   👉 Areas table has ${areasCount.count} rows.`);
    } catch (e) {
      console.log(`   ⚠️ Areas table query failed: ${e.message}`);
    }

    try {
      const eventsCount = await db.get("SELECT COUNT(*) as count FROM events");
      console.log(`   👉 Events table has ${eventsCount.count} rows.`);
    } catch (e) {
      console.log(`   ⚠️ Events table query failed: ${e.message}`);
    }

    return true;
  } catch (err) {
    console.log(`❌ Failed with key "${keyName}": ${err.message}`);
    return false;
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function run() {
  console.log(`🔍 Testing keys for database: ${dbPath}\n`);
  
  if (fs.existsSync(dbPath)) {
    console.log(`File size: ${fs.statSync(dbPath).size} bytes`);
    await testKey('Empty / No Encryption', '');
    await testKey('your-super-secure-high-entropy-passphrase', 'your-super-secure-high-entropy-passphrase');
  }

  const backupsDir = path.resolve(__dirname, '../backups');
  if (fs.existsSync(backupsDir)) {
    console.log('\n🔍 Testing backup files:');
    const files = fs.readdirSync(backupsDir);
    for (const file of files) {
      if (!file.endsWith('.db')) continue;
      const backupPath = path.join(backupsDir, file);
      console.log(`\n📄 Backup: ${file} (${fs.statSync(backupPath).size} bytes)`);
      
      let db;
      try {
        db = await open({
          filename: backupPath,
          driver: sqlite3.Database
        });
        const row = await db.get("SELECT COUNT(*) as count FROM sqlite_master");
        console.log(`   ✅ Success (unencrypted): Found ${row.count} schema objects.`);
        
        try {
          const areas = await db.get("SELECT COUNT(*) as count FROM areas");
          console.log(`   👉 Areas: ${areas.count}`);
        } catch (e) {}
        
        try {
          const events = await db.get("SELECT COUNT(*) as count FROM events");
          console.log(`   👉 Events: ${events.count}`);
        } catch (e) {}
        
        try {
          const tasks = await db.get("SELECT COUNT(*) as count FROM tasks");
          console.log(`   👉 Tasks: ${tasks.count}`);
        } catch (e) {}
      } catch (e) {
        console.log(`   ❌ Failed to open (encrypted): ${e.message}`);
      } finally {
        if (db) await db.close();
      }
    }
  }
}

run();
