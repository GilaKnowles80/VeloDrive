const { GDPRConsent } = require('../models');

const requireGDPRConsent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const consent = await GDPRConsent.findOne({
      where: { userId: req.user.id, consentType: 'data_processing' }
    });

    if (!consent || !consent.isGranted) {
      return res.status(403).json({
        success: false,
        message: 'GDPR consent for data processing is required',
        requiresConsent: true
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const logGDPRConsent = async (userId, consentType, isGranted, req, version) => {
  try {
    await GDPRConsent.create({
      userId,
      consentType,
      isGranted,
      grantedAt: isGranted ? new Date() : null,
      withdrawnAt: isGranted ? null : new Date(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      version
    });
  } catch (error) {
    console.error('GDPR log error:', error.message);
  }
};

module.exports = { requireGDPRConsent, logGDPRConsent };