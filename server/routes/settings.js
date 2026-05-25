const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDbConnection, closeDbConnection, verifyAndRekeyDatabase } = require('../db');
const { runBackup } = require('../backup-db');

const ENV_PATH = path.resolve(__dirname, '../.env');

// Helper to safely write environment variables preserving comments
function writeEnvFile(updates) {
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  }

  const lines = content.split('\n');
  const updatedKeys = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#') && line.includes('=')) {
      const equalIndex = line.indexOf('=');
      const key = line.substring(0, equalIndex).trim();
      if (updates.hasOwnProperty(key)) {
        // Enclose in quotes if it has spaces or is encryption key
        let val = updates[key];
        if (typeof val === 'string' && (val.includes(' ') || key === 'DB_ENCRYPTION_KEY')) {
          val = `"${val.replace(/"/g, '\\"')}"`;
        }
        lines[i] = `${key}=${val}`;
        updatedKeys.add(key);
      }
    }
  }

  // Add any new keys
  for (const key in updates) {
    if (!updatedKeys.has(key)) {
      let val = updates[key];
      if (typeof val === 'string' && (val.includes(' ') || key === 'DB_ENCRYPTION_KEY')) {
        val = `"${val.replace(/"/g, '\\"')}"`;
      }
      lines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf8');

  // Sync in-memory process.env as well so hot-reloading works instantly!
  for (const key in updates) {
    process.env[key] = updates[key];
  }
}

// Helper to mask sensitive keys
function maskSecret(val) {
  if (!val) return '';
  if (val.length <= 8) return '********';
  return val.slice(0, 4) + '...' + val.slice(-4);
}

// ── 1. GET Settings ──
router.get('/', async (req, res) => {
  try {
    const database = await getDbConnection();
    
    // Get general settings from database settings table
    const rows = await database.all('SELECT key, value FROM settings');
    const dbSettings = {};
    rows.forEach(row => {
      dbSettings[row.key] = row.value;
    });

    // Parse pillars safely
    if (dbSettings.palm_pillars) {
      try {
        dbSettings.palm_pillars = JSON.parse(dbSettings.palm_pillars);
      } catch (_) {
        dbSettings.palm_pillars = null;
      }
    }

    // Get sanitized environment variables
    const envSettings = {
      PORT: process.env.PORT || '3000',
      NODE_ENV: process.env.NODE_ENV || 'development',
      DB_ENCRYPTION_KEY: maskSecret(process.env.DB_ENCRYPTION_KEY),
      GEMINI_API_KEY: maskSecret(process.env.GEMINI_API_KEY),
      // Booleans indicating if variables exist
      hasDbKey: !!process.env.DB_ENCRYPTION_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY
    };

    // Get list of database files inside server/backups
    const backupsDir = path.resolve(__dirname, '../backups');
    let dbBackups = [];
    if (fs.existsSync(backupsDir)) {
      dbBackups = fs.readdirSync(backupsDir)
        .filter(file => file.endsWith('.db') || file.endsWith('.sqlite'))
        .map(file => {
          const stats = fs.statSync(path.join(backupsDir, file));
          return {
            filename: file,
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            mtime: stats.mtime.toISOString(),
            isActive: false
          };
        });
    }

    // Get active database file size
    const activeDbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../calendarly.db');
    let activeDbInfo = { filename: path.basename(activeDbPath), size: '0.00 MB', mtime: new Date().toISOString(), isActive: true };
    if (fs.existsSync(activeDbPath)) {
      const stats = fs.statSync(activeDbPath);
      activeDbInfo.size = (stats.size / 1024 / 1024).toFixed(2) + ' MB';
      activeDbInfo.mtime = stats.mtime.toISOString();
    }

    // Merge active database and backup profiles
    const databases = [activeDbInfo, ...dbBackups];

    res.json({
      success: true,
      database: dbSettings,
      environment: envSettings,
      databases: databases
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings from server' });
  }
});

// ── 2. POST Save Settings (Database only) ──
router.post('/', async (req, res) => {
  try {
    const database = await getDbConnection();
    const settings = req.body;

    await database.run('BEGIN TRANSACTION');
    try {
      for (const key in settings) {
        let val = settings[key];
        if (typeof val === 'object') {
          val = JSON.stringify(val);
        }
        await database.run(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
          [key, val, val]
        );
      }
      await database.run('COMMIT');
    } catch (txErr) {
      await database.run('ROLLBACK');
      throw txErr;
    }

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving database settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
});

// ── 3. POST Save Environment Variables (.env) ──
router.post('/env', async (req, res) => {
  try {
    const updates = req.body;
    const cleanUpdates = {};

    // Validate and skip masked placeholders
    for (const key in updates) {
      const val = updates[key];
      if (val && !val.includes('...')) {
        cleanUpdates[key] = val;
      }
    }

    // Special behavior: If DB_ENCRYPTION_KEY changed, re-key the active database BEFORE saving the env file
    if (cleanUpdates.DB_ENCRYPTION_KEY && cleanUpdates.DB_ENCRYPTION_KEY !== process.env.DB_ENCRYPTION_KEY) {
      console.log('🔒 DB_ENCRYPTION_KEY update detected. Re-encrypting active SQLite database...');
      const database = await getDbConnection();
      
      const newKey = cleanUpdates.DB_ENCRYPTION_KEY;
      // SQLCipher PRAGMA rekey changes active encryption key of currently opened DB
      await database.run(`PRAGMA rekey = ${JSON.stringify(newKey)}`);
      console.log('✅ Active SQLite database successfully re-encrypted with new key.');
    }

    // Write updates to .env and sync process.env
    writeEnvFile(cleanUpdates);

    res.json({
      success: true,
      message: 'Environment configurations updated successfully',
      environment: {
        PORT: process.env.PORT || '3000',
        NODE_ENV: process.env.NODE_ENV || 'development',
        DB_ENCRYPTION_KEY: maskSecret(process.env.DB_ENCRYPTION_KEY),
        GEMINI_API_KEY: maskSecret(process.env.GEMINI_API_KEY),
        hasDbKey: !!process.env.DB_ENCRYPTION_KEY,
        hasGeminiKey: !!process.env.GEMINI_API_KEY
      }
    });
  } catch (error) {
    console.error('Error writing environmental variables:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update environment keys' });
  }
});

// ── 4. GET Download Database Backup ──
router.get('/backup/download', async (req, res) => {
  try {
    // Run the backup utility first to create fresh database dump
    runBackup();

    const backupsDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupsDir)) {
      return res.status(404).json({ success: false, error: 'No backups found' });
    }

    // Find the latest backup file
    const files = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith('calendarly_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupsDir, file),
        time: fs.statSync(path.join(backupsDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // newest first

    if (files.length === 0) {
      return res.status(404).json({ success: false, error: 'Failed to generate backup file' });
    }

    const latestBackup = files[0];
    res.download(latestBackup.path, latestBackup.name);
  } catch (error) {
    console.error('Error serving database download:', error);
    res.status(500).json({ success: false, error: 'Database backup download failed' });
  }
});

// ── 5. POST Upload Database Backup Profile ──
router.post('/backup/upload', async (req, res) => {
  const backupsDir = path.resolve(__dirname, '../backups');
  
  try {
    const { database: base64Db, filename, candidateKey, activateImmediately } = req.body;

    if (!base64Db) {
      return res.status(400).json({ success: false, error: 'No database backup file uploaded' });
    }

    // Sanitize filename to prevent directory traversal
    let safeFilename = (filename || 'uploaded_backup.db').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename.endsWith('.db') && !safeFilename.endsWith('.sqlite')) {
      safeFilename += '.db';
    }

    // Ensure backups directory exists
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const tmpUploadPath = path.join(backupsDir, safeFilename + '.tmp');
    const finalBackupPath = path.join(backupsDir, safeFilename);

    // 1. Save uploaded file to temporary path inside backups directory
    const buffer = Buffer.from(base64Db, 'base64');
    fs.writeFileSync(tmpUploadPath, buffer);

    // 2. Perform connection, integrity, and re-key verification on tmp file
    const activeKey = process.env.DB_ENCRYPTION_KEY || '';
    
    let success = false;
    let needsDecryptionPrompt = false;

    try {
      await verifyAndRekeyDatabase(tmpUploadPath, activeKey, activeKey);
      success = true;
    } catch (err) {
      if (candidateKey !== undefined) {
        try {
          await verifyAndRekeyDatabase(tmpUploadPath, candidateKey, activeKey);
          success = true;
        } catch (candidateErr) {
          if (fs.existsSync(tmpUploadPath)) fs.unlinkSync(tmpUploadPath);
          return res.status(400).json({
            success: false,
            error: 'The decryption key provided for this database is invalid. Restore aborted.'
          });
        }
      } else {
        needsDecryptionPrompt = true;
      }
    }

    // 3. Prompt user for decryption key if active key failed and no candidateKey was sent
    if (needsDecryptionPrompt) {
      if (fs.existsSync(tmpUploadPath)) fs.unlinkSync(tmpUploadPath);
      return res.json({
        success: false,
        status: 'key_required',
        message: 'This database backup is encrypted with a different key. Please supply the encryption key to unlock it.'
      });
    }

    if (!success) {
      throw new Error('Database verification failed.');
    }

    // Move tmp verified file to final backup profile location
    if (fs.existsSync(finalBackupPath)) {
      fs.unlinkSync(finalBackupPath);
    }
    fs.renameSync(tmpUploadPath, finalBackupPath);

    // 4. Optionally: Activate immediately if requested
    if (activateImmediately === true) {
      const liveDbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../calendarly.db');
      const backupDbPath = liveDbPath + '.pre-upload.bak';

      // Close active connection
      await closeDbConnection();

      // Backup existing active DB
      if (fs.existsSync(liveDbPath)) {
        fs.renameSync(liveDbPath, backupDbPath);
      }

      // Copy the verified profile to active calendarly.db
      fs.copyFileSync(finalBackupPath, liveDbPath);

      // Re-initialize active connection
      try {
        await getDbConnection();
        if (fs.existsSync(backupDbPath)) {
          fs.unlinkSync(backupDbPath);
        }
      } catch (connErr) {
        console.error('Fatal: Failed to connect to activated database. Rolling back...', connErr);
        if (fs.existsSync(liveDbPath)) fs.unlinkSync(liveDbPath);
        if (fs.existsSync(backupDbPath)) fs.renameSync(backupDbPath, liveDbPath);
        await getDbConnection();
        return res.status(500).json({ success: false, error: 'Database activation failed. System rolled back.' });
      }
    }

    res.json({ 
      success: true, 
      message: activateImmediately 
        ? `Database '${safeFilename}' successfully uploaded and activated!` 
        : `Database '${safeFilename}' successfully added to your backup profiles list!` 
    });

  } catch (error) {
    console.error('Error during database upload/restoration:', error);
    res.status(500).json({ success: false, error: 'Database restore operation failed' });
  }
});

// ── 6. POST Activate Database Profile ──
router.post('/backup/activate', async (req, res) => {
  const backupsDir = path.resolve(__dirname, '../backups');
  const liveDbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../calendarly.db');
  const prevDbPath = path.join(backupsDir, 'calendarly_prev.db');

  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'No filename provided' });
    }

    // Safety check: Prevent directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const sourcePath = path.join(backupsDir, safeFilename);

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ success: false, error: `Backup file '${safeFilename}' not found.` });
    }

    console.log(`Swapping active database to profile '${safeFilename}'...`);

    // 1. Close current connection
    await closeDbConnection();

    // 2. Safely backup active DB to calendarly_prev.db
    if (fs.existsSync(liveDbPath)) {
      if (fs.existsSync(prevDbPath)) {
        fs.unlinkSync(prevDbPath);
      }
      fs.renameSync(liveDbPath, prevDbPath);
    }

    // 3. Copy target database to active calendarly.db
    fs.copyFileSync(sourcePath, liveDbPath);

    // 4. Re-open connection and verify
    try {
      await getDbConnection();
      res.json({ success: true, message: `Database profile '${safeFilename}' is now ACTIVE!` });
    } catch (connErr) {
      console.error('Failed to open activated profile. Rolling back...', connErr);
      if (fs.existsSync(liveDbPath)) fs.unlinkSync(liveDbPath);
      if (fs.existsSync(prevDbPath)) fs.renameSync(prevDbPath, liveDbPath);
      await getDbConnection();
      res.status(500).json({ success: false, error: 'Activated database failed initialization. Rolled back.' });
    }

  } catch (error) {
    console.error('Error activating database profile:', error);
    res.status(500).json({ success: false, error: 'Database activation failed' });
  }
});

