const { getOrCreateWallet, applyDelta, creditWallet, debitWallet } = require('./walletService');
const {
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
} = require('./escrowService');

/**
 * Pricing rules for a booking (marketplace split model):
 *   renter pays: owner net amount + 10% admin Opex fee
 *   admin keeps: 10% Opex fee
 *   owner receives: net vehicle owner's setup payment
 */
const SERVICE_CHARGE_FLAT = 250;
const ADMIN_OPEX_PERCENT = 10; // 10% admin Opex fee

const calculateBookingAmounts = (basePrice, serviceChargeFlatFee = SERVICE_CHARGE_FLAT) => {
  const gross = Number(basePrice);
  if (!Number.isFinite(gross) || gross <= 0) throw new Error('Invalid booking amount');

  const ownerNetAmount = Number(gross.toFixed(2));
  const adminOpexFee = Number((gross * (ADMIN_OPEX_PERCENT / 100)).toFixed(2));
  const totalAmount = Number((ownerNetAmount + adminOpexFee).toFixed(2));
  const ownerPayout = ownerNetAmount;

  return { basePrice: gross, ownerNetAmount, adminOpexFee, totalAmount, ownerPayout };
};

module.exports = {
  SERVICE_CHARGE_FLAT,
  ADMIN_OPEX_PERCENT,
  calculateBookingAmounts,
  getOrCreateWallet,
  applyDelta,
  creditWallet,
  debitWallet,
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
};
