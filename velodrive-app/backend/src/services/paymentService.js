const { getOrCreateWallet, applyDelta, creditWallet, debitWallet } = require('./walletService');
const {
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
} = require('./escrowService');

/**
 * Pricing rules for a booking (documented marketplace model):
 *   renter pays the rental amount
 *   admin keeps a flat service charge
 *   owner receives rental amount - service charge
 */
const SERVICE_CHARGE_FLAT = 250;

const calculateBookingAmounts = (basePrice, serviceChargeFlatFee = SERVICE_CHARGE_FLAT) => {
  const gross = Number(basePrice);
  if (!Number.isFinite(gross) || gross <= 0) throw new Error('Invalid booking amount');

  const serviceChargeAmount = Number(Number(serviceChargeFlatFee).toFixed(2));
  const ownerPayout = Number((gross - serviceChargeAmount).toFixed(2));

  return { basePrice: gross, serviceChargeAmount, ownerPayout };
};

module.exports = {
  SERVICE_CHARGE_FLAT,
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
