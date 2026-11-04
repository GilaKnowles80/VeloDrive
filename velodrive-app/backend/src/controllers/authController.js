const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, RefreshToken, GDPRConsent } = require('../models');
const { logGDPRConsent } = require('../middleware/gdpr');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const register = async (req, res) => {
  try {
    const { role, firstName, lastName, email, password, phone, address, gdprConsent } = req.body;

    if (!role || !firstName || !lastName || !email || !password || !phone || !address) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (!['admin', 'owner', 'renter'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    let existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      role,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      address,
      gdprConsent: gdprConsent === true,
      gdprConsentDate: gdprConsent === true ? new Date() : null
    });

    // Create wallet
    const { Wallet } = require('../models');
    await Wallet.create({ userId: user.id, balance: 0.00 });

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
      });
    }

    const tokens = generateTokens(user.id);
    await RefreshToken.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: userResponse,
      tokens
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.dataDeletedAt) {
      return res.status(403).json({ success: false, message: 'Account data has been erased' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

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

module.exports = { register, login, refreshToken, logout, getMe };