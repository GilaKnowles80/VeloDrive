const { Wallet, Transaction } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Wallet ledger primitives.
 * A single place that mutates Wallet.balance, so every movement is accompanied
 * by exactly one Transaction row inside the same DB transaction.
 */

const toAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Invalid amount');
  return Math.abs(Number(amount.toFixed(2)));
};

const buildReference = () =>
  `TXN-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const getOrCreateWallet = async (userId, transaction = null) => {
  let wallet = await Wallet.findOne({ where: { userId }, transaction });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0.0 }, { transaction });
  }
  return wallet;
};

/**
 * Apply a signed delta to a wallet balance.
 * Pass `transaction` to join a caller's DB transaction (prevents partial writes).
 */
const applyDelta = async ({
  userId,
  delta,
  type,
  description,
  bookingId = null,
  metadata = {},
  reference = null,
  transaction = null,
}) => {
  const run = async (tx) => {
    const wallet = await getOrCreateWallet(userId, tx);

    const next = Number((Number(wallet.balance) + delta).toFixed(2));
    if (next < 0) throw new Error('Insufficient wallet balance');

    wallet.balance = next;
    await wallet.save({ transaction: tx });

    const record = await Transaction.create(
      {
        reference: reference || buildReference(),
        type,
        userId,
        bookingId,
        amount: Math.abs(delta),
        status: 'completed',
        description,
        metadata,
      },
      { transaction: tx }
    );

    return { success: true, wallet, transaction: record };
  };

  if (transaction) return run(transaction);

  const own = await sequelize.transaction();
  try {
    const result = await run(own);
    await own.commit();
    return result;
  } catch (error) {
    await own.rollback();
    throw error;
  }
};

const creditWallet = (userId, amount, type, description, options = {}) =>
  applyDelta({
    userId,
    delta: toAmount(amount),
    type,
    description,
    ...options,
  });

const debitWallet = (userId, amount, type, description, options = {}) =>
  applyDelta({
    userId,
    delta: -toAmount(amount),
    type,
    description,
    ...options,
  });

module.exports = { creditWallet, debitWallet, getOrCreateWallet, applyDelta };
