#!/usr/bin/env node
// Stop hook — reads token usage from the session payload, computes duration
// using the start-time temp file, and POSTs a session record to AGENTS_API_URL.
//
// AGENTS_API_URL is set in:
//   • .claude/settings.json  (env block — injected by Claude Code into hook processes)
//   • server/.env            (fallback for manual / out-of-Claude-Code runs)
const fs = require('fs');
const path = require('path');

// Load server/.env so the variable is available even outside Claude Code
try {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  }
} catch (_) {}

const API_URL =
  process.env.AGENTS_API_URL ||
  `http://localhost:${process.env.PORT || 3000}/api/code-agents`;

let raw = '';
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', async () => {
  try {
    const payload = JSON.parse(raw);
    const { session_id, usage } = payload;
    if (!session_id) return process.exit(0);

    const tmpFile = `/tmp/calendarly_claude_${session_id}.json`;
    const now = new Date();
    let startedAt = now.toISOString();
    let durationMinutes = 0;

    if (fs.existsSync(tmpFile)) {
      const startData = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
      startedAt = startData.started_at;
      durationMinutes = (now - new Date(startedAt)) / 60000;
      fs.unlinkSync(tmpFile);
    }

    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: 'Claude',
        session_date: now.toISOString().slice(0, 10),
        started_at: startedAt,
        ended_at: now.toISOString(),
        duration_minutes: Math.round(durationMinutes * 10) / 10,
        input_tokens:       usage?.input_tokens                || 0,
        output_tokens:      usage?.output_tokens               || 0,
        cache_read_tokens:  usage?.cache_read_input_tokens     || 0,
        cache_write_tokens: usage?.cache_creation_input_tokens || 0,
        model: process.env.CLAUDE_MODEL || null,
        source: 'hook',
      }),
      signal: AbortSignal.timeout(5000), // never block Claude beyond 5 s
    });
  } catch (_) { /* fire-and-forget — never block Claude */ }

  process.exit(0);
});
