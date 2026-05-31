#!/usr/bin/env node
// Stop hook — reads token usage from the session payload or transcript,
// computes duration, and POSTs a session record to the local and external APIs.
// Handles offline caching and queuing for failed transmissions.

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const API_PORT = process.env.PORT || 3000;
// Optional external telemetry endpoint; when unset, external posting is skipped.
const EXTERNAL_URL = process.env.GEMINI_EXTERNAL_STATS_API || '';
const SCRATCH_DIR = process.env.GEMINI_SCRATCH_DIR ||
  path.join(process.env.HOME || '/tmp', '.gemini', 'antigravity-cli', 'scratch');
const PENDING_DIR = path.join(SCRATCH_DIR, 'pending_stats');

// Promise-based fire-and-forget request helper
function postPayload(targetUrl, payloadObj) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(targetUrl);
      const protocol = url.protocol === 'https:' ? https : http;
      const body = JSON.stringify(payloadObj);
      const req = protocol.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 4000,
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();

      req.on('response', (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`Server returned status code ${res.statusCode}`));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Estimate tokens by parsing the JSONL transcript file
function estimateTokensFromTranscript(transcriptPath) {
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    if (fs.existsSync(transcriptPath)) {
      const content = fs.readFileSync(transcriptPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const step = JSON.parse(line);
          const text = step.content || '';
          if (step.source === 'MODEL') {
            outputTokens += Math.ceil(text.length / 4);
            if (step.tool_calls) {
              outputTokens += Math.ceil(JSON.stringify(step.tool_calls).length / 4);
            }
          } else {
            inputTokens += Math.ceil(text.length / 4);
          }
        } catch (e) {
          // ignore invalid lines
        }
      }
    }
  } catch (e) {
    // ignore filesystem errors
  }

  return { inputTokens, outputTokens };
}

// Process previously failed statistics posts
async function processPendingStats(targetUrl, pendingDir) {
  if (!fs.existsSync(pendingDir)) return;
  try {
    const files = fs.readdirSync(pendingDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(pendingDir, file);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const payloadObj = JSON.parse(fileContent);
        await postPayload(targetUrl, payloadObj);
        fs.unlinkSync(filePath);
      } catch (e) {
        // Keep file to retry in a future session
      }
    }
  } catch (err) {
    // ignore directory read errors
  }
}

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', async () => {
  try {
    let payload = {};
    try {
      payload = JSON.parse(data);
    } catch (e) {
      // fallback if stdin is empty
    }

    const sessionId = payload.session_id || payload.conversationId || payload.context?.conversationId;
    if (!sessionId) return process.exit(0);

    const tmpFile = path.join(SCRATCH_DIR, `calendarly_gemini_${sessionId}.json`);
    const now = new Date();
    let startedAt = now.toISOString();
    let durationMinutes = 5; // fallback

    if (fs.existsSync(tmpFile)) {
      try {
        const startData = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
        startedAt = startData.started_at;
        durationMinutes = (now - new Date(startedAt)) / 60000;
        fs.unlinkSync(tmpFile);
      } catch (e) {
        // ignore
      }
    }

    // Determine token usage
    let inputTokens = payload.usage?.input_tokens || 0;
    let outputTokens = payload.usage?.output_tokens || 0;
    let cacheReadTokens = payload.usage?.cache_read_input_tokens || 0;
    let cacheWriteTokens = payload.usage?.cache_creation_input_tokens || 0;

    // If usage is 0 or empty, try estimating from the transcript file
    const transcriptPath = payload.context?.transcriptPath || 
      path.join(SCRATCH_DIR, `../brain/${sessionId}/.system_generated/logs/transcript.jsonl`);
    
    if (inputTokens === 0 && outputTokens === 0) {
      const estimated = estimateTokensFromTranscript(transcriptPath);
      inputTokens = estimated.inputTokens;
      outputTokens = estimated.outputTokens;
    }

    // Determine model name
    const modelName = process.env.GEMINI_AGENT_NAME || process.env.CLAUDE_MODEL || 'Gemini 3.5 Flash';

    const body = {
      agent: 'Gemini',
      session_date: now.toISOString().slice(0, 10),
      started_at: startedAt,
      ended_at: now.toISOString(),
      duration_minutes: Math.round(durationMinutes * 10) / 10,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheReadTokens,
      cache_write_tokens: cacheWriteTokens,
      model: modelName,
      source: 'hook',
    };

    // 1. Send to local Calendarly API
    try {
      await postPayload(`http://localhost:${API_PORT}/api/code-agents`, body);
    } catch (e) {
      // Local server might be offline, ignore so we don't block
    }

    // 2. Send to external telemetry API (only if an endpoint is configured)
    if (EXTERNAL_URL) {
      try {
        await postPayload(EXTERNAL_URL, body);
      } catch (e) {
        // External API is down or user is offline! Save data to post it later.
        if (!fs.existsSync(PENDING_DIR)) {
          fs.mkdirSync(PENDING_DIR, { recursive: true });
        }
        const queueFile = path.join(PENDING_DIR, `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.json`);
        fs.writeFileSync(queueFile, JSON.stringify(body));
      }

      // 3. Attempt to flush previously queued stats if we are online now
      await processPendingStats(EXTERNAL_URL, PENDING_DIR);
    }

  } catch (_) {
    // never block execution
  }

  // Ensure prompt exits
  process.exit(0);
});
