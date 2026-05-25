#!/usr/bin/env node
/**
 * import-claude-sessions.js
 *
 * Scans all Claude Code transcript files in ~/.claude/projects/,
 * aggregates token usage per session, and POSTs each session to the
 * AGENTS_API_URL endpoint. Already-imported sessions are skipped via
 * a unique ID derived from the session UUID.
 *
 * Usage:
 *   node server/scripts/import-claude-sessions.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

const REMOTE_URL = process.env.AGENTS_API_URL || null;
const LOCAL_URL  = `http://localhost:${process.env.PORT || 3000}/api/code-agents`;
const DRY_RUN    = process.argv.includes('--dry-run');
const DIRECT_DB  = process.argv.includes('--direct');  // bypass HTTP, write straight to SQLite
const PROJECTS = path.join(os.homedir(), '.claude', 'projects');

// Anthropic pricing per million tokens (May 2026)
const RATES = {
  'claude-opus-4-7':   { input: 15,  output: 75,  cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3,   output: 15,  cacheRead: 0.3,  cacheWrite: 3.75  },
  'claude-haiku-4-5':  { input: 0.8, output: 4,   cacheRead: 0.08, cacheWrite: 1     },
  // Older model aliases
  'claude-opus-4-5':   { input: 15,  output: 75,  cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-sonnet-4-5': { input: 3,   output: 15,  cacheRead: 0.3,  cacheWrite: 3.75  },
};
const DEFAULT_RATE = RATES['claude-sonnet-4-6'];

function estimateCost(model, inTok, outTok, cacheRead, cacheWrite) {
  const r = RATES[model] || DEFAULT_RATE;
  return (
    (inTok     / 1e6) * r.input      +
    (outTok    / 1e6) * r.output     +
    (cacheRead / 1e6) * r.cacheRead  +
    (cacheWrite/ 1e6) * r.cacheWrite
  );
}

// ── Parse one JSONL session file ─────────────────────────────────────────────
function parseSession(filePath) {
  const sessionId = path.basename(filePath, '.jsonl');
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  const allMessages = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try { allMessages.push(JSON.parse(t)); } catch { /* skip corrupt lines */ }
  }

  // Collect assistant messages that have usage
  const asstMap = {};  // uuid → message
  for (const msg of allMessages) {
    if (msg.type === 'assistant' && msg.message?.usage) {
      asstMap[msg.uuid] = msg;
    }
  }

  if (Object.keys(asstMap).length === 0) return null;

  // Deduplicate streaming pairs: skip any assistant message whose parent is
  // another assistant message with the exact same token counts.
  const usageKey = (u) =>
    `${u.input_tokens}|${u.output_tokens}|${u.cache_read_input_tokens || 0}|${u.cache_creation_input_tokens || 0}`;

  const uniqueAsst = [];
  for (const msg of Object.values(asstMap)) {
    const parentMsg = asstMap[msg.parentUuid];
    if (parentMsg && usageKey(parentMsg.message.usage) === usageKey(msg.message.usage)) {
      continue; // streaming duplicate — skip
    }
    uniqueAsst.push(msg);
  }

  if (uniqueAsst.length === 0) return null;

  // Sort by timestamp
  uniqueAsst.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Aggregate tokens and pick dominant model
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0;
  const modelCounts = {};

  for (const msg of uniqueAsst) {
    const u = msg.message.usage;
    inputTokens      += u.input_tokens                  || 0;
    outputTokens     += u.output_tokens                 || 0;
    cacheReadTokens  += u.cache_read_input_tokens       || 0;
    cacheWriteTokens += u.cache_creation_input_tokens   || 0;
    const m = msg.message.model || 'unknown';
    modelCounts[m] = (modelCounts[m] || 0) + 1;
  }

  const model = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0][0];

  // Timestamps
  const startedAt = uniqueAsst[0].timestamp;
  const endedAt   = uniqueAsst[uniqueAsst.length - 1].timestamp;
  const durationMinutes =
    (new Date(endedAt) - new Date(startedAt)) / 60000;

  // Project context from directory name
  const dirName = path.basename(path.dirname(filePath));
  const projectContext = dirName
    .replace(/^-Users-[^-]+-/, '')      // strip leading -Users-<name>-
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    id:               `claude-import-${sessionId}`,  // stable & dedup-safe
    agent:            'Claude',
    session_date:     startedAt.slice(0, 10),
    started_at:       startedAt,
    ended_at:         endedAt,
    duration_minutes: Math.round(Math.max(durationMinutes, 0) * 10) / 10,
    input_tokens:     inputTokens,
    output_tokens:    outputTokens,
    cache_read_tokens:  cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    total_cost_usd:   estimateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens),
    model,
    project_context:  projectContext,
    notes:            `Imported from transcript. ${uniqueAsst.length} API turn(s).`,
    source:           'import',
  };
}

