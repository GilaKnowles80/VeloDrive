const { User, Booking, Vehicle, Transaction, Document, Wallet, GDPRConsent } = require('../models');
const { sequelize } = require('../config/database');

const REDACTED = '[erased]';

/**
 * Export all user data (GDPR Right to Access / Data Portability).
 */
const exportUserData = async (userId) => {
  const user = await User.findByPk(userId, { attributes: { exclude: ['password', 'otpCode'] } });
  if (!user) throw new Error('User not found');

  const [bookings, vehicles, transactions, documents, consents, wallet] = await Promise.all([
    Booking.findAll({ where: { renterId: userId } }),
    Vehicle.findAll({ where: { ownerId: userId } }),
    Transaction.findAll({ where: { userId } }),
    Document.findAll({ where: { userId } }),
    GDPRConsent.findAll({ where: { userId } }),
    Wallet.findOne({ where: { userId } }),
  ]);

  return {
    user,
    bookings,
    vehicles,
    transactions,
    documents,
    gdprConsents: consents,
    wallet,
    exportedAt: new Date(),
  };
};

/**
 * Right to Erasure.
 *
 * Financial records (bookings, transactions) must be retained for accounting and
 * dispute handling, so the account is anonymised and deactivated rather than
 * deleted. That keeps `dataDeletedAt` meaningful for the login gate and avoids
 * orphaning foreign keys.
 */
const eraseUserData = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  const transaction = await sequelize.transaction();
  try {
    const anonymisedEmail = `erased+${user.id}@velodrive.invalid`;

    await user.update(
      {
        firstName: REDACTED,
        lastName: REDACTED,
        email: anonymisedEmail,
        phone: REDACTED,
        address: REDACTED,
        nbiClearance: null,
        taxCertificate: null,
        validId: null,
        driversLicense: null,
        bankAccountName: null,
        bankAccountNumber: null,
        bankName: null,
        paypalEmail: null,
        paypalVerified: false,
        otpCode: null,
        otpExpires: null,
        gdprConsent: false,
        dataDeletedAt: new Date(),
        isActive: false,
      },
      { transaction }
    );

    await Document.destroy({ where: { userId }, transaction });
    await GDPRConsent.destroy({ where: { userId }, transaction });
    await Wallet.destroy({ where: { userId }, transaction });
    await Vehicle.update({ isAvailable: false, status: 'inactive' }, { where: { ownerId: userId }, transaction });
    await Transaction.sequelize.query('DELETE FROM refresh_tokens WHERE "userId" = :userId', {
      replacements: { userId },
      transaction,
    });

    await transaction.commit();
    return { success: true, message: 'Your personal data has been erased; financial records are retained as required by law.' };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Withdraw a previously granted consent type.
 */
const withdrawConsent = async (userId, consentType) => {
  if (!consentType) throw new Error('consentType is required');

  const consent = await GDPRConsent.findOne({ where: { userId, consentType } });
  if (!consent) throw new Error('Consent not found');

  consent.isGranted = false;
  consent.withdrawnAt = new Date();
  await consent.save();

  return { success: true, consent };
};

/**
 * Record a consent decision (used on registration and policy re-acceptance).
 */
const logConsent = async ({ userId, consentType, isGranted, req, version = '1.0' }) => {
  const existing = await GDPRConsent.findOne({ where: { userId, consentType } });

  if (existing) {
    existing.isGranted = Boolean(isGranted);
    existing.grantedAt = isGranted ? new Date() : existing.grantedAt;
    existing.withdrawnAt = isGranted ? null : new Date();
    existing.version = version;
    await existing.save();
    return existing;
  }

  return GDPRConsent.create({
    userId,
    consentType,
    isGranted: Boolean(isGranted),
    grantedAt: isGranted ? new Date() : null,
    withdrawnAt: isGranted ? null : new Date(),
    ipAddress: req?.ip,
    userAgent: req?.get?.('user-agent'),
    version,
  });
};

module.exports = { exportUserData, eraseUserData, withdrawConsent, logConsent };
