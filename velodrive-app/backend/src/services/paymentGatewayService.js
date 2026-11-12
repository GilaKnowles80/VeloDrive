const { createTopupOrder, capturePayPalPayment } = require('./paypalService');
const { Wallet, Transaction, User } = require('../models');
const { sequelize } = require('../config/database');

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;

const buildReference = (prefix) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const parseAmount = (raw) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toFixed(2));
  if (rounded < MIN_AMOUNT || rounded > MAX_AMOUNT) return null;
  return rounded;
};

/**
 * Create a payment intent for wallet top-up.
 * Returns provider-specific data (redirectUrl for PayPal, instructions for GCash/bank_transfer).
 * Creates a PENDING transaction row that gets completed on capture.
 */
const createPayment = async ({ userId, amount, paymentMethod, returnUrl, cancelUrl }) => {
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) {
    return { success: false, error: `Enter an amount between Php ${MIN_AMOUNT} and Php ${MAX_AMOUNT}.` };
  }

  const user = await User.findByPk(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  switch (paymentMethod) {
    case 'paypal': {
      const frontendUrl = (process.env.FRONTEND_URL || '').split(',')[0].trim();
      const order = await createTopupOrder({
        userId,
        amount: parsedAmount,
        currency: 'PHP',
        returnUrl: returnUrl || `${frontendUrl}/wallet?topup=success`,
        cancelUrl: cancelUrl || `${frontendUrl}/wallet?topup=cancelled`,
      });
      if (!order.success) {
        return { success: false, error: order.error || 'Could not start PayPal top-up.' };
      }

      const reference = buildReference('TOPUP');
      await Transaction.create({
        reference,
        type: 'wallet_topup',
        userId,
        amount: parsedAmount,
        currency: 'PHP',
        status: 'pending',
        description: `Wallet top-up via PayPal (Php ${parsedAmount.toFixed(2)})`,
        metadata: {
          paypalOrderId: order.orderId,
          provider: 'paypal',
          paymentMethod,
        },
      });

      return {
        success: true,
        paymentMethod: 'paypal',
        redirectUrl: order.approvalUrl,
        referenceId: order.orderId,
        internalReference: reference,
        amount: parsedAmount,
        currency: 'PHP',
        message: 'Redirect to PayPal to complete the payment.',
      };
    }

    case 'gcash': {
      const gcashNumber = user.gcashNumber;
      if (!gcashNumber) {
        return {
          success: false,
          error: 'GCash number not set. Please add your GCash number in Profile first.',
          requiresSetup: true,
        };
      }

      const reference = buildReference('GCASH');
      await Transaction.create({
        reference,
        type: 'wallet_topup',
        userId,
        amount: parsedAmount,
        currency: 'PHP',
        status: 'pending',
        description: `Wallet top-up via GCash (Php ${parsedAmount.toFixed(2)})`,
        metadata: {
          provider: 'gcash',
          paymentMethod,
          gcashNumber,
          instructions: `Send Php ${parsedAmount.toFixed(2)} to GCash number ${gcashNumber}. Reference: ${reference}`,
        },
      });

      return {
        success: true,
        paymentMethod: 'gcash',
        redirectUrl: null,
        referenceId: reference,
        internalReference: reference,
        amount: parsedAmount,
        currency: 'PHP',
        instructions: `Send Php ${parsedAmount.toFixed(2)} to GCash number ${gcashNumber}. Use reference code: ${reference}`,
        gcashNumber,
        message: 'GCash payment instructions generated. Complete the transfer, then verify below.',
      };
    }

    case 'bank_transfer': {
      if (!user.bankAccountName || !user.bankAccountNumber || !user.bankName) {
        return {
          success: false,
          error: 'Bank account details not set. Please add your bank account in Profile first.',
          requiresSetup: true,
        };
      }

      const reference = buildReference('BANK');
      await Transaction.create({
        reference,
        type: 'wallet_topup',
        userId,
        amount: parsedAmount,
        currency: 'PHP',
        status: 'pending',
        description: `Wallet top-up via Bank Transfer (Php ${parsedAmount.toFixed(2)})`,
        metadata: {
          provider: 'bank_transfer',
          paymentMethod,
          bankName: user.bankName,
          bankAccountName: user.bankAccountName,
          bankAccountNumber: user.bankAccountNumber,
          instructions: `Transfer Php ${parsedAmount.toFixed(2)} to ${user.bankName} account ${user.bankAccountNumber} (${user.bankAccountName}). Reference: ${reference}`,
        },
      });

      return {
        success: true,
        paymentMethod: 'bank_transfer',
        redirectUrl: null,
        referenceId: reference,
        internalReference: reference,
        amount: parsedAmount,
        currency: 'PHP',
        instructions: `Transfer Php ${parsedAmount.toFixed(2)} to ${user.bankName} account ${user.bankAccountNumber} (${user.bankAccountName}). Reference: ${reference}`,
        bankName: user.bankName,
        bankAccountName: user.bankAccountName,
        bankAccountNumber: user.bankAccountNumber,
        message: 'Bank transfer instructions generated. Complete the transfer, then verify below.',
      };
    }

    default:
      return { success: false, error: 'Unsupported payment method. Use paypal, gcash, or bank_transfer.' };
  }
};

/**
 * Capture/complete a payment and credit the wallet.
 * For PayPal: verifies the capture server-side.
 * For GCash/bank_transfer: marks the pending transaction as completed (user self-confirms or admin verifies).
 */
