const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: '*', // Allows development tools and various frontends to connect
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-upload-password']
}));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logger for better traceability during local debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Import routers
const eventsRouter = require('./routes/events');
const areasRouter = require('./routes/areas');
const projectsRouter = require('./routes/projects');
const tasksRouter = require('./routes/tasks');
const notesRouter = require('./routes/notes');
const extractsRouter = require('./routes/extracts');
const dailyLogsRouter = require('./routes/dailyLogs');
const settingsRouter = require('./routes/settings');
const analyticsRouter = require('./routes/analytics');
const uploadRouter = require('./routes/upload');

// Mount routes
app.use('/api/events', eventsRouter);
app.use('/api/areas', areasRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/extracts', extractsRouter);
app.use('/api/daily-logs', dailyLogsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/upload', uploadRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Database integrity check and auto-restore endpoint
app.get('/api/health/integrity-check', async (req, res) => {
  try {
    const { runIntegrityCheck } = require('./integrity-checker');
    const checkOnly = req.query.check_only === 'true';
    
    console.log(`[Integrity Check] Triggered. Check-only mode: ${checkOnly}`);
    const result = await runIntegrityCheck({ checkOnly });
    
    if (result.healthy) {
      return res.json({
        status: 'healthy',
        message: 'Database is fully intact and healthy.',
        details: result
      });
    } else {
      if (result.restored) {
        return res.json({
          status: 'recovered',
          message: 'Database anomalies detected! Missing data was successfully restored from the Golden Backup.',
          details: result
        });
      } else {
        return res.status(500).json({
          status: 'unhealthy',
          message: 'Database anomalies detected! Data restoration was skipped or failed.',
          details: result
        });
      }
    }
  } catch (error) {
    console.error('Error during integrity-check endpoint execution:', error);
    res.status(500).json({ error: 'Internal server error executing integrity check' });
  }
});


// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start the server
async function startServer() {
  try {
    // Back up existing database before initialization
    const { runBackup } = require('./backup-db');
    runBackup();

    // Initialize DB schema without resetting - data persists
    await initDatabase(false);

    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 Calendarly Backend running on port ${PORT}`);
      console.log(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Failed to initialize database or start server:', error);
    process.exit(1);
  }
}

startServer();
