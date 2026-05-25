const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.resolve(__dirname, '..', 'opencode-cache');

function readCacheFile(filename) {
  const filePath = path.join(CACHE_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return null;
  }
}

function parseStats(raw) {
  if (!raw) return null;
  const lines = raw.split('\n');
  const stats = {
    overview: {},
    cost_tokens: {},
    models: [],
  };

  let section = null;
  for (const line of lines) {
    const clean = line.replace(/[┌┐┘└├┤┬┴┼─│├┤]/g, '').trim();

    if (clean.includes('OVERVIEW')) { section = 'overview'; continue; }
    if (clean.includes('COST & TOKENS')) { section = 'cost'; continue; }
    if (clean.includes('MODEL USAGE')) { section = 'models'; continue; }

    if (section === 'overview') {
      const m = clean.match(/^(Sessions|Messages|Days)\s+(\S+)/);
      if (m) stats.overview[m[1].toLowerCase()] = m[2];
    }

    if (section === 'cost') {
      const m = clean.match(/^(Total Cost|Avg Cost\/Day|Avg Tokens\/Session|Median Tokens\/Session|Input|Output|Cache Read|Cache Write)\s+(.+)/);
      if (m) {
        const key = m[1].toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_per_');
        stats.cost_tokens[key] = m[2].trim();
      }
    }

    if (section === 'models') {
      const m = clean.match(/^(\S+.*?)\s+$/);
      if (m && !clean.includes('Messages') && !clean.includes('Tokens') && clean.length > 3 && !clean.includes('├') && !clean.includes('└')) {
        const modelName = clean.trim();
        if (modelName && !modelName.includes('─')) {
          stats.models.push({ name: modelName, lines: [] });
        }
      }
    }
  }

  // Simpler approach: extract numbers with regex
  const result = {
    sessions: 0,
    messages: 0,
    days: 0,
    total_cost_usd: 0,
    avg_cost_per_day_usd: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    models: [],
  };

  for (const line of lines) {
    const clean = line.replace(/[┌┐┘└├┤┬┴┼─│├┤]/g, '').trim();

    let m = clean.match(/Sessions\s+(\d+)/);
    if (m) result.sessions = parseInt(m[1], 10);

    m = clean.match(/Messages\s+(\d+)/);
    if (m) result.messages = parseInt(m[1], 10);

    m = clean.match(/Days\s+(\d+)/);
    if (m) result.days = parseInt(m[1], 10);

    m = clean.match(/Total Cost\s+\$?([\d,.]+)/);
    if (m) result.total_cost_usd = parseFloat(m[1].replace(',', ''));

    m = clean.match(/Avg Cost\/Day\s+\$?([\d,.]+)/);
    if (m) result.avg_cost_per_day_usd = parseFloat(m[1].replace(',', ''));

    m = clean.match(/Input\s+([\d.]+)([MK]?)/);
    if (m) {
      let val = parseFloat(m[1]);
      if (m[2] === 'M') val *= 1_000_000;
      if (m[2] === 'K') val *= 1_000;
      result.input_tokens = Math.round(val);
    }

    m = clean.match(/Output\s+([\d.]+)([MK]?)/);
    if (m) {
      let val = parseFloat(m[1]);
      if (m[2] === 'M') val *= 1_000_000;
      if (m[2] === 'K') val *= 1_000;
      result.output_tokens = Math.round(val);
    }

    m = clean.match(/Cache Read\s+([\d.]+)([MK]?)/);
    if (m) {
      let val = parseFloat(m[1]);
      if (m[2] === 'M') val *= 1_000_000;
      if (m[2] === 'K') val *= 1_000;
      result.cache_read_tokens = Math.round(val);
    }

    m = clean.match(/Cache Write\s+([\d.]+)([MK]?)/);
    if (m) {
      let val = parseFloat(m[1]);
      if (m[2] === 'M') val *= 1_000_000;
      if (m[2] === 'K') val *= 1_000;
      result.cache_write_tokens = Math.round(val);
    }
  }

  // Parse model blocks
  let currentModel = null;
  for (const line of lines) {
    const clean = line.replace(/[┌┐┘└├┤┬┴┼─│├┤]/g, '').trim();
    if (!clean) continue;

    // Model names are lines that look like provider/model without numbers at start
    if (/^[a-zA-Z0-9_-]+\//.test(clean) && !clean.includes('Messages') && !clean.includes('Tokens') && !clean.includes('Cost')) {
      currentModel = { name: clean, messages: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 };
      result.models.push(currentModel);
      continue;
    }

    if (currentModel) {
      let m = clean.match(/Messages\s+(\d+)/);
      if (m) currentModel.messages = parseInt(m[1], 10);

      m = clean.match(/Input Tokens\s+([\d.]+)([MK]?)/);
      if (m) {
        let val = parseFloat(m[1]);
        if (m[2] === 'M') val *= 1_000_000;
        if (m[2] === 'K') val *= 1_000;
        currentModel.input_tokens = Math.round(val);
      }

      m = clean.match(/Output Tokens\s+([\d.]+)([MK]?)/);
      if (m) {
        let val = parseFloat(m[1]);
        if (m[2] === 'M') val *= 1_000_000;
        if (m[2] === 'K') val *= 1_000;
        currentModel.output_tokens = Math.round(val);
      }

      m = clean.match(/Cache Read\s+([\d.]+)([MK]?)/);
      if (m) {
        let val = parseFloat(m[1]);
        if (m[2] === 'M') val *= 1_000_000;
        if (m[2] === 'K') val *= 1_000;
        currentModel.cache_read_tokens = Math.round(val);
      }

      m = clean.match(/Cache Write\s+([\d.]+)([MK]?)/);
      if (m) {
        let val = parseFloat(m[1]);
        if (m[2] === 'M') val *= 1_000_000;
        if (m[2] === 'K') val *= 1_000;
        currentModel.cache_write_tokens = Math.round(val);
      }

      m = clean.match(/Cost\s+\$?([\d,.]+)/);
      if (m) currentModel.cost_usd = parseFloat(m[1].replace(',', ''));
    }
  }

  return result;
}

