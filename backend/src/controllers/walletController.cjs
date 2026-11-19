import db from '../models/index.js';
import { sequelize } from '../config/database.js';
import { debitWallet, getOrCreateWallet } from '../services/paymentService.js';
import { createTopupOrder, capturePayPalPayment } from '../services/paypalService.js';

const { Wallet, Transaction, User } = db;

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10000000;
const HISTORY_LIMIT = 100;

const parseAmount = (raw) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toFixed(2));
  if (rounded < MIN_AMOUNT || rounded > MAX_AMOUNT) return null;
  return rounded;
};

export const getMyWallet = async (req, res) => {
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
export const requestTopup = async (req, res) => {
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
export const captureTopup = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(40