// ── 7. POST Rename Database Backup Profile ──
router.post('/backup/rename', async (req, res) => {
  const backupsDir = path.resolve(__dirname, '../backups');

  try {
    const { oldFilename, newFilename } = req.body;
    if (!oldFilename || !newFilename) {
      return res.status(400).json({ success: false, error: 'Missing filenames for rename' });
    }

    // Safety checks: Prevent directory traversal
    const safeOld = oldFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    let safeNew = newFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeNew.endsWith('.db') && !safeNew.endsWith('.sqlite')) {
      safeNew += '.db';
    }

    const oldPath = path.join(backupsDir, safeOld);
    const newPath = path.join(backupsDir, safeNew);

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ success: false, error: 'Source backup profile not found.' });
    }

    if (fs.existsSync(newPath)) {
      return res.status(400).json({ success: false, error: `A database profile named '${safeNew}' already exists.` });
    }

    fs.renameSync(oldPath, newPath);
    res.json({ success: true, message: `Database renamed to '${safeNew}' successfully.` });
  } catch (error) {
    console.error('Error renaming database profile:', error);
    res.status(500).json({ success: false, error: 'Rename operation failed' });
  }
});

// ── 8. DELETE Database Backup Profile ──
router.delete('/backup/:filename', async (req, res) => {
  const backupsDir = path.resolve(__dirname, '../backups');

  try {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'No filename specified' });
    }

    // Safety checks: Prevent directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const targetPath = path.join(backupsDir, safeFilename);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: `Backup profile '${safeFilename}' not found.` });
    }

    fs.unlinkSync(targetPath);
    res.json({ success: true, message: `Database profile '${safeFilename}' deleted successfully.` });
  } catch (error) {
    console.error('Error deleting database profile:', error);
    res.status(500).json({ success: false, error: 'Delete operation failed' });
  }
});

