const express = require('express');
const router = express.Router();
const { register, verifyOTP, resendOTP, login, loginVerifyOTP, forgotPassword, resetPassword, refreshToken, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter, authSensitiveLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, register);
router.post('/verify-otp', authSensitiveLimiter, verifyOTP);
router.post('/resend-otp', authSensitiveLimiter, resendOTP);
router.post('/login', authSensitiveLimiter, login);
router.post('/login-verify-otp', authSensitiveLimiter, loginVerifyOTP);
router.post('/forgot-password', authSensitiveLimiter, forgotPassword);
router.post('/reset-password/:token', authSensitiveLimiter, resetPassword);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

module.exports = router;