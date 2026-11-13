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
const paymentsRoutes = require('./routes/paymentsRoutes');
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
  const base = ['JWT_SECRET'];
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  const hasEmailProvider = Boolean(
    process.env.RESEND_API_KEY || (process.env.EMAIL_USER && process.env.EMAIL_PASS)
  );
  if (!process.env.NEON_POSTGRES_URL && !process.env.DATABASE_URL) {
    base.push('DATABASE_URL or NEON_POSTGRES_URL');
  }
  if (isProduction) {
    if (!process.env.FRONTEND_URL) base.push('FRONTEND_URL');
    if (!hasEmailProvider) base.push('RESEND_API_KEY or EMAIL_USER/EMAIL_PASS');
    if (process.env.RESEND_API_KEY && !(process.env.FROM_EMAIL || process.env.EMAIL_FROM)) {
      base.push('FROM_EMAIL or EMAIL_FROM');
    }
  }
  return base;
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
const localOrigins = process.env.VERCEL ? '' : 'http://localhost:3000';
const allowedOrigins = (process.env.FRONTEND_URL || localOrigins)
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

// Backend root is a deployment check; the frontend is hosted separately.
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'velodrive-api',
    health: '/api/health',
    readiness: '/api/ready',
  });
});

// Browsers request a favicon even on this API-only host.
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health (liveness) - fast, no DB
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', service: 'velodrive-api', uptime: process.uptime(), ts: new Date().toISOString(), requestId: req.id });
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

// Connect once per serverless instance; schema changes run through `npm run migrate`.
let dbReady;
const ensureDb = async () => {
  if (!dbReady) {
    dbReady = (async () => {
      await connectDB();
    })().catch((e) => {
      dbReady = null;
      throw e;
    });
  }
  return dbReady;
};
app.use('/api', async (req, res, next) => {
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
app.use('/api/payments', paymentsRoutes);
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

  app.listen(PORT, () => {
    console.log(JSON.stringify({ level: 'info', msg: 'server_started', port: Number(PORT) }));
  });
};

startServer();

module.exports = app;