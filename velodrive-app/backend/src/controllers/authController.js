const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize, User, RefreshToken, GDPRConsent, Wallet } = require('../models');
const { sendOTPEmail, sendResetPasswordEmail } = require('../services/emailService');

const OTP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_SENDS = 3;
const OTP_EXPIRES_MS = 10 * 60 * 1000;
const OTP_BYPASS = process.env.OTP_BYPASS === 'true';

const generateOtpCode = () => String(crypto.randomInt(100000, 1000000));

/**
 * Enforce max 3 OTP sends per 10-minute window (register + resend).
 * Returns { ok, retryAfterSec }.
 */
const consumeOtpSendQuota = (user, now = new Date()) => {
  const last = user.otpLastSentAt ? new Date(user.otpLastSentAt) : null;
  const windowExpired = !last || (now.getTime() - last.getTime()) >= OTP_WINDOW_MS;
  if (windowExpired) {
    user.otpSendCount = 0;
    user.otpLastSentAt = now;
  }
  const count = Number(user.otpSendCount || 0);
  if (count >= OTP_MAX_SENDS) {
    const windowStart = new Date(user.otpLastSentAt || now).getTime();
    const retryAfterSec = Math.max(1, Math.ceil((windowStart + OTP_WINDOW_MS - now.getTime()) / 1000));
    return { ok: false, retryAfterSec };
  }
  user.otpSendCount = count + 1;
  if (!user.otpLastSentAt) user.otpLastSentAt = now;
  return { ok: true };
};

