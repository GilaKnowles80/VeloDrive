const { Wallet, Transaction, User } = require('../models');
const { creditWallet, debitWallet, getOrCreateWallet } = require('../services/paymentService');
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

    // The reference is derived from the order id, so a repeat capture cannot credit twice.
    const reference = `TOPUP-${orderId}`;
    const alreadyCredited = await Transaction.findOne({ where: { reference } });
    if (alreadyCredited) {
      const wallet = await getOrCreateWallet(req.user.id);
      return res.json({ success: true, alreadyProcessed: true, wallet, amount: Number(alreadyCredited.amount) });
    }

    const capture = await capturePayPalPayment(orderId);
    if (!capture.success) {
      return res.status(502).json({ success: false, message: capture.error || 'PayPal capture failed' });
    }

    const unit = capture.paypalResponse?.purchase_units?.[0];
    const expectedRef = `wallet_${req.user.id}`;
    if (unit?.reference_id && unit.reference_id !== expectedRef) {
      return res.status(403).json({ success: false, message: 'This PayPal order does not belong to your wallet' });
    }

    const amount = Number(capture.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(502).json({ success: false, message: 'PayPal returned an invalid captured amount' });
    }

    const result = await creditWallet(req.user.id, amount, 'wallet_topup', 'Wallet top-up via PayPal', {
      reference,
      metadata: { paypalOrderId: orderId, paypalTransactionId: capture.transactionId },
    });

    res.json({ success: true, message: 'Wallet topped up', wallet: result.wallet, amount });
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
