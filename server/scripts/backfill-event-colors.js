require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { getDbConnection } = require('../db');

(async () => {
  const db = await getDbConnection();

  const mismatches = await db.all(`
    SELECT e.id, e.title, e.column_type, e.area, e.color_hex AS current_color, a.color_hex AS area_color
    FROM events e
    JOIN areas a ON a.id = e.area
    WHERE e.color_hex IS NULL OR e.color_hex != a.color_hex
  `);

  console.log(`Mismatched events: ${mismatches.length}`);
  for (const row of mismatches) {
    console.log(`  ${row.id} [${row.column_type}/${row.area}] "${row.title}": ${row.current_color} -> ${row.area_color}`);
  }

  if (mismatches.length === 0) {
    console.log('Nothing to update.');
    process.exit(0);
  }

  const result = await db.run(`
    UPDATE events
    SET color_hex = (SELECT color_hex FROM areas WHERE areas.id = events.area)
    WHERE area IS NOT NULL
      AND EXISTS (SELECT 1 FROM areas WHERE areas.id = events.area)
      AND (color_hex IS NULL OR color_hex != (SELECT color_hex FROM areas WHERE areas.id = events.area))
  `);

  console.log(`Rows updated: ${result.changes}`);

  const remaining = await db.get(`
    SELECT COUNT(*) AS n
    FROM events e
    JOIN areas a ON a.id = e.area
    WHERE e.color_hex IS NULL OR e.color_hex != a.color_hex
  `);
  console.log(`Remaining mismatches: ${remaining.n}`);

  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
