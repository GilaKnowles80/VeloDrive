const { getOrCreateWallet, applyDelta, creditWallet, debitWallet } = require('./walletService');
const {
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
} = require('./escrowService');

/**
 * Pricing rules for a booking (documented marketplace model):
 *   renter pays the rental amount + owner add-on fee
 *   admin keeps a flat service charge
 *   owner receives rental amount - service charge + owner add-on fee
 */
const SERVICE_CHARGE_FLAT = 250;
const OWNER_ADD_ON_FEE = 500; // Php 500 per booking charged to owner's account

const calculateBookingAmounts = (basePrice, serviceChargeFlatFee = SERVICE_CHARGE_FLAT, ownerAddOnFee = OWNER_ADD_ON_FEE) => {
  const gross = Number(basePrice);
  if (!Number.isFinite(gross) || gross <= 0) throw new Error('Invalid booking amount');

  const serviceChargeAmount = Number(Number(serviceChargeFlatFee).toFixed(2));
  const ownerAddOn = Number(Number(ownerAddOnFee).toFixed(2));
  const totalAmount = Number((gross + ownerAddOn).toFixed(2));
  const ownerPayout = Number((totalAmount - serviceChargeAmount).toFixed(2));

  return { basePrice: gross, serviceChargeAmount, ownerPayout, ownerAddOnFee: ownerAddOn, totalAmount };
};

module.exports = {
  SERVICE_CHARGE_FLAT,
  OWNER_ADD_ON_FEE,
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
