const crypto = require('crypto');

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
 * Require a shared API token on every request. Accepts either:
 *   Authorization: Bearer <token>
 *   x-api-key: <token>
 *
 * Fails closed: if API_AUTH_TOKEN is not configured the server refuses all
 * requests rather than silently running open.
 */
function requireApiToken(req, res, next) {
  const expected = process.env.API_AUTH_TOKEN;
  if (!expected) {
    console.error('[Auth] API_AUTH_TOKEN is not configured — refusing API request.');
    return res.status(503).json({ error: 'Server authentication is not configured.' });
  }

  let provided = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  if (!provided && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    provided = authHeader.slice(7);
  }

  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireApiToken, safeEqual };