const issueOtp = (user, now = new Date()) => {
  const code = generateOtpCode();
  user.otpCode = code;
  user.otpExpires = new Date(now.getTime() + OTP_EXPIRES_MS);
  return code;
};

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    const { role, firstName, lastName, password, phone, address, gdprConsent } = req.body;
    const email = String(req.body?.email || '').trim().toLowerCase();

    // Admin accounts are provisioned by the seed script, never by public sign-up.
    if (!['owner', 'renter'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Choose owner or renter.' });
    }

    const missing = ['firstName', 'lastName', 'email', 'password', 'phone', 'address']
      .filter((k) => String(req.body?.[k] ?? '').trim() === '');
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    let existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await sequelize.transaction(async (t) => {
      const user = await User.create({
        role,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phone,
        address,
        companyName: role === 'owner' ? (req.body.companyName || null) : null,
        companyAddress: role === 'owner' ? (req.body.companyAddress || null) : null,
        contactNumber: role === 'owner' ? (req.body.contactNumber || null) : null,
        contactPerson: role === 'owner' ? (req.body.contactPerson || null) : null,
        gdprConsent: gdprConsent === true,
        gdprConsentDate: gdprConsent === true ? new Date() : null,
        otpCode: null,
        otpExpires: null,
        otpLastSentAt: null,
        otpSendCount: 0,
        isEmailVerified: OTP_BYPASS || false,
      }, { transaction: t });

      if (OTP_BYPASS) {
        // Create wallet, log GDPR consent, return without OTP
        await Wallet.create({ userId: user.id, balance: 0.00 }, { transaction: t });
        if (gdprConsent) {
          await GDPRConsent.create({
            userId: user.id,
            consentType: 'data_processing',
            isGranted: true,
            grantedAt: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            version: '1.0'
          }, { transaction: t });
        }
        return { user, otpCode: null, bypassed: true };
      }

      // Enforce max 3 OTPs per 10 minutes (registration counts as first send)
      const now = new Date();
      const quota = consumeOtpSendQuota(user, now);
      if (!quota.ok) {
        const err = new Error('OTP_QUOTA');
        err.status = 429;
        err.retryAfterSec = quota.retryAfterSec;
        throw err;
      }
      const otpCode = issueOtp(user, now);
      await user.save({ transaction: t });

      // Create wallet
      await Wallet.create({ userId: user.id, balance: 0.00 }, { transaction: t });

      // Log GDPR consent
      if (gdprConsent) {
        await GDPRConsent.create({
          userId: user.id,
          consentType: 'data_processing',
          isGranted: true,
          grantedAt: new Date(),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          version: '1.0'
        }, { transaction: t });
      }

      return { user, otpCode };
    });

    const { user, otpCode, bypassed } = result;

    if (bypassed) {
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.otpCode;
      return res.status(201).json({
        success: true,
        emailSent: true,
        message: 'Registration successful. Account is verified (OTP bypass mode).',
        user: userResponse,
      });
    }

    // Send OTP email after commit (external side effect) and report delivery status honestly
    const emailResult = await sendOTPEmail(email, otpCode);

    const userResponse = user.toJSON();
    delete userResponse.password;
    delete userResponse.otpCode;

    if (!emailResult || emailResult.success === false) {
      return res.status(201).json({
        success: true,
        emailSent: false,
        message: 'Account created, but the verification email could not be sent. Please use “Resend code”.',
        emailError: process.env.NODE_ENV === 'production' ? undefined : emailResult?.error,
        user: userResponse,
      });
    }

    res.status(201).json({
      success: true,
      emailSent: true,
      message: 'Registration successful. Please verify your email with the OTP sent.',
      user: userResponse,
    });
  } catch (error) {
    if (error.message === 'OTP_QUOTA') {
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests. Try again in ${Math.ceil((error.retryAfterSec || 60) / 60)} minute(s).`,
        retryAfterSec: error.retryAfterSec,
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp ?? '').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP code are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified' });
    }

    if (!user.otpCode || String(user.otpCode).trim() !== otp || !user.otpExpires || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code. Use the latest code and try Resend code if needed.' });
    }

    // Mark user as verified and clear OTP fields
    user.isEmailVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    user.otpSendCount = 0;
    user.otpLastSentAt = null;
    await user.save();

    const tokens = generateTokens(user.id);
    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Account verified successfully!',
      user: userResponse,
      tokens
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.dataDeletedAt) {
      return res.status(403).json({ success: false, message: 'Account data has been erased' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account has been suspended. Contact VeloDrive support.' });
    }

    if (!user.isEmailVerified && !OTP_BYPASS) {
      return res.status(403).json({ success: false, message: 'Please verify your email address using the OTP code before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Admin login requires OTP verification (two-step: password -> OTP -> tokens)
    if (user.role === 'admin') {
      const now = new Date();
      const quota = consumeOtpSendQuota(user, now);
      if (!quota.ok) {
        return res.status(429).json({
          success: false,
          message: `Maximum 3 OTP codes per 10 minutes. Try again in ${Math.ceil(quota.retryAfterSec / 60)} minute(s).`,
          retryAfterSec: quota.retryAfterSec,
        });
      }
      const otpCode = issueOtp(user, now);
      await user.save();

      const emailResult = await sendOTPEmail(email, otpCode);
      const exposeDevOtp = process.env.EXPOSE_DEV_OTP === 'true' && process.env.NODE_ENV !== 'production';
      if (exposeDevOtp) console.warn('[otp][admin-login] code for', email, 'is', otpCode);
      if (!emailResult || emailResult.success === false) {
        return res.status(502).json({
          success: false,
          message: 'Could not send OTP email. Check email configuration.',
          emailError: process.env.NODE_ENV === 'production' ? undefined : emailResult?.error,
        });
      }

      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.otpCode;

      return res.json({
        success: true,
        otpRequired: true,
        message: 'Password correct. An OTP code has been sent to your email. Please enter it to complete admin login.',
        user: userResponse,
      });
    }

    // Owner / Renter: existing flow (tokens immediately)
    const tokens = generateTokens(user.id);

    await RefreshToken.destroy({ where: { userId: user.id } });
    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      user: userResponse,
      tokens
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const loginVerifyOTP = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp ?? '').trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP code are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'OTP login verification is only available for admin accounts.' });
    }

    if (!user.otpCode || String(user.otpCode).trim() !== otp || !user.otpExpires || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code. Use the latest code and try Resend code if needed.' });
    }

    // Clear OTP fields
    user.otpCode = null;
    user.otpExpires = null;
    user.otpSendCount = 0;
    user.otpLastSentAt = null;
    await user.save();

    const tokens = generateTokens(user.id);

    await RefreshToken.destroy({ where: { userId: user.id } });
    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Admin login successful',
      user: userResponse,
      tokens
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const stored = await RefreshToken.findOne({ where: { token: refreshToken, isRevoked: false } });
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: '15m' });

    res.json({ success: true, accessToken });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token verification failed' });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.update({ isRevoked: true }, { where: { token: refreshToken } });
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

const resendOTP = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    // Avoid leaking whether the email exists
    if (!user) return res.json({ success: true, message: 'If the account exists and is unverified, a new code was sent.' });
    if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Account is already verified. Please log in.' });

    const now = new Date();
    const quota = consumeOtpSendQuota(user, now);
    if (!quota.ok) {
      return res.status(429).json({
        success: false,
        message: `Maximum 3 OTP codes per 10 minutes. Try again in ${Math.ceil(quota.retryAfterSec / 60)} minute(s).`,
        retryAfterSec: quota.retryAfterSec,
      });
    }
    const otpCode = issueOtp(user, now);
    await user.save();

    const emailResult = await sendOTPEmail(email, otpCode);
    const exposeDevOtp = process.env.EXPOSE_DEV_OTP === 'true' && process.env.NODE_ENV !== 'production';
    if (exposeDevOtp) console.warn('[otp][dev] resend code for', email, 'is', otpCode);
    if (!emailResult || emailResult.success === false) {
      return res.status(502).json({
        success: false,
        message: 'Could not send verification email. Check email configuration (RESEND_API_KEY or SMTP) and try again.',
        emailError: process.env.NODE_ENV === 'production' ? undefined : emailResult?.error,
        ...(exposeDevOtp ? { devOtp: otpCode } : {}),
      });
    }
    res.json({
      success: true,
      message: 'A new verification code was sent to your email. Code expires in 10 minutes (max 3 codes per 10 minutes).',
      ...(exposeDevOtp ? { devOtp: otpCode } : {}),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account has been suspended. Contact VeloDrive support.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const frontendUrl = (process.env.FRONTEND_URL || '').split(',')[0].trim();
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const emailResult = await sendResetPasswordEmail(email, resetUrl);
    const exposeDevReset = process.env.EXPOSE_DEV_RESET === 'true' && process.env.NODE_ENV !== 'production';
    if (exposeDevReset) console.warn('[reset][dev] link for', email, 'is', resetUrl);

    if (!emailResult || emailResult.success === false) {
      return res.status(502).json({
        success: false,
        message: 'Could not send reset email. Check email configuration.',
        emailError: process.env.NODE_ENV === 'production' ? undefined : emailResult?.error,
        ...(exposeDevReset ? { devResetToken: resetToken, devResetUrl: resetUrl } : {}),
      });
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, verifyOTP, resendOTP, login, loginVerifyOTP, forgotPassword, resetPassword, refreshToken, logout, getMe };
