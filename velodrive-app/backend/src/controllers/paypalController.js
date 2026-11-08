const { Booking, Transaction } = require('../models');
const { capturePayPalPayment, getOrder } = require('../services/paypalService');
const { processBookingEscrow } = require('../services/paymentService');

const CAPTURED_STATES = ['paid', 'held_in_escrow', 'released_to_owner'];

const isAlreadyCapturedError = (message) => /ALREADY_CAPTURED|ORDER_ALREADY_CAPTURED/i.test(message || '');

/**
 * Capture an approved PayPal order and move the booking into escrow.
 * Safe to call more than once: a booking already captured short-circuits.
 */
const capturePayPalOrder = async (req, res) => {
  try {
    const { bookingId, orderId: suppliedOrderId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }

    const booking = await Booking.findByPk(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.renterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (CAPTURED_STATES.includes(booking.paymentStatus)) {
      return res.json({
        success: true,
        alreadyCaptured: true,
        message: 'Payment was already captured for this booking',
        booking,
      });
    }

    const orderId = suppliedOrderId || booking.paypalOrderId;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'This booking has no associated PayPal order' });
    }

    const capture = await capturePayPalPayment(orderId);

    if (!capture.success) {
      if (isAlreadyCapturedError(capture.error)) {
        return res.status(409).json({
          success: false,
          alreadyCaptured: true,
          message: 'This PayPal order was already captured. Refresh to see the latest status.',
        });
      }
      return res.status(502).json({ success: false, message: capture.error || 'PayPal capture failed' });
    }

    booking.paymentMethod = 'paypal';
    booking.paymentDate = new Date();
    booking.paymentStatus = 'paid';
    booking.paypalOrderId = orderId;
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

    res.json({
      success: true,
      message: 'Payment captured. Funds are held in escrow until the rental is completed.',
      booking: escrow.booking || booking,
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
