const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const DB_FILENAME = 'calendarly.db';
const SOURCE_DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, DB_FILENAME);
const LOCAL_BACKUP_DIR = path.join(__dirname, 'backups');

// Common iCloud Drive path on macOS
const CLOUD_BACKUP_DIR = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'CalendarlyBackups');

// USB Flash Drive backup path (Linux persistent mount)
const USB_BACKUP_DIR = '/mnt/calendarly-backups/CalendarlyBackups/server/backups';

// Maximum number of backups to keep per directory
const MAX_BACKUPS = 100; 

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanupOldBackups(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath)
    .filter(file => file.startsWith('calendarly_') && file.endsWith('.db'))
    .map(file => ({
      name: file,
      path: path.join(dirPath, file),
      time: fs.statSync(path.join(dirPath, file)).mtime.getTime()
    }))
    // Sort oldest first
    .sort((a, b) => a.time - b.time);

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(0, files.length - MAX_BACKUPS);
    toDelete.forEach(file => {
      try {
        fs.unlinkSync(file.path);
        console.log(`Deleted old backup: ${file.path}`);
      } catch (err) {
        console.error(`Failed to delete old backup ${file.path}:`, err);
      }
    });
  }
}

function runBackup() {
  console.log('Starting Database Backup...');

  if (!fs.existsSync(SOURCE_DB_PATH)) {
    console.log(`Source database not found at ${SOURCE_DB_PATH}. Skipping backup.`);
    return;
  }

  // Create timestamp string: YYYY-MM-DD_HH-MM-SS
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const backupFilename = `calendarly_${timestamp}.db`;

  // 1. Local Backup
  ensureDirectoryExists(LOCAL_BACKUP_DIR);
  const localDest = path.join(LOCAL_BACKUP_DIR, backupFilename);
  try {
    fs.copyFileSync(SOURCE_DB_PATH, localDest);
    fs.utimesSync(localDest, now, now); // Ensure backup has current timestamp
    console.log(`✅ Local backup successful: ${localDest}`);
    cleanupOldBackups(LOCAL_BACKUP_DIR);
  } catch (error) {
    console.error('❌ Local backup failed:', error);
  }

  // 2. Cloud Backup (iCloud Drive)
  try {
    ensureDirectoryExists(CLOUD_BACKUP_DIR);
    const cloudDest = path.join(CLOUD_BACKUP_DIR, backupFilename);
    fs.copyFileSync(SOURCE_DB_PATH, cloudDest);
    fs.utimesSync(cloudDest, now, now);
    console.log(`✅ Cloud backup successful: ${cloudDest}`);
    cleanupOldBackups(CLOUD_BACKUP_DIR);
  } catch (error) {
    console.error('❌ Cloud backup failed. Note: This is expected if iCloud Drive is not enabled or accessible.', error.message);
  }

  // 3. USB Flash Drive Backup
  try {
    ensureDirectoryExists(USB_BACKUP_DIR);
    const usbDest = path.join(USB_BACKUP_DIR, backupFilename);
    fs.copyFileSync(SOURCE_DB_PATH, usbDest);
    fs.utimesSync(usbDest, now, now);
    console.log(`✅ USB backup successful: ${usbDest}`);
    cleanupOldBackups(USB_BACKUP_DIR);
  } catch (error) {
    console.error('❌ USB backup failed:', error.message);
  }
  
  console.log('Backup process completed.');
}

// Auto-run only when called directly (node backup-db.js)
if (require.main === module) {
  runBackup();
}

module.exports = { runBackup };
