require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { getDbConnection } = require('../db');

(async () => {
  const db = await getDbConnection();

  const areas = await db.all('SELECT id, name, color_hex FROM areas ORDER BY id');
  console.log('Areas:');
  for (const a of areas) console.log(`  ${a.id.padEnd(10)} ${a.color_hex}  ${a.name}`);
  console.log('');

  const rows = await db.all(`
    SELECT id, title, date_string, time_slot, column_type, area, color_hex
    FROM events
    WHERE column_type = 'measure'
    ORDER BY date_string DESC, time_slot ASC
    LIMIT 25
  `);

  console.log(`Most recent ${rows.length} measure events:`);
  for (const r of rows) {
    console.log(`  ${r.date_string} ${r.time_slot} [${r.area.padEnd(8)}] ${r.color_hex}  "${r.title}"`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
