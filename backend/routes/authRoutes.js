import express from 'express';
import { 
  register, 
  verifyOTP, 
  resendOTP, 
  login, 
  loginVerifyOTP, 
  forgotPassword, 
  resetPassword, 
  refreshToken, 
  logout, 
  getMe 
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter, authSensitiveLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

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

export default router;
