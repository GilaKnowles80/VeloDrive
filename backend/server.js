import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { sequelize, connectDB } from './config/database.js';
import { getEnvironmentReadiness } from './config/runtimeReadiness.js';
import errorHandler from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { apiLimiter } from './middleware/rateLimit.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import paypalRoutes from './routes/paypalRoutes.js';
import paymentsRoutes from './routes/paymentsRoutes.js';
import ownerRoutes from './routes/ownerRoutes.js';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional Sentry (enable with SENTRY_DSN env var)
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0,
    });
  } catch (_) {
    /* optional dependency */
  }
}

const app = express();
app.disable('x-powered-by');

// Required on Vercel so express-rate-limit accurately reads X-Forwarded-For without throwing 500s
app.set('trust proxy', 1);

// Request ID + structured access logs
app.use(requestId);
morgan.token('id', (req) => req.id || '-');
app.use(
  morgan(
    process.env.NODE_ENV === 'production'
      ? ':remote-addr - :id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ms'
      : 'dev'
  )
);

// Security & CORS
app.use(helmet());
const fallbackOrigins = 'https://www.gctravelandtour.com,https://velo-drive-green.vercel.app,http://localhost:3000';
const allowedOrigins = (process.env.FRONTEND_URL || fallbackOrigins)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

// Body parsers (raw body preserved for Resend webhooks)
app.use('/api/webhooks/resend', express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root deployment check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'velodrive-api',
    health: '/api/health',
    readiness: '/api/ready',
  });
});

// Crawlers & favicon
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /');
});
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health (liveness) - fast, no DB dependency
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'velodrive-api',
    uptime: process.uptime(),
    ts: new Date().toISOString(),
    requestId: req.id,
  });
});

// Readiness - DB connectivity + required env checks
app.get('/api/ready', async (req, res) => {
  const env = getEnvironmentReadiness();
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

// Connect once per serverless instance
let dbReady;
const ensureDb = async () => {
  if (!dbReady) {
    dbReady = (async () => {
      await connectDB();
      if (process.env.NODE_ENV !== 'production' || process.env.RUN_DB_SYNC === 'true') {
        await sequelize.sync({ alter: true });
      }
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

// General API rate limit applied safely after app is initialized
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
if (Sentry && Sentry.Handlers && Sentry.Handlers.errorHandler) {
  app.use(Sentry.Handlers.errorHandler());
}
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

// Correct ES Module export for Vercel
export default app;