const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');
const { processSplitPayment, processOwnerSubscription, refundPayment } = require('../services/paypalService');
const { Booking, Transaction, User } = require('../models');

/**
 * Verify PayPal webhook signature
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['webhook-signature'] || req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET || '86L924545P298361E';

  if (!secret) {
    return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
  }

  const expected = crypto.createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expected) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
  }

  next();
};

/**
 * Payment webhook - handles payment.completed, payment.failed, refund.processed
 */
router.post('/payment', verifyWebhookSignature, async (req, res) => {
  try {
    const { event, data } = req.body;

    switch (event) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const { id: paypalTransactionId, amount, custom_id } = data;
        const bookingId = custom_id ? custom_id.replace('booking_', '') : null;

        if (bookingId) {
          const booking = await Booking.findByPk(bookingId, {
            include: [{ model: User, as: 'owner' }, { model: User, as: 'renter' }]
          });

          if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
          }

          const basePrice = parseFloat(booking.basePrice);
          const adminServiceCharge = parseFloat(booking.serviceChargeAmount || 250);
          const ownerPayout = parseFloat(booking.ownerPayout || 0);

          await processSplitPayment({
            bookingId,
            paypalTransactionId,
            adminAmount: adminServiceCharge,
            ownerAmount: ownerPayout,
            salesAgentAmount: 0,
            salesAgentId: null,
            adminPaypalEmail: process.env.PAYPAL_ADMIN_EMAIL,
            ownerPaypalEmail: booking.owner?.paypalEmail
          });
        }
        break;
      }

      case 'PAYMENT.CAPTURE.DENIED': {
        const { custom_id } = data;
        const bookingId = custom_id ? custom_id.replace('booking_', '') : null;
        if (bookingId) {
          const booking = await Booking.findByPk(bookingId);
          if (booking) {
            booking.paymentStatus = 'failed';
            booking.status = 'cancelled';
            await booking.save();
          }
        }
        break;
      }

      case 'PAYMENT.REFUND': {
        const { custom_id, reason } = data;
        const bookingId = custom_id ? custom_id.replace('booking_', '') : null;
        if (bookingId) {
          await refundPayment({
            paypalTransactionId: data.id,
            amount: parseFloat(data.amount.value),
            reason: reason || 'Refund processed via webhook'
          });
        }
        break;
      }

      default:
        console.log(`Unhandled payment webhook event: ${event}`);
    }

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('Payment webhook error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Membership webhook - handles owner one-time yearly Php 2,500 fee
 */
router.post('/subscription', verifyWebhookSignature, async (req, res) => {
  try {
    const { event_type, resource } = req.body;

    if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED' || event_type === 'BILLING.SUBSCRIPTION.PAYMENT') {
      const customId = resource.custom_id;
      const ownerId = customId ? customId.replace('membership_', '') : null;

      if (ownerId) {
        const owner = await User.findByPk(ownerId);
        if (owner && owner.role === 'owner') {
          await Transaction.create({
            reference: `MEMB-PAYPAL-${resource.id}`,
            type: 'membership',
            userId: ownerId,
            amount: parseFloat(resource.amount.value) || 2500,
            status: 'completed',
            description: `One-time yearly VeloDrive membership fee (Php 2,500)`,
            metadata: {
              paypalSubscriptionId: resource.id,
              role: 'owner',
              feeType: 'membership',
              recipient: process.env.PAYPAL_ADMIN_EMAIL,
              isOneTime: true,
              billingCycle: 'yearly'
            }
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Subscription webhook error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