const capturePayment = async ({ userId, paymentMethod, referenceId, confirmCode }) => {
  const user = await User.findByPk(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  switch (paymentMethod) {
    case 'paypal': {
      if (!referenceId) {
        return { success: false, error: 'PayPal order id is required' };
      }

      const existing = await Transaction.findOne({
        where: { userId, type: 'wallet_topup', status: 'completed', 'metadata.paypalOrderId': referenceId },
      });
      if (existing) {
        const wallet = await user.getWallet || (await Wallet.findOne({ where: { userId } }));
        return { success: true, alreadyProcessed: true, wallet, amount: Number(existing.amount) };
      }

      const capture = await capturePayPalPayment(referenceId);
      if (!capture.success) {
        return { success: false, error: capture.error || 'PayPal capture failed' };
      }

      const unit = capture.paypalResponse?.purchase_units?.[0];
      const expectedRef = `wallet_${userId}`;
      if (unit?.reference_id && unit.reference_id !== expectedRef) {
        return { success: false, error: 'This PayPal order does not belong to your wallet' };
      }

      const amount = Number(capture.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, error: 'PayPal returned an invalid captured amount' };
      }

      const tx = await Transaction.findOne({
        where: { userId, type: 'wallet_topup', status: 'pending', 'metadata.paypalOrderId': referenceId },
      });
      if (!tx) {
        return { success: false, error: 'No pending top-up found for this PayPal order' };
      }

      const result = await sequelize.transaction(async (t) => {
        let wallet = await Wallet.findOne({ where: { userId }, transaction: t });
        if (!wallet) {
          const w = await Wallet.create({ userId, balance: 0.0 }, { transaction: t });
          wallet = w;
        }
        const next = Number((Number(wallet.balance) + amount).toFixed(2));
        wallet.balance = next;
        await wallet.save({ transaction: t });

        tx.status = 'completed';
        tx.metadata = { ...tx.metadata, paypalTransactionId: capture.transactionId, capturedAt: new Date().toISOString() };
        await tx.save({ transaction: t });

        return { wallet, amount };
      });

      return {
        success: true,
        message: 'Wallet topped up via PayPal',
        wallet: result.wallet,
        amount: result.amount,
      };
    }

    case 'gcash':
    case 'bank_transfer': {
      if (!referenceId) {
        return { success: false, error: 'Reference code is required' };
      }

      const tx = await Transaction.findOne({
        where: {
          userId,
          type: 'wallet_topup',
          status: 'pending',
          reference: referenceId,
        },
      });
      if (!tx) {
        return { success: false, error: 'No pending transaction found for this reference.' };
      }

      const amount = Number(tx.amount);
      const result = await sequelize.transaction(async (t) => {
        const wallet = await Wallet.findOne({ where: { userId }, transaction: t });
        if (!wallet) {
          const w = await Wallet.create({ userId, balance: 0.0 }, { transaction: t });
          wallet = w;
        }
        const next = Number((Number(wallet.balance) + amount).toFixed(2));
        wallet.balance = next;
        await wallet.save({ transaction: t });

        tx.status = 'completed';
        tx.metadata = {
          ...tx.metadata,
          confirmedAt: new Date().toISOString(),
          confirmCode: confirmCode || null,
        };
        await tx.save({ transaction: t });

        return { wallet, amount };
      });

      return {
        success: true,
        message: `Wallet topped up via ${paymentMethod}`,
        wallet: result.wallet,
        amount: result.amount,
      };
    }

    default:
      return { success: false, error: 'Unsupported payment method.' };
  }
};

/**
 * Save or update user's bank/GCash account details.
 */
const savePaymentAccount = async ({ userId, bankAccountName, bankAccountNumber, bankName, gcashNumber, paymentPreference, paypalEmail }) => {
  const user = await User.findByPk(userId);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const updateData = {};
  if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName || null;
  if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber || null;
  if (bankName !== undefined) updateData.bankName = bankName || null;
  if (gcashNumber !== undefined) updateData.gcashNumber = gcashNumber || null;
  if (paymentPreference !== undefined) updateData.paymentPreference = paymentPreference || null;
  if (paypalEmail !== undefined) updateData.paypalEmail = paypalEmail || null;

  await user.update(updateData);

  // Sync bank fields to wallet if present
  const WalletModel = require('../models').Wallet;
  const wallet = await WalletModel.findOne({ where: { userId } });
  if (wallet && (bankAccountName !== undefined || bankAccountNumber !== undefined || bankName !== undefined)) {
    await wallet.update({
      bankAccountName: updateData.bankAccountName ?? wallet.bankAccountName,
      bankAccountNumber: updateData.bankAccountNumber ?? wallet.bankAccountNumber,
      bankName: updateData.bankName ?? wallet.bankName,
    });
  }

  return {
    success: true,
    message: 'Payment account details saved',
    account: {
      bankAccountName: user.bankAccountName,
      bankAccountNumber: user.bankAccountNumber,
      bankName: user.bankName,
      gcashNumber: user.gcashNumber,
      paymentPreference: user.paymentPreference,
      paypalEmail: user.paypalEmail,
    },
  };
};

/**
 * Get user's saved payment account details.
 */
const getPaymentAccount = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ['bankAccountName', 'bankAccountNumber', 'bankName', 'gcashNumber', 'paymentPreference', 'paypalEmail', 'paypalVerified'],
  });
  if (!user) {
    return { success: false, error: 'User not found' };
  }
  return {
    success: true,
    account: {
      bankAccountName: user.bankAccountName,
      bankAccountNumber: user.bankAccountNumber,
      bankName: user.bankName,
      gcashNumber: user.gcashNumber,
      paymentPreference: user.paymentPreference,
      paypalEmail: user.paypalEmail,
      paypalVerified: user.paypalVerified,
    },
  };
};

module.exports = {
  createPayment,
  capturePayment,
  savePaymentAccount,
  getPaymentAccount,
  parseAmount,
};
