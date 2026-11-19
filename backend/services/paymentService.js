import { getOrCreateWallet, applyDelta, creditWallet, debitWallet } from './walletService.js';
import {
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
} from './escrowService.js';

/**
 * Pricing rules for a booking (marketplace split model):
 *   renter pays: owner net amount + 10% service charge fee
 *   admin keeps: 10% service charge fee
 *   owner receives: net vehicle owner's setup payment
 */
export const SERVICE_CHARGE_FEE = 10; // 10% service charge fee

export const calculateBookingAmounts = (basePrice, serviceChargeFlatFee = 0) => {
  const gross = Number(basePrice);
  if (!Number.isFinite(gross) || gross <= 0) throw new Error('Invalid booking amount');

  const ownerNetAmount = Number(gross.toFixed(2));
  const serviceChargeFee = Number((gross * (SERVICE_CHARGE_FEE / 100)).toFixed(2));
  const totalAmount = Number((ownerNetAmount + serviceChargeFee).toFixed(2));
  const ownerPayout = ownerNetAmount;

  return { basePrice: gross, ownerNetAmount, serviceChargeFee, totalAmount, ownerPayout };
};

export default {
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