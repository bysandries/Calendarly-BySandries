#!/usr/bin/env node
// PreToolUse hook — records the session start time on first tool call.
// Subsequent calls for the same session_id are no-ops.
const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(data);
    const sessionId = payload.session_id;
    if (!sessionId) return process.exit(0);

    const tmpFile = `/tmp/calendarly_claude_${sessionId}.json`;
    if (!fs.existsSync(tmpFile)) {
      fs.writeFileSync(tmpFile, JSON.stringify({ started_at: new Date().toISOString() }));
    }
  } catch (_) { /* never block Claude */ }
  process.exit(0);
});
