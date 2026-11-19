const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { protect } = require('../middleware/auth');
const { Booking, Transaction, User, Wallet } = require('../models');
const { getOrder, verifyPayPalWebhook } = require('../services/paypalService');
const { processBookingEscrow } = require('../services/escrowService');

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
      const [version, sig] = part.split(',', 2);
      return version === 'v1' && sig === expected;
    });
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    req.resendEvent = JSON.parse(payload);
    next();
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }
};

router.post('/resend', verifyResendSignature, async (req, res) => {
  const event = req.resendEvent || {};
  console.log(JSON.stringify({ level: 'info', msg: 'resend_webhook', type: event.type, id: event.id }));
  res.json({ success: true, received: true });
});

const verifyPayPalSignature = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid PayPal webhook payload' });
    }
    const verified = await verifyPayPalWebhook(req.headers, req.body);
    if (!verified) return res.status(401).json({ success: false, message: 'Invalid PayPal webhook signature' });
    next();
  } catch (error) {
    const missingConfiguration = /not configured/i.test(error.message);
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_webhook_verification_error', error: error.message }));
    return res.status(missingConfiguration ? 503 : 502).json({
      success: false,
      message: missingConfiguration ? 'PayPal webhook verification is not configured' : 'Could not verify PayPal webhook',
    });
  }
};

const loadVerifiedOrder = async (event) => {
  const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
  if (!orderId) return null;

  const result = await getOrder(orderId);
  if (!result.success || !result.order || result.order.id !== orderId) {
    throw new Error(result.error || 'Could not retrieve PayPal order');
  }
  const order = result.order;
  const capture = order.capture;
  if (
    event.event_type !== 'PAYMENT.CAPTURE.COMPLETED' ||
    order.status !== 'COMPLETED' ||
    capture?.status !== 'COMPLETED' ||
    capture.id !== event.resource.id ||
    Number(capture.amount).toFixed(2) !== Number(event.resource.amount?.value).toFixed(2) ||
    capture.currency !== event.resource.amount?.currency_code
  ) {
    return null;
  }
  return { orderId, order, capture };
};