// ── 9. GET Gitignore Health Status ──
router.get('/gitignore-status', (req, res) => {
  try {
    const gitignorePath = path.resolve(__dirname, '../../.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      return res.json({ success: true, secure: false, error: '.gitignore file not found in root directory', missing: [] });
    }

    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim());

    // Essential ignores to check
    const checks = {
      dbFiles: { desc: 'SQLite DB files (*.db, *.sqlite)', found: false, pattern: ['*.db', '*.sqlite', '*.sqlite3'] },
      backups: { desc: 'Backups directories (backups/, server/backups/)', found: false, pattern: ['backups/', 'server/backups/', '*.bak', '*.backup'] },
      envFiles: { desc: 'Environment variables (.env)', found: false, pattern: ['.env', '.env.local'] },
      aiDir: { desc: 'AI agent workspaces (ai/, **/ai/, .gemini/)', found: false, pattern: ['ai/', '**/ai/', '.gemini/', '.agents/', '.antigravitycli/'] }
    };

    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        // DB checks
        if (line === '*.db' || line === '*.sqlite' || line === '*.sqlite3') checks.dbFiles.found = true;
        // Backups checks
        if (line === 'backups/' || line === 'server/backups/' || line === '*.bak' || line === '*.backup') checks.backups.found = true;
        // Env checks
        if (line === '.env' || line === '.env.local') checks.envFiles.found = true;
        // AI checks
        if (line === 'ai/' || line === '**/ai/' || line === '.gemini/' || line === '.agents/' || line === '.antigravitycli/') checks.aiDir.found = true;
      }
    });

    const missing = [];
    for (const key in checks) {
      if (!checks[key].found) {
        missing.push(checks[key].desc);
      }
    }

    res.json({
      success: true,
      secure: missing.length === 0,
      missing: missing
    });
  } catch (error) {
    console.error('Error fetching gitignore status:', error);
    res.status(500).json({ success: false, error: 'Failed to inspect Git protections' });
  }
});

module.exports = router;
