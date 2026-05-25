#!/usr/bin/env node
// Stop hook — reads token usage from the session payload, computes duration
// using the start-time temp file, and POSTs a session record to the local API.
const fs = require('fs');
const http = require('http');

const API_PORT = process.env.PORT || 3000;

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(data);
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

    const body = JSON.stringify({
      agent: 'Claude',
      session_date: now.toISOString().slice(0, 10),
      started_at: startedAt,
      ended_at: now.toISOString(),
      duration_minutes: Math.round(durationMinutes * 10) / 10,
      input_tokens:       usage?.input_tokens                  || 0,
      output_tokens:      usage?.output_tokens                 || 0,
      cache_read_tokens:  usage?.cache_read_input_tokens       || 0,
      cache_write_tokens: usage?.cache_creation_input_tokens   || 0,
      model: process.env.CLAUDE_MODEL || null,
      source: 'hook',
    });

    const req = http.request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/code-agents',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    });
    req.on('error', () => {}); // fire-and-forget
    req.write(body);
    req.end();
  } catch (_) { /* never block Claude */ }

  // Give the HTTP request a moment to send before exiting
  setTimeout(() => process.exit(0), 500);
});
