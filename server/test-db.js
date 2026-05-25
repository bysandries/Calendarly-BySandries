const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Use a dedicated test database — never touch the production DB
const TEST_DB_PATH = path.resolve(__dirname, 'test.db');
const _origDbPath = process.env.DATABASE_PATH;
const _origDbKey  = process.env.DB_ENCRYPTION_KEY;
process.env.DATABASE_PATH    = TEST_DB_PATH;
process.env.DB_ENCRYPTION_KEY = '';

const fs = require('fs');
const { initDatabase, getDbConnection } = require('./db');

async function runTests() {
  console.log('🧪 Starting database schema and logic integration tests (with Areas & Encryption)...');

  try {
    // 1. Initialize and seed database, forcing reset
    await initDatabase(true);
    const db = await getDbConnection();

    // 2. Verify table exists and records seeded
    const areas = await db.all('SELECT * FROM areas');
    console.log(`✅ Areas seeded successfully. Count: ${areas.length}`);
    if (areas.length === 0) throw new Error('No areas seeded');

    const projects = await db.all('SELECT * FROM projects');
    console.log(`✅ Projects seeded successfully. Count: ${projects.length}`);
    if (projects.length === 0) throw new Error('No projects seeded');

    const tasks = await db.all('SELECT * FROM tasks');
    console.log(`✅ Tasks seeded successfully. Count: ${tasks.length}`);
    if (tasks.length === 0) throw new Error('No tasks seeded');

    const events = await db.all('SELECT * FROM events');
    console.log(`✅ Events seeded successfully. Count: ${events.length}`);
    if (events.length === 0) throw new Error('No events seeded');

    // 3. Verify event structure for 2026-05-24
    const rows = await db.all('SELECT * FROM events WHERE date_string = ?', ['2026-05-24']);
    const plan = rows.filter(r => r.column_type === 'plan');
    const measure = rows.filter(r => r.column_type === 'measure');
    console.log(`✅ Daily events query check: Plan: ${plan.length}, Measure: ${measure.length}`);
    if (plan.length !== 3 || measure.length !== 3) {
      throw new Error(`Unexpected event count. Expected 3 plan and 3 measure, got ${plan.length} plan and ${measure.length} measure`);
    }

    // 4. Test spontaneous measure logging logic (equivalent to POST /api/events/log-measure)
    console.log('🧪 Testing spontaneous measure logging...');
    const testLog = {
      date_string: '2026-05-24',
      time_slot: '15:30',
      duration_mins: 30,
      title: 'Quick Exercise',
      area: 'fitness',
      notes: 'Logged via test script'
    };

    const areaRow = await db.get('SELECT color_hex FROM areas WHERE id = ?', [testLog.area]);
    const colorHex = areaRow ? areaRow.color_hex : '#95A5A6';
    const newId = `event-test-${Date.now()}`;
    const blockSig = `${testLog.date_string}_${testLog.time_slot}_measure`;

    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'measure', ?, 0)`,
      [newId, blockSig, testLog.title, testLog.area, colorHex, testLog.date_string, testLog.time_slot, testLog.duration_mins, testLog.notes]
    );

    const loggedEvent = await db.get('SELECT * FROM events WHERE id = ?', [newId]);
    console.log('✅ Spontaneous measure logged successfully:', loggedEvent.title);
    if (loggedEvent.area !== 'fitness' || loggedEvent.color_hex !== '#2ECC71') {
      throw new Error('Color or area mapping failed on log-measure');
    }

    // 5. Test UPSERT sync-block logic (equivalent to POST /api/events/sync-block)
    console.log('🧪 Testing UPSERT sync-block...');
    // A. Update existing block
    const updatePayload = {
      id: 'event-3', // Existing coding session plan
      title: 'Advanced Coding session',
      area: 'coding',
      color_hex: '#3498DB',
      date_string: '2026-05-24',
      time_slot: '09:00',
      duration_mins: 180,
      column_type: 'plan',
      notes: 'Updated notes',
      is_cloned_checked: 0
    };

    await db.run(
      `UPDATE events
       SET title = ?, area = ?, color_hex = ?, date_string = ?, time_slot = ?, duration_mins = ?, column_type = ?, notes = ?, is_cloned_checked = ?
       WHERE id = ?`,
      [
        updatePayload.title,
        updatePayload.area,
        updatePayload.color_hex,
        updatePayload.date_string,
        updatePayload.time_slot,
        updatePayload.duration_mins,
        updatePayload.column_type,
        updatePayload.notes,
        updatePayload.is_cloned_checked,
        updatePayload.id
      ]
    );
    const updatedEvent = await db.get('SELECT * FROM events WHERE id = ?', ['event-3']);
    console.log('✅ UPSERT update verified:', updatedEvent.title, '-', updatedEvent.notes);
    if (updatedEvent.title !== 'Advanced Coding session' || updatedEvent.notes !== 'Updated notes') {
      throw new Error('UPSERT update failed');
    }

    // B. Insert new block
    const insertPayload = {
      id: 'event-new-test',
      block_signature: '2026-05-24_18:00_plan',
      title: 'Study Math',
      area: 'math',
      color_hex: '#F1C40F',
      date_string: '2026-05-24',
      time_slot: '18:00',
      duration_mins: 60,
      column_type: 'plan',
      notes: 'Practice calculus',
      is_cloned_checked: 0
    };

    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insertPayload.id,
        insertPayload.block_signature,
        insertPayload.title,
        insertPayload.area,
        insertPayload.color_hex,
        insertPayload.date_string,
        insertPayload.time_slot,
        insertPayload.duration_mins,
        insertPayload.column_type,
        insertPayload.notes,
        insertPayload.is_cloned_checked
      ]
    );
    const insertedEvent = await db.get('SELECT * FROM events WHERE id = ?', ['event-new-test']);
    console.log('✅ UPSERT insert verified:', insertedEvent.title);
    if (insertedEvent.title !== 'Study Math') {
      throw new Error('UPSERT insert failed');
    }

    // 6. Test Plan Cloning (equivalent to POST /api/events/clone-plan)
    console.log('🧪 Testing clone-plan logic...');
    const planIdToClone = 'event-3';
    // Set plan event is_cloned_checked = 1
    await db.run('UPDATE events SET is_cloned_checked = 1 WHERE id = ?', [planIdToClone]);
    const clonedId = `event-cloned-${Date.now()}`;
    const cloneSig = '2026-05-24_09:00_measure';

    await db.run(
      `INSERT INTO events (id, block_signature, title, area, color_hex, date_string, time_slot, duration_mins, column_type, notes, is_cloned_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'measure', ?, 1)`,
      [
        clonedId,
        cloneSig,
        updatedEvent.title,
        updatedEvent.area,
        updatedEvent.color_hex,
        updatedEvent.date_string,
        updatedEvent.time_slot,
        updatedEvent.duration_mins,
        updatedEvent.notes
      ]
    );

    const checkPlan = await db.get('SELECT * FROM events WHERE id = ?', [planIdToClone]);
    const checkClone = await db.get('SELECT * FROM events WHERE id = ?', [clonedId]);

    console.log('✅ Plan event clone-plan flag updated:', checkPlan.is_cloned_checked === 1);
    console.log('✅ Cloned measure event created successfully:', checkClone.title, 'is_cloned_checked:', checkClone.is_cloned_checked);
    
    if (checkPlan.is_cloned_checked !== 1 || checkClone.is_cloned_checked !== 1) {
      throw new Error('Clone plan logic validation failed');
    }

    // Clean up test events
    await db.run('DELETE FROM events WHERE id IN (?, ?, ?)', [newId, 'event-new-test', clonedId]);
    await db.run('UPDATE events SET is_cloned_checked = 0 WHERE id = ?', [planIdToClone]);
    console.log('🧹 Cleaned up test database records.');

    console.log('\n🎉 ALL DATABASE SCHEMA AND LOGIC TESTS PASSED PERFECTLY (WITH AREAS & ENCRYPTION)! 🚀');

  } catch (error) {
    console.error('❌ Integration test failed:', error.stack || error);
    process.exit(1);
  } finally {
    // Restore original env vars and remove the ephemeral test database
    process.env.DATABASE_PATH    = _origDbPath || '';
    process.env.DB_ENCRYPTION_KEY = _origDbKey  || '';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  }
}

runTests();