// ── POST one session to a given URL ──────────────────────────────────────────
async function postTo(url, session) {
  return fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(session),
    signal:  AbortSignal.timeout(8000),
  });
}

// ── Write directly to SQLite (bypasses HTTP, works even without server restart)
async function insertDirect(db, session) {
  const result = await db.run(
    `INSERT OR IGNORE INTO code_agent_sessions
      (id, agent, session_date, started_at, ended_at, duration_minutes,
       input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
       total_cost_usd, model, project_context, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id, session.agent, session.session_date, session.started_at,
      session.ended_at || null, session.duration_minutes,
      session.input_tokens, session.output_tokens,
      session.cache_read_tokens, session.cache_write_tokens,
      session.total_cost_usd, session.model || null,
      session.project_context || null, session.notes || null, session.source,
    ]
  );
  return result.changes; // 1 = inserted, 0 = already existed
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(PROJECTS)) {
    console.error('No Claude projects directory found at', PROJECTS);
    process.exit(1);
  }

  // Open direct DB connection when --direct flag is used
  let db = null;
  if (DIRECT_DB && !DRY_RUN) {
    const { initDatabase, getDbConnection } = require('../db');
    await initDatabase(false);  // ensures code_agent_sessions table exists
    db = await getDbConnection();
    console.log('Using direct SQLite connection.\n');
  } else if (!DRY_RUN) {
    console.log(`Posting to: ${LOCAL_URL}`);
    if (REMOTE_URL) console.log(`Also syncing to: ${REMOTE_URL}`);
    console.log();
  }

  // Gather all .jsonl files recursively
  const jsonlFiles = [];
  for (const proj of fs.readdirSync(PROJECTS)) {
    const projDir = path.join(PROJECTS, proj);
    if (!fs.statSync(projDir).isDirectory()) continue;
    for (const file of fs.readdirSync(projDir)) {
      if (file.endsWith('.jsonl')) jsonlFiles.push(path.join(projDir, file));
    }
  }

  console.log(`Found ${jsonlFiles.length} transcript files across all projects.`);
  if (DRY_RUN) console.log('[DRY RUN — no data will be sent]\n');

  let parsed = 0, skippedEmpty = 0, imported = 0, alreadyExists = 0, failed = 0;

  for (const file of jsonlFiles) {
    const session = parseSession(file);
    if (!session) { skippedEmpty++; continue; }
    parsed++;

    const totalTokens = session.input_tokens + session.output_tokens;
    const label = `${session.session_date} | ${session.project_context} | ${session.model} | in=${session.input_tokens.toLocaleString()} out=${session.output_tokens.toLocaleString()} | $${session.total_cost_usd.toFixed(4)}`;

    if (DRY_RUN) {
      console.log('  [WOULD IMPORT]', label);
      imported++;
      continue;
    }

    if (db) {
      // ── Direct SQLite path ─────────────────────────────────────────────────
      try {
        const changes = await insertDirect(db, session);
        if (changes === 1) {
          imported++;
          console.log('  ✓', label);
          // Fire-and-forget to remote endpoint for sync
          if (REMOTE_URL) postTo(REMOTE_URL, session).catch(() => {});
        } else {
          alreadyExists++;
          console.log('  · duplicate:', session.session_date, session.project_context);
        }
      } catch (err) {
        failed++;
        console.warn('  ✗ db error:', err.message);
      }
    } else {
      // ── HTTP API path ──────────────────────────────────────────────────────
      let localOk = false;
      try {
        const res = await postTo(LOCAL_URL, session);
        if (res.status === 201) {
          localOk = true;
        } else if (res.status === 409) {
          alreadyExists++;
          console.log('  · duplicate:', session.session_date, session.project_context);
          if (REMOTE_URL) postTo(REMOTE_URL, session).catch(() => {});
          continue;
        } else {
          const body = await res.text();
          console.warn('  ✗ local failed', res.status, body.slice(0, 80));
        }
      } catch (err) {
        console.warn('  ✗ local error:', err.message);
      }
      if (REMOTE_URL) postTo(REMOTE_URL, session).catch(() => {});
      if (localOk) { imported++; console.log('  ✓', label); }
      else failed++;
    }
  }

  console.log(`
─────────────────────────────────────────
  Transcripts scanned : ${jsonlFiles.length}
  Skipped (no usage)  : ${skippedEmpty}
  Parsed              : ${parsed}
  Imported            : ${imported}
  Already existed     : ${alreadyExists}
  Failed              : ${failed}
─────────────────────────────────────────`);
}

main().catch(err => { console.error(err); process.exit(1); });
