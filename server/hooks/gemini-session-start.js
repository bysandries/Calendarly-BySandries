#!/usr/bin/env node
// PreToolUse hook — records the Gemini session start time.
// Subsequent calls for the same session_id are no-ops.
const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(data);
    const sessionId = payload.session_id || payload.conversationId || payload.context?.conversationId;
    if (!sessionId) return process.exit(0);

    const scratchDir = process.env.GEMINI_SCRATCH_DIR ||
      path.join(process.env.HOME || '/tmp', '.gemini', 'antigravity-cli', 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    const tmpFile = path.join(scratchDir, `calendarly_gemini_${sessionId}.json`);
    if (!fs.existsSync(tmpFile)) {
      fs.writeFileSync(tmpFile, JSON.stringify({ started_at: new Date().toISOString() }));
    }
  } catch (_) { /* never block execution */ }
  process.exit(0);
});