const settleBooking = async ({ orderId, order, capture }) => {
  const booking = await Booking.findOne({ where: { paypalOrderId: orderId } });
  if (!booking || order.referenceId !== `booking_${booking.id}`) return false;
  if (
    Number(order.amount).toFixed(2) !== Number(booking.totalAmount).toFixed(2) ||
    order.currency !== booking.currency ||
    Number(capture.amount).toFixed(2) !== Number(booking.totalAmount).toFixed(2) ||
    capture.currency !== booking.currency
  ) return false;

  await sequelize.transaction(async (transaction) => {
    const currentBooking = await Booking.findByPk(booking.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!currentBooking || currentBooking.escrowStatus === 'held' || currentBooking.escrowStatus === 'released') return;

    const payment = await Transaction.findOne({
      where: { reference: `TXN-BK-${currentBooking.id}` },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (payment && payment.status !== 'completed') {
      payment.status = 'completed';
      payment.metadata = {
        ...(payment.metadata || {}),
        paypalOrderId: orderId,
        paypalTransactionId: capture.id,
        provider: 'paypal',
      };
      await payment.save({ transaction });
    }
    currentBooking.paymentMethod = 'paypal';
    currentBooking.paymentDate = currentBooking.paymentDate || new Date();
    currentBooking.paymentStatus = 'paid';
    if (currentBooking.status === 'pending') currentBooking.status = 'confirmed';
    await currentBooking.save({ transaction });
  });

  await processBookingEscrow(booking.id);
  return true;
};

const settleWalletTopup = async ({ orderId, order, capture }) => {
  const topup = await Transaction.findOne({
    where: { reference: `TOPUP-${orderId}`, type: 'wallet_topup' },
  });
  if (!topup || order.referenceId !== `wallet_${topup.userId}`) return false;
  if (
    Number(order.amount).toFixed(2) !== Number(topup.amount).toFixed(2) ||
    order.currency !== topup.currency ||
    Number(capture.amount).toFixed(2) !== Number(topup.amount).toFixed(2) ||
    capture.currency !== topup.currency
  ) return false;

  await sequelize.transaction(async (transaction) => {
    const currentTopup = await Transaction.findByPk(topup.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!currentTopup || currentTopup.status === 'completed') return;
    if (currentTopup.status !== 'pending') return;

    let wallet = await Wallet.findOne({
      where: { userId: currentTopup.userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!wallet) wallet = await Wallet.create({ userId: currentTopup.userId, balance: 0 }, { transaction });
    wallet.balance = Number((Number(wallet.balance) + Number(capture.amount)).toFixed(2));
    await wallet.save({ transaction });

    currentTopup.status = 'completed';
    currentTopup.metadata = {
      ...(currentTopup.metadata || {}),
      paypalOrderId: orderId,
      paypalTransactionId: capture.id,
      provider: 'paypal',
      capturedAt: new Date().toISOString(),
    };
    await currentTopup.save({ transaction });
  });
  return true;
};

const settleMembership = async ({ orderId, order, capture }) => {
  if (!order.referenceId || !order.referenceId.startsWith('membership_')) return false;
  const membership = await Transaction.findOne({
    where: {
      [Op.and]: [
        { type: 'membership', status: 'pending' },
        sequelize.where(sequelize.json('metadata.paypalOrderId'), orderId),
      ],
    },
  });
  if (!membership || order.referenceId !== `membership_${membership.userId}`) return false;
  if (
    Number(order.amount).toFixed(2) !== Number(membership.amount).toFixed(2) ||
    order.currency !== membership.currency ||
    Number(capture.amount).toFixed(2) !== Number(membership.amount).toFixed(2) ||
    capture.currency !== membership.currency
  ) return false;

  const owner = await User.findByPk(membership.userId);
  if (!owner || owner.role !== 'owner') return false;
  await membership.update({
    status: 'completed',
    metadata: {
      ...(membership.metadata || {}),
      paypalTransactionId: capture.id,
      capturedAt: new Date().toISOString(),
    },
  });
  return true;
};

const paymentWebhook = async (req, res) => {
  try {
    const { event_type: eventType, resource } = req.body;
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const verified = await loadVerifiedOrder(req.body);
      if (verified) {
        const settled = await settleBooking(verified)
          || await settleWalletTopup(verified)
          || await settleMembership(verified);
        if (!settled) {
          console.warn(JSON.stringify({ level: 'warn', msg: 'paypal_webhook_unmatched_capture', orderId: verified.orderId }));
        }
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      const orderId = resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        const booking = await Booking.findOne({ where: { paypalOrderId: orderId } });
        if (booking && booking.paymentStatus === 'pending') {
          booking.paymentStatus = 'failed';
          booking.status = 'cancelled';
          await booking.save();
        }
        let payment = await Transaction.findOne({
          where: {
            [Op.and]: [
              { type: 'membership', status: 'pending' },
              sequelize.where(sequelize.json('metadata.paypalOrderId'), orderId),
            ],
          },
        });
        if (!payment) {
          payment = await Transaction.findOne({
            where: { type: 'wallet_topup', status: 'pending', reference: `TOPUP-${orderId}` },
          });
        }
        if (payment) {
          payment.status = 'failed';
          await payment.save();
        }
      }
    } else {
      console.log(JSON.stringify({ level: 'info', msg: 'paypal_webhook_ignored', type: eventType }));
    }

    return res.json({ success: true, received: true });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_webhook_processing_error', error: error.message }));
    return res.status(500).json({ success: false, message: 'PayPal webhook processing failed' });
  }
};

router.post('/payment', verifyPayPalSignature, paymentWebhook);
router.post('/subscription', verifyPayPalSignature, paymentWebhook);

module.exports = router;
