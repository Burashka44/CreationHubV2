// ============================================================
// CreationHub V2 — System API
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const rateLimit = require('express-rate-limit');

const db = require('./lib/db');
const wsServer = require('./lib/websocket');
const metricsCollector = require('./lib/metricsCollector');

// Routes
const authRoutes = require('./routes/auth');
const metricsRoutes = require('./routes/metrics');
const servicesRoutes = require('./routes/services');
const networkRoutes = require('./routes/network');
const backupsRoutes = require('./routes/backups');
const logsRoutes = require('./routes/logs');
const settingsRoutes = require('./routes/settings');
const adminsRoutes = require('./routes/admins');
const openclawRoutes = require('./routes/openclaw');
const telegramRoutes = require('./routes/telegram');
const aiRoutes = require('./routes/ai');
const n8nRoutes = require('./routes/n8n');
const updateRoutes = require('./routes/update');
const terminalRoutes = require('./routes/terminal');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 9292;

// ── Global Logger (Debug)
app.use((req, res, next) => {
  console.log(`[API Incoming] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// ── Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS
app.use(cors({
  origin: true, // Reflect request origin
  credentials: true,
}));

// ── Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Global rate limit
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
app.use(globalLimiter);

// ── Health check (no auth)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes
app.use('/api/auth',          authRoutes);
app.use('/api/metrics',       metricsRoutes);
app.use('/api/services',      servicesRoutes);
app.use('/api/network',       networkRoutes);
app.use('/api/backups',       backupsRoutes);
app.use('/api/logs',          logsRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/admins',        adminsRoutes);
app.use('/api/openclaw',      openclawRoutes);
app.use('/api/telegram',      telegramRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/n8n',           n8nRoutes);
app.use('/api/update',        updateRoutes);
app.use('/api/terminal',      terminalRoutes);
app.use('/api/notifications', notificationsRoutes);

// ── 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ── WebSocket server (real-time metrics)
wsServer.attach(server);

// ── Start
async function start() {
  try {
    await db.connect();
    console.log('[DB] Connected to PostgreSQL');

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[API] CreationHub V2 System API running on port ${PORT}`);
    });

    // Start background metrics collection
    metricsCollector.start();

  } catch (err) {
    console.error('[STARTUP ERROR]', err);
    process.exit(1);
  }
}

start();
