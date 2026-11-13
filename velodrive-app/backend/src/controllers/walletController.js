const { Wallet, Transaction, User } = require('../models');
const { sequelize } = require('../config/database');
const { debitWallet, getOrCreateWallet } = require('../services/paymentService');
const { createTopupOrder, capturePayPalPayment } = require('../services/paypalService');

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;
const HISTORY_LIMIT = 100;

const parseAmount = (raw) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toFixed(2));
  if (rounded < MIN_AMOUNT || rounded > MAX_AMOUNT) return null;
  return rounded;
};

const getMyWallet = async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user.id);

    const transactions = await Transaction.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: HISTORY_LIMIT,
    });

    res.json({ success: true, wallet, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Step 1 of a top-up: create a PayPal order.
 * No balance is credited here — only a captured payment can fund the wallet.
 */
const requestTopup = async (req, res) => {
  try {
    const amount = parseAmount(req.body.amount);
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: `Enter an amount between Php ${MIN_AMOUNT} and Php ${MAX_AMOUNT}.`,
      });
    }

    const frontendUrl = (process.env.FRONTEND_URL || '').split(',')[0].trim();
    const order = await createTopupOrder({
      userId: req.user.id,
      amount,
      currency: 'PHP',
      returnUrl: `${frontendUrl}/wallet?topup=success`,
      cancelUrl: `${frontendUrl}/wallet?topup=cancelled`,
    });

    if (!order.success) {
      return res.status(502).json({ success: false, message: 'Could not start the PayPal top-up. Please try again.' });
    }

    res.json({
      success: true,
      message: 'PayPal order created. Complete the payment to fund your wallet.',
      orderId: order.orderId,
      approvalUrl: order.approvalUrl,
      amount,
      currency: order.currency,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Step 2: capture the approved order and credit the wallet exactly once.
 */
const captureTopup = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, message: 'PayPal order id is required' });
    }

    const reference = `TOPUP-${orderId}`;
    const pendingTopup = await Transaction.findOne({
      where: { reference, userId: req.user.id, type: 'wallet_topup' },
    });
    if (!pendingTopup) {
      return res.status(404).json({ success: false, message: 'No wallet top-up was created for this PayPal order' });
    }

    if (pendingTopup.status === 'completed') {
      const wallet = await getOrCreateWallet(req.user.id);
      return res.json({ success: true, alreadyProcessed: true, wallet, amount: Number(pendingTopup.amount) });
    }
    if (pendingTopup.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'This wallet top-up is not pending' });
    }

    const capture = await capturePayPalPayment(orderId);
    if (!capture.success) {
      return res.status(502).json({ success: false, message: capture.error || 'PayPal capture failed' });
    }

    const expectedRef = `wallet_${req.user.id}`;
    if (capture.referenceId !== expectedRef) {
      return res.status(403).json({ success: false, message: 'This PayPal order does not belong to your wallet' });
    }

    const amount = Number(capture.amount);
    const expectedAmount = Number(pendingTopup.amount);
    if (
      capture.status !== 'COMPLETED' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount.toFixed(2) !== expectedAmount.toFixed(2) ||
      capture.currency !== pendingTopup.currency ||
      Number(capture.orderAmount).toFixed(2) !== expectedAmount.toFixed(2) ||
      capture.orderCurrency !== pendingTopup.currency
    ) {
      return res.status(502).json({ success: false, message: 'PayPal capture details do not match the pending top-up' });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const currentTopup = await Transaction.findOne({
        where: { reference, userId: req.user.id, type: 'wallet_topup' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!currentTopup) throw new Error('Wallet top-up was not found');
      if (currentTopup.status === 'completed') {
        const wallet = await getOrCreateWallet(req.user.id, transaction);
        return { wallet, amount: Number(currentTopup.amount), alreadyProcessed: true };
      }
      if (currentTopup.status !== 'pending') {
        throw new Error('This wallet top-up is no longer pending');
      }

      let wallet = await Wallet.findOne({
        where: { userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!wallet) wallet = await Wallet.create({ userId: req.user.id, balance: 0 }, { transaction });
      wallet.balance = Number((Number(wallet.balance) + amount).toFixed(2));
      await wallet.save({ transaction });

      currentTopup.status = 'completed';
      currentTopup.metadata = {
        ...(currentTopup.metadata || {}),
        paypalOrderId: orderId,
        paypalTransactionId: capture.transactionId,
        provider: 'paypal',
        capturedAt: new Date().toISOString(),
      };
      await currentTopup.save({ transaction });
      return { wallet, amount, alreadyProcessed: false };
    });

    res.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      message: 'Wallet topped up',
      wallet: result.wallet,
      amount: result.amount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const withdrawWallet = async (req, res) => {
  try {
    const amount = parseAmount(req.body.amount);
    if (!amount) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user.bankAccountName || !user.bankAccountNumber || !user.bankName) {
      return res.status(400).json({ success: false, message: 'Bank account details not set. Please update your profile.' });
    }

    const wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet || Number(wallet.balance) < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    const result = await debitWallet(
      req.user.id,
      amount,
      'wallet_withdrawal',
      `Wallet withdrawal to ${user.bankName} (${user.bankAccountNumber})`,
      { metadata: { bankName: user.bankName, bankAccountName: user.bankAccountName } }
    );

    res.json({ success: true, message: 'Withdrawal processed', wallet: result.wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyWallet, requestTopup, captureTopup, withdrawWallet };
