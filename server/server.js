const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Trust nginx reverse proxy — needed for express-rate-limit to read correct client IP
app.set('trust proxy', 1);

// Security headers (ECC: web/security.md)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Enable CORS
app.use(cors({
  origin: isDev ? '*' : (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-upload-password']
}));

// Rate limiting (ECC: rate limiting on all endpoints)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Upload limit reached, please try again later.' },
});
app.use('/api/', apiLimiter);
app.use('/api/upload', uploadLimiter);

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
const peopleRouter = require('./routes/people');
const tasksRouter = require('./routes/tasks');
const notesRouter = require('./routes/notes');
const extractsRouter = require('./routes/extracts');
const dailyLogsRouter = require('./routes/dailyLogs');
const settingsRouter = require('./routes/settings');
const analyticsRouter = require('./routes/analytics');
const uploadRouter = require('./routes/upload');
const pomodoroRouter = require('./routes/pomodoro');
const distractionNotesRouter = require('./routes/distractionNotes');
const opencodeRouter = require('./routes/opencode');
const codeAgentsRouter = require('./routes/codeAgents');
const habitsRouter = require('./routes/habits');
const habitLogsRouter = require('./routes/habit-logs');
const personalCareRouter = require('./routes/personalCare');

// Mount routes
app.use('/api/events', eventsRouter);
app.use('/api/areas', areasRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/people', peopleRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/extracts', extractsRouter);
app.use('/api/daily-logs', dailyLogsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/pomodoro-sessions', pomodoroRouter);
app.use('/api/distraction-notes', distractionNotesRouter);
app.use('/api/opencode', opencodeRouter);
app.use('/api/code-agents', codeAgentsRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/habit-logs', habitLogsRouter);
app.use('/api/personal-care', personalCareRouter);

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


// MCP spec endpoint — serves the latest OpenClaw MCP document dynamically
// This allows OpenClaw and other agents to fetch the current API contract
// without needing to read the filesystem or repository directly.
app.get('/api/mcp', (req, res) => {
  // Try project root first (native dev), then same dir (Docker where server/ is the app root)
  const candidates = [
    path.resolve(__dirname, '..', 'OPENCLAW_MCP.md'),
    path.resolve(__dirname, 'OPENCLAW_MCP.md'),
  ];
  let content = null;
  let lastErr = null;
  for (const mcpPath of candidates) {
    try {
      content = fs.readFileSync(mcpPath, 'utf-8');
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (content) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(content);
  } else {
    console.error('[MCP] Failed to read OPENCLAW_MCP.md:', lastErr?.message);
    res.status(500).json({ error: 'MCP specification unavailable. Ensure OPENCLAW_MCP.md exists in the project root.' });
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
