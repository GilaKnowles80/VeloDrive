const { Wallet, Transaction, User } = require('../models');
const { creditWallet, debitWallet } = require('../services/paymentService');

const getMyWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user.id, balance: 0.00 });
    }

    const transactions = await Transaction.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({ success: true, wallet, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const topupWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const result = await creditWallet(
      req.user.id,
      amount,
      'wallet_topup',
      'Wallet top-up'
    );

    res.json({ success: true, message: 'Wallet topped up', wallet: result.wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const withdrawWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user.bankAccountName || !user.bankAccountNumber || !user.bankName) {
      return res.status(400).json({ success: false, message: 'Bank account details not set. Please update your profile.' });
    }

    const result = await debitWallet(
      req.user.id,
      amount,
      'wallet_withdrawal',
      'Wallet withdrawal to bank account'
    );

    res.json({ success: true, message: 'Withdrawal processed', wallet: result.wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyWallet, topupWallet, withdrawWallet };