// GET /api/opencode/sessions
router.get('/sessions', (req, res) => {
  const raw = readCacheFile('sessions.json');
  if (!raw) {
    return res.json({ sessions: [], lastSync: null, source: 'opencode-cache' });
  }
  try {
    const sessions = JSON.parse(raw);
    const lastSyncRaw = readCacheFile('last-sync.txt');
    res.json({ sessions, lastSync: lastSyncRaw ? lastSyncRaw.trim() : null, source: 'opencode-cache' });
  } catch (err) {
    console.error('[OpencodeRoute] Failed to parse sessions cache:', err.message);
    res.status(500).json({ error: 'Failed to parse OpenCode session cache' });
  }
});

// GET /api/opencode/stats
router.get('/stats', (req, res) => {
  const raw = readCacheFile('stats.raw.txt');
  const lastSyncRaw = readCacheFile('last-sync.txt');
  if (!raw) {
    return res.json({ stats: null, lastSync: lastSyncRaw ? lastSyncRaw.trim() : null, source: 'opencode-cache' });
  }
  try {
    const stats = parseStats(raw);
    res.json({ stats, lastSync: lastSyncRaw ? lastSyncRaw.trim() : null, source: 'opencode-cache' });
  } catch (err) {
    console.error('[OpencodeRoute] Failed to parse stats cache:', err.message);
    res.status(500).json({ error: 'Failed to parse OpenCode stats cache' });
  }
});

// GET /api/opencode/sync — trigger sync if the backend has access to the opencode CLI
// (only works if opencode CLI is available inside the container or on the host via exec)
router.get('/sync', async (req, res) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);

  // Try to find opencode binary
  const candidates = [
    'opencode',
    '/root/.opencode/bin/opencode',
    '/usr/local/bin/opencode',
    '/usr/bin/opencode',
  ];

  let opencodePath = null;
  for (const c of candidates) {
    try {
      await execAsync(`test -x ${c}`);
      opencodePath = c;
      break;
    } catch (_) {}
  }

  if (!opencodePath) {
    return res.status(503).json({
      error: 'OpenCode CLI not found in this environment.',
      hint: 'Run ./scripts/sync-opencode.sh on the host machine, then refresh this page.',
    });
  }

  try {
    await execAsync(`"${opencodePath}" session list --format json > ${CACHE_DIR}/sessions.json`, { timeout: 60000 });
    await execAsync(`"${opencodePath}" stats --days 30 --models > ${CACHE_DIR}/stats.raw.txt`, { timeout: 30000 });
    await execAsync(`date -u +"%Y-%m-%dT%H:%M:%SZ" > ${CACHE_DIR}/last-sync.txt`);
    res.json({ success: true, message: 'OpenCode data synced successfully' });
  } catch (err) {
    console.error('[OpencodeRoute] Sync failed:', err.message);
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

module.exports = router;
