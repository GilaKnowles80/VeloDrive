require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const crypto = require('crypto');

const { sequelize, connectDB } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const walletRoutes = require('./routes/walletRoutes');
const adminRoutes = require('./routes/adminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const paypalRoutes = require('./routes/paypalRoutes');
const ownerRoutes = require('./routes/ownerRoutes');

// Optional Sentry (enable with SENTRY_DSN env var)
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development', tracesSampleRate: 0 });
  } catch (_) { /* optional dependency */ }
}

const app = express();
app.disable('x-powered-by');

const requiredEnv = () => {
  const base = ['DATABASE_URL', 'JWT_SECRET'];
  const prod = process.env.NODE_ENV === 'production' || process.env.VERCEL ? ['FRONTEND_URL'] : [];
  return [...base, ...prod];
};
const envCheck = () => {
  const missing = requiredEnv().filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
};

// Request ID + structured access logs
app.use(requestId);
morgan.token('id', (req) => req.id || '-');
app.use(morgan(process.env.NODE_ENV === 'production'
  ? ':remote-addr - :id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms'
  : 'dev'));

// Security & middleware
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'https://frontend-2o4j.vercel.app,http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Allow server-to-server, curl, and same-origin/rewrite cases with no Origin header
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health (liveness) - fast, no DB
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'velodrive-api', uptime: process.uptime(), ts: new Date().toISOString(), requestId: req.id });
});

// Readiness - DB connectivity + required env checks (for uptime monitors/deploy gates)
app.get('/api/ready', async (req, res) => {
  const env = envCheck();
  let db = { ok: false };
  try {
    await sequelize.authenticate({ logging: false });
    db = { ok: true };
  } catch (e) {
    db = { ok: false, error: e.message };
  }
  const ok = env.ok && db.ok;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'not_ready',
    checks: { env, db },
    ts: new Date().toISOString(),
    requestId: req.id,
  });
});

// Ensure DB tables exist (safe for serverless cold starts; idempotent)
let dbReady;
const ensureDb = async () => {
  if (!dbReady) {
    dbReady = (async () => {
      await connectDB();
      await sequelize.sync({ alter: { drop: false } });
    })().catch((e) => {
      dbReady = null;
      throw e;
    });
  }
  return dbReady;
};
app.use(async (req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/ready') return next();
  try {
    await ensureDb();
    next();
  } catch (e) {
    next(e);
  }
});

// General API rate limit (auth has stricter per-route limits)
app.use('/api', apiLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/paypal', paypalRoutes);
app.use('/api/owners', ownerRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', requestId: req.id });
});

// Error handler
if (Sentry && Sentry.Handlers && Sentry.Handlers.errorHandler) app.use(Sentry.Handlers.errorHandler());
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (process.env.VERCEL) return;
  await connectDB();
  await sequelize.sync({ alter: { drop: false } });
  console.log(JSON.stringify({ level: 'info', msg: 'db_synchronized' }));

  app.listen(PORT, () => {
    console.log(JSON.stringify({ level: 'info', msg: 'server_started', port: Number(PORT) }));
  });
};

startServer();

module.exports = app;