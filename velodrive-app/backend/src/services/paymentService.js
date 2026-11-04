const { Wallet, Transaction, User, Booking } = require('../models');
const { creditWallet, debitWallet, processBookingEscrow, releaseEscrowToOwner, refundBooking } = require('./walletService');

/**
 * Calculate booking split payment amounts
 * total = basePrice + fuel + damage + delay + additional
 * Admin service charge = Php 250 flat (deducted from renter's payment)
 * Owner payout = totalAmount - serviceChargeAmount
 */
const calculateBookingAmounts = (basePrice, serviceChargeFlatFee = 250) => {
  const serviceChargeAmount = parseFloat(serviceChargeFlatFee.toFixed(2));
  const ownerPayout = parseFloat((basePrice - serviceChargeAmount).toFixed(2));
  return { basePrice, serviceChargeAmount, ownerPayout };
};

/**
 * Simulate payment processing (kept for backward compatibility; real flow uses PayPal order creation route)
 */
const processPayment = async (paymentMethod, amount, userId) => {
  return {
    success: true,
    transactionId: `PAY-${Date.now()}`,
    method: paymentMethod,
    amount,
    status: 'completed'
  };
};

module.exports = {
  calculateBookingAmounts,
  processPayment,
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  creditWallet,
  debitWallet
};