import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import db from '../models/index.js';
import { sendOTPEmail, sendResetPasswordEmail } from '../services/emailService.js';

const { sequelize, User, RefreshToken, GDPRConsent, Wallet } = db;

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

export const register = async (req, res) => {
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