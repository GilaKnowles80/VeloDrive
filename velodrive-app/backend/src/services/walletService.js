const { Wallet, Transaction, User, Booking } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Credit a wallet
 */
const creditWallet = async (userId, amount, type, description, bookingId = null, metadata = {}) => {
  const transaction = await sequelize.transaction();
  try {
    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) throw new Error('Wallet not found');

    await wallet.increment('balance', { by: amount, transaction });

    await Transaction.create({
      reference: `TXN-${Date.now()}`,
      type,
      userId,
      bookingId,
      amount,
      status: 'completed',
      description,
      metadata
    }, { transaction });

    await transaction.commit();
    return { success: true, wallet };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Debit a wallet
 */
const debitWallet = async (userId, amount, type, description, bookingId = null, metadata = {}) => {
  const transaction = await sequelize.transaction();
  try {
    const wallet = await Wallet.findOne({ where: { userId } });
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balance < amount) throw new Error('Insufficient wallet balance');

    await wallet.decrement('balance', { by: amount, transaction });

    await Transaction.create({
      reference: `TXN-${Date.now()}`,
      type,
      userId,
      bookingId,
      amount,
      status: 'completed',
      description,
      metadata
    }, { transaction });

    await transaction.commit();
    return { success: true, wallet };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Process split payment escrow for a booking
 * Renter pays total -> held in escrow -> after rental, split owner (90%) & admin (10%)
 */
const processBookingEscrow = async (bookingId) => {
  const transaction = await sequelize.transaction();
  try {
    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: User, as: 'renter' }, { model: User, as: 'owner' }]
    });
    if (!booking) throw new Error('Booking not found');

    const commissionAmount = booking.commissionAmount;
    const ownerPayout = booking.ownerPayout;

    // 1. Debit renter (total amount)
    await debitWallet(
      booking.renterId,
      booking.totalAmount,
      'booking_payment',
      `Payment for booking ${booking.bookingReference}`,
      booking.id,
      { vehicleId: booking.vehicleId }
    );

    // 2. Credit admin commission (held in escrow)
    const admin = await User.findOne({ where: { role: 'admin' } });
    if (!admin) throw new Error('Admin not found');

    await creditWallet(
      admin.id,
      commissionAmount,
      'commission',
      `Commission from booking ${booking.bookingReference}`,
      booking.id,
      { bookingId: booking.id, type: 'commission' }
    );

    // Owner payout will be released after rental completion
    await creditWallet(
      booking.ownerId,
      ownerPayout,
      'owner_payout',
      `Payout from booking ${booking.bookingReference}`,
      booking.id,
      { bookingId: booking.id, type: 'owner_payout', held: true }
    );

    booking.paymentStatus = 'held_in_escrow';
    booking.escrowStatus = 'held';
    await booking.save({ transaction });

    await transaction.commit();
    return { success: true, booking };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Release escrow to owner after rental is completed
 */
const releaseEscrowToOwner = async (bookingId) => {
  const transaction = await sequelize.transaction();
  try {
    const booking = await Booking.findByPk(bookingId);
    if (!booking) throw new Error('Booking not found');

    if (booking.escrowStatus !== 'held') throw new Error('Escrow not held');

    booking.escrowStatus = 'released';
    booking.paymentStatus = 'released_to_owner';
    booking.completedAt = new Date();
    await booking.save({ transaction });

    await transaction.commit();
    return { success: true, booking };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Refund booking to renter
 */
const refundBooking = async (bookingId, reason) => {
  const transaction = await sequelize.transaction();
  try {
    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: User, as: 'renter' }]
    });
    if (!booking) throw new Error('Booking not found');

    // Refund total to renter
    await creditWallet(
      booking.renterId,
      booking.totalAmount,
      'refund',
      `Refund for booking ${booking.bookingReference}: ${reason}`,
      booking.id,
      { reason }
    );

    booking.paymentStatus = 'refunded';
    booking.escrowStatus = 'refunded';
    await booking.save({ transaction });

    await transaction.commit();
    return { success: true, booking };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  creditWallet,
  debitWallet,
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking
};