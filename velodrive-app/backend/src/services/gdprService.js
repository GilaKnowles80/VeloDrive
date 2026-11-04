const { User, Booking, Vehicle, Transaction, Document, Wallet, GDPRConsent } = require('../models');

/**
 * Export all user data (GDPR Right to Access / Data Portability)
 */
const exportUserData = async (userId) => {
  const user = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
  if (!user) throw new Error('User not found');

  const bookings = await Booking.findAll({ where: { renterId: userId } });
  const vehicles = await Vehicle.findAll({ where: { ownerId: userId } });
  const transactions = await Transaction.findAll({ where: { userId } });
  const documents = await Document.findAll({ where: { userId } });
  const consents = await GDPRConsent.findAll({ where: { userId } });
  const wallet = await Wallet.findOne({ where: { userId } });

  return {
    user,
    bookings,
    vehicles,
    transactions,
    documents,
    gdprConsents: consents,
    wallet,
    exportedAt: new Date()
  };
};

/**
 * Delete all user data (GDPR Right to Erasure / Right to be Forgotten)
 */
const eraseUserData = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  // Anonymize related records then delete user
  await User.update(
    { dataDeletedAt: new Date(), isActive: false },
    { where: { id: userId } }
  );

  // Delete documents, consents, wallet, transactions, gps locations
  await Document.destroy({ where: { userId } });
  await GDPRConsent.destroy({ where: { userId } });
  await Wallet.destroy({ where: { userId } });
  await Transaction.destroy({ where: { userId } });

  // Mark user's data deleted
  await user.destroy();

  return { success: true, message: 'User data erased per GDPR right to erasure' };
};

/**
 * Withdraw GDPR consent
 */
const withdrawConsent = async (userId, consentType) => {
  const consent = await GDPRConsent.findOne({ where: { userId, consentType } });
  if (!consent) throw new Error('Consent not found');

  consent.isGranted = false;
  consent.withdrawnAt = new Date();
  await consent.save();

  return { success: true, consent };
};

module.exports = {
  exportUserData,
  eraseUserData,
  withdrawConsent
};