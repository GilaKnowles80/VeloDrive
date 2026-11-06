const rateLimit = require('express-rate-limit');

const isProd = process.env.NODE_ENV === 'production';
const standard = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      requestId: req.id,
    });
  },
};

// Auth/OTP endpoints: tighter limits to reduce abuse/brute-force
const authLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 200,
  message: undefined,
});

// Login/OTP verify/resend: stricter
const authSensitiveLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 200,
  message: undefined,
});

// General API safety net (light)
const apiLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  max: isProd ? 300 : 2000,
  message: undefined,
});

module.exports = { authLimiter, authSensitiveLimiter, apiLimiter };
