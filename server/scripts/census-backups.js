#!/usr/bin/env node
// Read-only census of all backups + active DB. Lists row counts per table.
// Usage: node scripts/census-backups.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { open } = require('sqlite');
const sqlite3 = require('@journeyapps/sqlcipher').verbose();

const SERVER_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(SERVER_DIR, 'backups');
const ACTIVE_DB = path.join(SERVER_DIR, 'calendarly.db');
const KEY = process.env.DB_ENCRYPTION_KEY;

const TABLES = ['tasks', 'projects', 'events', 'notes', 'areas', 'DailyLogs', 'CalendarDays', 'deleted_tasks', 'deleted_projects'];

async function censusOne(file) {
  let db;
  try {
    db = await open({ filename: file, driver: sqlite3.Database });
    if (KEY) await db.run(`PRAGMA key = ${JSON.stringify(KEY)}`);
    const present = new Set(
      (await db.all("SELECT name FROM sqlite_master WHERE type='table'")).map(r => r.name)
    );
    const out = {};
    for (const t of TABLES) {
      if (present.has(t)) {
        try {
          const r = await db.get(`SELECT COUNT(*) AS c FROM "${t}"`);
          out[t] = r.c;
        } catch (e) {
          out[t] = 'ERR';
        }
      } else {
        out[t] = '-';
      }
    }
    return out;
  } catch (e) {
    return { __error: e.message };
  } finally {
    if (db) try { await db.close(); } catch {}
  }
}

(async () => {
  const files = [];
  if (fs.existsSync(BACKUP_DIR)) {
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (f.startsWith('calendarly_') && f.endsWith('.db')) {
        const full = path.join(BACKUP_DIR, f);
        const st = fs.statSync(full);
        files.push({ name: f, path: full, mtime: st.mtime, size: st.size });
      }
    }
  }
  files.sort((a, b) => a.mtime - b.mtime);
  files.push({ name: '*** ACTIVE calendarly.db ***', path: ACTIVE_DB, mtime: fs.statSync(ACTIVE_DB).mtime, size: fs.statSync(ACTIVE_DB).size });

  const header = ['mtime', 'size', ...TABLES, 'file'];
  console.log(header.join('\t'));
  for (const f of files) {
    const c = await censusOne(f.path);
    if (c.__error) {
      console.log([f.mtime.toISOString().slice(0,19), f.size, ...TABLES.map(() => 'ERR'), f.name + ' (' + c.__error + ')'].join('\t'));
    } else {
      console.log([f.mtime.toISOString().slice(0,19), f.size, ...TABLES.map(t => c[t]), f.name].join('\t'));
    }
  }
})();
