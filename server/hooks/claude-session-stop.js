#!/usr/bin/env node
// Stop hook — reads token usage from the session payload, computes duration
// using the start-time temp file, and POSTs a session record to AGENTS_API_URL.
// If the API is unreachable the payload is written to QUEUE_FILE and retried
// on the next session end (or by the hourly flush-pending-queue.js launchd job).
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

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

const QUEUE_FILE = path.join(
  process.env.HOME || '/tmp',
  '.claude',
  'agents_queue.jsonl'
);

function postPayload(targetUrl, payloadObj) {
  return new Promise(resolve => {
    try {
      const url = new URL(targetUrl);
      const protocol = url.protocol === 'https:' ? https : http;
      const body = JSON.stringify(payloadObj);
      const req = protocol.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 5000,
        },
        res => resolve(res.statusCode >= 200 && res.statusCode < 300)
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(body);
      req.end();
    } catch (_) { resolve(false); }
  });
}

function readQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    return fs.readFileSync(QUEUE_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l));
  } catch (_) { return []; }
}

function writeQueue(items) {
  if (items.length === 0) {
    if (fs.existsSync(QUEUE_FILE)) fs.unlinkSync(QUEUE_FILE);
    return;
  }
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUEUE_FILE, items.map(i => JSON.stringify(i)).join('\n') + '\n');
}

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

    const body = {
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
    };

    // Load any previously queued items and add the new one
    const queue = readQueue();
    queue.push(body);

    // Try to flush the full queue
    const remaining = [];
    for (const item of queue) {
      const ok = await postPayload(API_URL, item);
      if (!ok) remaining.push(item);
    }

    writeQueue(remaining);
  } catch (_) { /* never block Claude */ }

  process.exit(0);
});
