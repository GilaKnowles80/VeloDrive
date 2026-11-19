import { Op } from 'sequelize';
import db from '../models/index.js';
import { sequelize } from '../config/database.js';
import { capturePayPalPayment, getOrder } from '../services/paypalService.js';
import { processBookingEscrow } from '../services/paymentService.js';

const { Booking, Transaction } = db;

/**
 * Capture an approved PayPal order and move the booking into escrow.
 * Safe to call more than once: a booking already captured short-circuits.
 */
export const capturePayPalOrder = async (req, res) => {
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
          transactionId: capture