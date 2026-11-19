import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

// Standard base options for all rate limiters, with a custom handler for 429 responses.
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

// General Login / OTP rate limiter (15 minutes)
export const authLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 200,
  message: 'Too many requests. Please try again later.',
});

// Login/OTP verify/resend: stricter rate limiter (15 minutes)
export const authSensitiveLimiter = rateLimit({
  ...standard,
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 200,
  message: 'Too many requests. Please try again later.',
});

// General API safety net (1 minute)
export const apiLimiter = rateLimit({
  ...standard,
  windowMs: 60 * 1000,
  max: isProd ? 300 : 2000,
  message: 'Too many requests. Please try again later.', 
});



