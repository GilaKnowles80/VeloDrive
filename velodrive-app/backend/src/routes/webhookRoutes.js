const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');
const { processSplitPayment, processOwnerSubscription, refundPayment } = require('../services/paypalService');
const { Booking, Transaction, User, Vehicle } = require('../models');

// Resend sends Svix-signed webhooks. Capture raw body for signature verification.
router.use('/resend', express.raw({ type: '*/*', limit: '1mb' }));

const verifyResendSignature = (req, res, next) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ success: false, message: 'Resend webhook secret not configured' });
  const id = req.headers['svix-id'];
  const timestamp = req.headers['svix-timestamp'];
  const signature = req.headers['svix-signature'];
  if (!id || !timestamp || !signature) return res.status(401).json({ success: false, message: 'Missing Svix signature headers' });
  try {
    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    const toSign = `${id}.${timestamp}.${payload}`;
    const secretBytes = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');
    const ok = String(signature).split(' ').some((part) => {
      const [v, sig] = part.split(',', 2);
      return v === 'v1' && sig === expected;
    });
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    req.resendEvent = JSON.parse(payload);
    next();
  } catch (e) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }
};

router.post('/resend', verifyResendSignature, async (req, res) => {
  // Acknowledge events (contact.* / email.*) for observability; no state mutation required.
  const evt = req.resendEvent || {};
  console.log(JSON.stringify({ level: 'info', msg: 'resend_webhook', type: evt.type, id: evt.id }));
  res.json({ success: true, received: true });
});

/**
 * Verify PayPal webhook signature
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['webhook-signature'] || req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    return res.status(503).json({ success: false, message: 'Webhook secret not configured' });
  }
  if (!signature) {
    return res.status(401).json({ success: false, message: 'Missing webhook signature' });
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

          // Update booking status to active (renter picked up vehicle)
          booking.status = 'active';
          booking.paymentStatus = 'paid';
          await booking.save();

          // Set vehicle to en-route and mark unavailable for new bookings
          await Vehicle.update(
            { status: 'en-route', isAvailable: false },
            { where: { id: booking.vehicleId } }
          );

          const serviceChargeAmount = parseFloat(booking.serviceChargeFee || 0);
          const ownerNetAmount = parseFloat(booking.ownerNetAmount || 0);

          await processSplitPayment({
            bookingId,
            paypalTransactionId,
            serviceChargeAmount,
            ownerNetAmount,
            totalAmount: parseFloat(booking.totalAmount || 0),
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
 * Membership webhook - handles owner membership payment (monthly Php 499 / yearly Php 4,999)
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
            amount: parseFloat(resource.amount.value) || 4999,
            currency: resource.amount.currency_code || 'PHP',
            status: 'completed',
            description: `VeloDrive membership fee (Php ${parseFloat(resource.amount.value) || 4999})`,
            metadata: {
              paypalSubscriptionId: resource.id,
              role: 'owner',
              feeType: 'membership',
              recipient: process.env.PAYPAL_ADMIN_EMAIL,
              billingCycle: resource.custom_id?.includes('monthly') ? 'monthly' : 'yearly',
              isOneTime: false,
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
