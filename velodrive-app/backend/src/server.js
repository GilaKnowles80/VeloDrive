require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { sequelize, connectDB } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const walletRoutes = require('./routes/walletRoutes');
const adminRoutes = require('./routes/adminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const paypalRoutes = require('./routes/paypalRoutes');
const ownerRoutes = require('./routes/ownerRoutes');

const app = express();

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
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'VeloDrive API is running' });
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
  if (req.path === '/api/health') return next();
  try {
    await ensureDb();
    next();
  } catch (e) {
    next(e);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (process.env.VERCEL) return;
  await connectDB();
  await sequelize.sync({ alter: { drop: false } });
  console.log('📦 Database models synchronized');

  app.listen(PORT, () => {
    console.log(`🚀 VeloDrive Backend running on port ${PORT}`);
  });
};

startServer();

module.exports = app;