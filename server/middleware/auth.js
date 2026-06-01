const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// The token enforced for the lifetime of this process. Set by resolveApiToken()
// at startup (env var, persisted file, or freshly generated).
let activeToken = null;

/**
 * Constant-time string comparison that does not leak length via early return
 * timing. Returns false for any non-matching or mismatched-length input.
 */
function safeEqual(provided, expected) {
  const a = Buffer.from(String(provided ?? ''));
  const b = Buffer.from(String(expected ?? ''));
  // Hash both sides to a fixed length so timingSafeEqual never throws on
  // length mismatch and length itself is not observable.
  const ah = crypto.createHash('sha256').update(a).digest();
  const bh = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ah, bh) && a.length === b.length;
}

/**
 * Determine the API token to enforce, in priority order:
 *   1. API_AUTH_TOKEN env var  — explicit config (e.g. production) always wins.
 *   2. Persisted token file    — auto-generated on a previous run; stable across
 *                                restarts (lives next to the DB / in the data volume).
 *   3. Freshly generated       — created on first run and written to the file.
 *
 * Returns { token, source } where source is 'env' | 'file' | 'generated'.
 * Must be called once at startup before requests are served.
 */
function resolveApiToken(tokenFilePath) {
  // 1. Explicit env var takes precedence and is never persisted.
  if (process.env.API_AUTH_TOKEN) {
    activeToken = process.env.API_AUTH_TOKEN;
    return { token: activeToken, source: 'env' };
  }

  // 2. Reuse a previously persisted token so it stays stable across restarts.
  try {
    if (tokenFilePath && fs.existsSync(tokenFilePath)) {
      const fromFile = fs.readFileSync(tokenFilePath, 'utf8').trim();
      if (fromFile) {
        activeToken = fromFile;
        return { token: activeToken, source: 'file' };
      }
    }
  } catch (_) { /* fall through to generation */ }

  // 3. First run with no token anywhere — generate one and persist it.
  const generated = crypto.randomBytes(32).toString('hex');
  activeToken = generated;
  try {
    if (tokenFilePath) {
      fs.mkdirSync(path.dirname(tokenFilePath), { recursive: true });
      fs.writeFileSync(tokenFilePath, generated + '\n', { mode: 0o600 });
    }
  } catch (e) {
    // Persisting failed (read-only fs?) — still usable this run, but it will
    // differ after the next restart. Surface it so the user can fix perms.
    console.error('[Auth] Could not persist generated API token:', e.message);
  }
  return { token: activeToken, source: 'generated' };
}

function getActiveToken() {
  return activeToken;
}

/**
 * Require the resolved API token on every request. Accepts either:
 *   Authorization: Bearer <token>
 *   x-api-key: <token>
 * Fails closed (503) if no token has been resolved yet.
 */
function requireApiToken(req, res, next) {
  if (!activeToken) {
    console.error('[Auth] No API token resolved — refusing API request.');
    return res.status(503).json({ error: 'Server authentication is not configured.' });
  }

  let provided = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  if (!provided && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    provided = authHeader.slice(7);
  }

  if (!provided || !safeEqual(provided, activeToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireApiToken, safeEqual, resolveApiToken, getActiveToken };
