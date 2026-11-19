const { Transaction, User, Booking, Wallet } = require('../models');
const { sequelize } = require('../config/database');
const { creditWallet, debitWallet } = require('./walletService');

/**
 * Booking escrow lifecycle.
 *
 * PayPal captures the renter's payment up front and the funds sit with the
 * platform, so escrow never debits the renter's wallet (that would charge twice).
 * Flow: captured -> held_in_escrow -> released_to_owner, or -> refunded.
 */

const FUNDED_STATES = ['paid', 'held_in_escrow', 'released_to_owner'];

const loadBooking = (bookingId, transaction) =>
  Booking.findByPk(bookingId, { transaction, lock: transaction.LOCK.UPDATE });

/**
 * Mark captured funds as held and credit the platform service charge.
 * Idempotent: re-running on a booking already in escrow is a no-op.
 */
const processBookingEscrow = async (bookingId) => {
  const transaction = await sequelize.transaction();
  try {
    const booking = await loadBooking(bookingId, transaction);
    if (!booking) throw new Error('Booking not found');
    if (booking.escrowStatus === 'held' || booking.escrowStatus === 'released') {
      await transaction.commit();
      return { success: true, booking, alreadyProcessed: true };
    }

    const admin = await User.findOne({ where: { role: 'admin' }, transaction });
    if (!admin) throw new Error('Admin account not found');

    const serviceCharge = Number(booking.serviceChargeAmount || 0);

    // Only the platform fee moves now; the owner payout stays held until release.
    if (serviceCharge > 0) {
      await creditWallet(
        admin.id,
        serviceCharge,
        'service_charge',
        `Service charge from booking ${booking.bookingReference}`,
        { bookingId: booking.id, metadata: { feeType: 'service_charge' }, transaction }
      );
    }

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
 * Release the held owner payout once the rental is completed.
 */
const releaseEscrowToOwner = async (bookingId) => {
  const transaction = await sequelize.transaction();
  try {
    const booking = await loadBooking(bookingId, transaction);
    if (!booking) throw new Error('Booking not found');
    if (booking.escrowStatus === 'released') {
      await transaction.commit();
      return { success: true, booking, alreadyReleased: true };
    }
    if (booking.escrowStatus !== 'held') {
      throw new Error('Escrow is not held for this booking');
    }

    const ownerPayout = Number(booking.ownerPayout || 0);

    if (ownerPayout > 0) {
      await creditWallet(
        booking.ownerId,
        ownerPayout,
        'owner_payout',
        `Owner payout for booking ${booking.bookingReference}`,
        { bookingId: booking.id, metadata: { feeType: 'payout', releasedFromEscrow: true }, transaction }
      );
    }

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
 * Refund a booking into the renter's e-wallet.
 * Unpaid bookings are simply cancelled — nothing is ever credited for missing funds.
 */
const refundBooking = async (bookingId, reason) => {
  const transaction = await sequelize.transaction();
  try {
    const booking = await loadBooking(bookingId, transaction);
    if (!booking) throw new Error('Booking not found');
    if (booking.escrowStatus === 'refunded') {
      await transaction.commit();
      return { success: true, booking, refunded: false, alreadyRefunded: true };
    }
    if (booking.escrowStatus === 'released') {
      throw new Error('Payout already released to the owner. An admin must resolve this manually.');
    }

    if (!FUNDED_STATES.includes(booking.paymentStatus)) {
      booking.status = 'cancelled';
      await booking.save({ transaction });
      await transaction.commit();
      return { success: true, booking, refunded: false };
    }

    const admin = await User.findOne({ where: { role: 'admin' }, transaction });
    const serviceCharge = Number(booking.serviceChargeAmount || 0);

    // Return the platform fee only if it was actually credited.
    if (admin && serviceCharge > 0) {
      await debitWallet(
        admin.id,
        serviceCharge,
        'refund',
        `Service charge reversal for booking ${booking.bookingReference}`,
        { bookingId: booking.id, metadata: { reason }, transaction }
      );
    }

    await creditWallet(
      booking.renterId,
      Number(booking.totalAmount),
      'refund',
      `Refund for booking ${booking.bookingReference}: ${reason}`,
      { bookingId: booking.id, metadata: { reason }, transaction }
    );

    booking.paymentStatus = 'refunded';
    booking.escrowStatus = 'refunded';
    booking.status = 'cancelled';
    await booking.save({ transaction });

    await transaction.commit();
    return { success: true, booking, refunded: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Charge the renter for fuel/damage/delay after a rental.
 * Debits the wallet when funded, otherwise records a pending charge for the admin.
 */
const chargeRenterExtras = async (booking, extraTotal) => {
  if (!(extraTotal > 0)) return { charged: false, pending: false };

  const transaction = await sequelize.transaction();
  try {
    const renter = await User.findByPk(booking.renterId, { transaction });
    if (!renter) throw new Error('Renter not found');

    const wallet = await Wallet.findOne({ where: { userId: renter.id }, transaction });
    const available = Number(wallet?.balance || 0);

    if (available >= extraTotal) {
      await debitWallet(
        renter.id,
        extraTotal,
        'additional_charge',
        `Extra charges for booking ${booking.bookingReference}`,
        { bookingId: booking.id, metadata: { fuel: booking.fuelCharged, damage: booking.damageCharged, delay: booking.delayCharge }, transaction }
      );
      await transaction.commit();
      return { charged: true, pending: false };
    }

    await Transaction.create(
      {
        reference: `TXN-EXTRA-${booking.id}-${Date.now()}`,
        type: 'additional_charge',
        userId: renter.id,
        bookingId: booking.id,
        amount: extraTotal,
        status: 'pending',
        description: `Outstanding extra charges for booking ${booking.bookingReference}`,
        metadata: { fuel: booking.fuelCharged, damage: booking.damageCharged, delay: booking.delayCharge, delayHours: booking.delayHours },
      },
      { transaction }
    );
    await transaction.commit();
    return { charged: false, pending: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  processBookingEscrow,
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
};
