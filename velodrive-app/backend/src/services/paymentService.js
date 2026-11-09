const { getOrCreateWallet, applyDelta, creditWallet, debitWallet } = require('./walletService');
const {
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
} = require('./escrowService');

/**
 * Pricing rules for a booking (marketplace split model):
 *   renter pays: owner net amount + 10% service charge fee
 *   admin keeps: 10% service charge fee
 *   owner receives: net vehicle owner's setup payment
 */
const SERVICE_CHARGE_FEE = 10; // 10% service charge fee

const calculateBookingAmounts = (basePrice, serviceChargeFlatFee = 0) => {
  const gross = Number(basePrice);
  if (!Number.isFinite(gross) || gross <= 0) throw new Error('Invalid booking amount');

  const ownerNetAmount = Number(gross.toFixed(2));
  const serviceChargeFee = Number((gross * (SERVICE_CHARGE_FEE / 100)).toFixed(2));
  const totalAmount = Number((ownerNetAmount + serviceChargeFee).toFixed(2));
  const ownerPayout = ownerNetAmount;

  return { basePrice: gross, ownerNetAmount, serviceChargeFee, totalAmount, ownerPayout };
};

module.exports = {
  SERVICE_CHARGE_FEE,
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
