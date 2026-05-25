const path = require('path');
const express = require('express');
const multer = require('multer');
const decompress = require('decompress');
const fs = require('fs');
const router = express.Router();

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const GRAPHIFY_OUT = path.join(WORKSPACE_ROOT, 'graphify-out');
const UPLOAD_TEMP_DIR = path.join(WORKSPACE_ROOT, '.tmp-uploads');

// Ensure temp upload dir exists
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
  fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_TEMP_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.zip', '.tar', '.tgz'];
    // Handle .tar.gz by checking if originalname ends with .tar.gz
    if (
      allowedExts.includes(ext) ||
      file.originalname.toLowerCase().endsWith('.tar.gz')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip, .tar, .tar.gz, and .tgz archives are allowed.'));
    }
  }
});

// ── Middleware: Password Gate ──
function requireUploadPassword(req, res, next) {
  const expected = process.env.SECRET_UPLOAD_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: 'Upload password not configured on server.' });
  }
  const provided = req.headers['x-upload-password'];
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing upload password.' });
  }
  next();
}

// ── POST /api/upload/graphify ──
router.post(
  '/graphify',
  requireUploadPassword,
  upload.single('archive'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No archive file provided.' });
    }

    const archivePath = req.file.path;

    try {
      // Remove existing graphify-out if present
      if (fs.existsSync(GRAPHIFY_OUT)) {
        fs.rmSync(GRAPHIFY_OUT, { recursive: true, force: true });
      }

      // Ensure target directory exists
      fs.mkdirSync(GRAPHIFY_OUT, { recursive: true });

      // Extract archive
      const files = await decompress(archivePath, GRAPHIFY_OUT);

      // Prevent zip-slip path traversal: ensure no extracted entry escapes GRAPHIFY_OUT
      const OUT_PREFIX = path.resolve(GRAPHIFY_OUT) + path.sep;
      for (const f of files) {
        if (!path.resolve(GRAPHIFY_OUT, f.path).startsWith(OUT_PREFIX)) {
          fs.rmSync(GRAPHIFY_OUT, { recursive: true, force: true });
          throw new Error(`Path traversal attempt blocked: ${f.path}`);
        }
      }

      // Clean up temp archive
      fs.unlinkSync(archivePath);

      // If the archive contained a single root folder named "graphify-out",
      // move its contents up one level so the root is directly graphify-out/.
      const entries = fs.readdirSync(GRAPHIFY_OUT);
      if (
        entries.length === 1 &&
        entries[0].toLowerCase() === 'graphify-out' &&
        fs.statSync(path.join(GRAPHIFY_OUT, entries[0])).isDirectory()
      ) {
        const nested = path.join(GRAPHIFY_OUT, entries[0]);
        const nestedEntries = fs.readdirSync(nested);
        for (const entry of nestedEntries) {
          fs.renameSync(path.join(nested, entry), path.join(GRAPHIFY_OUT, entry));
        }
        fs.rmdirSync(nested);
      }

      return res.json({
        success: true,
        message: 'Archive uploaded and extracted successfully.',
        extractedCount: files.length,
        destination: GRAPHIFY_OUT
      });
    } catch (error) {
      console.error('[Upload] Extraction error:', error);
      // Attempt cleanup of temp file
      try {
        if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
      } catch (e) { /* ignore */ }
      return res.status(500).json({ error: 'Failed to extract archive.', details: error.message });
    }
  }
);

// ── GET /api/upload/graphify/status ──
router.get('/graphify/status', requireUploadPassword, (req, res) => {
  const exists = fs.existsSync(GRAPHIFY_OUT);
  let stats = null;
  if (exists) {
    const entries = fs.readdirSync(GRAPHIFY_OUT);
    stats = {
      exists: true,
      entryCount: entries.length,
      topEntries: entries.slice(0, 20)
    };
  }
  res.json({ exists, stats });
});

module.exports = router;
