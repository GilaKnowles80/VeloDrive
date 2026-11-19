const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMyWallet, requestTopup, captureTopup, withdrawWallet } = require('../controllers/walletController');

router.get('/', protect, getMyWallet);

// Top-up is a two-step PayPal flow: create the order, then capture it to fund the wallet.
router.post('/topup', protect, requestTopup);
router.post('/topup/capture', protect, captureTopup);

router.post('/withdraw', protect, withdrawWallet);

module.exports = router;
