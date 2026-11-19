const { Op } = require('sequelize');
const { Booking, Transaction } = require('../models');
const { sequelize } = require('../config/database');
const { capturePayPalPayment, getOrder } = require('../services/paypalService');
const { processBookingEscrow } = require('../services/paymentService');

/**
 * Capture an approved PayPal order and move the booking into escrow.
 * Safe to call more than once: a booking already captured short-circuits.
 */
const capturePayPalOrder = async (req, res) => {
  try {
    const { bookingId, orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'PayPal order id is required' });
    }

    if (bookingId) {
      const booking = await Booking.findByPk(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (booking.renterId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      if (booking.paypalOrderId !== orderId) {
        return res.status(403).json({ success: false, message: 'PayPal order does not match this booking' });
      }
      if (['held', 'released'].includes(booking.escrowStatus)) {
        return res.json({
          success: true,
          alreadyCaptured: true,
          message: 'Payment is already held in escrow.',
          booking,
        });
      }

      const capture = await capturePayPalPayment(orderId);
      if (!capture.success) {
        return res.status(502).json({ success: false, message: capture.error || 'PayPal capture failed' });
      }
      if (!matchesCapture(capture, `booking_${booking.id}`, booking.totalAmount, booking.currency)) {
        return res.status(502).json({ success: false, message: 'PayPal capture details do not match this booking' });
      }

      booking.paymentMethod = 'paypal';
      booking.paymentDate = booking.paymentDate || new Date();
      booking.paymentStatus = 'paid';
      if (booking.status === 'pending') booking.status = 'confirmed';
      await booking.save();

      const pendingTransaction = await Transaction.findOne({ where: { reference: `TXN-BK-${booking.id}` } });
      if (pendingTransaction) {
        pendingTransaction.status = 'completed';
        pendingTransaction.amount = capture.amount;
        pendingTransaction.metadata = {
          ...(pendingTransaction.metadata || {}),
          paypalTransactionId: capture.transactionId,
          paypalOrderId: orderId,
          provider: 'paypal',
        };
        await pendingTransaction.save();
      } else {
        await Transaction.create({
          reference: `TXN-PAYPAL-${capture.transactionId}`,
          type: 'booking_payment',
          userId: booking.renterId,
          bookingId: booking.id,
          amount: capture.amount,
          status: 'completed',
          description: `PayPal payment for booking ${booking.bookingReference}`,
          metadata: { paypalTransactionId: capture.transactionId, paypalOrderId: orderId, provider: 'paypal' },
        });
      }

      const escrow = await processBookingEscrow(booking.id);
      return res.json({
        success: true,
        alreadyCaptured: Boolean(capture.alreadyCaptured),
        message: 'Payment captured. Funds are held in escrow until the rental is completed.',
        booking: escrow.booking || booking,
        payment: {
          transactionId: capture.transactionId,
          status: capture.status,
          amount: capture.amount,
          currency: capture.currency,
        },
      });
    }

    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const membershipTransaction = await Transaction.findOne({
      where: {
        userId: req.user.id,
        type: 'membership',
        [Op.and]: sequelize.where(sequelize.json('metadata.paypalOrderId'), orderId),
      },
    });
    if (!membershipTransaction) {
      return res.status(404).json({ success: false, message: 'No membership payment was created for this PayPal order' });
    }
    if (membershipTransaction.status === 'completed') {
      return res.json({ success: true, alreadyCaptured: true, transaction: membershipTransaction });
    }
    if (membershipTransaction.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'This membership payment is not pending' });
    }

    const capture = await capturePayPalPayment(orderId);
    if (!capture.success) {
      return res.status(502).json({ success: false, message: capture.error || 'PayPal capture failed' });
    }
    if (!matchesCapture(capture, `membership_${req.user.id}`, membershipTransaction.amount, membershipTransaction.currency)) {
      return res.status(502).json({ success: false, message: 'PayPal capture details do not match this membership payment' });
    }

    membershipTransaction.status = 'completed';
    membershipTransaction.metadata = {
      ...(membershipTransaction.metadata || {}),
      paypalTransactionId: capture.transactionId,
      capturedAt: new Date().toISOString(),
    };
    await membershipTransaction.save();
    return res.json({
      success: true,
      alreadyCaptured: Boolean(capture.alreadyCaptured),
      message: 'Membership payment completed.',
      transaction: membershipTransaction,
      payment: {
        transactionId: capture.transactionId,
        status: capture.status,
        amount: capture.amount,
        currency: capture.currency,
      },
    });
  } catch (error) {
    console.error('PayPal capture error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const matchesCapture = (capture, expectedReference, expectedAmount, expectedCurrency) => {
  const amount = Number(expectedAmount);
  return (
    capture.status === 'COMPLETED' &&
    capture.referenceId === expectedReference &&
    Number(capture.amount).toFixed(2) === amount.toFixed(2) &&
    capture.currency === expectedCurrency &&
    Number(capture.orderAmount).toFixed(2) === amount.toFixed(2) &&
    capture.orderCurrency === expectedCurrency
  );
};

/**
 * Read an order's status from PayPal. Restricted to the booking's renter, its
 * owner, or an admin so order ids cannot be probed by unrelated accounts.
 */
const getPayPalOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (req.user.role !== 'admin') {
      const booking = await Booking.findOne({ where: { paypalOrderId: orderId } });
      const isParticipant = booking && (booking.renterId === req.user.id || booking.ownerId === req.user.id);
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const result = await getOrder(orderId);
    if (!result.success) {
      return res.status(502).json({ success: false, message: result.error || 'Could not load the PayPal order' });
    }

    res.json({ success: true, order: result.order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { capturePayPalOrder, getPayPalOrder };
