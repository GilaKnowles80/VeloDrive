const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMyWallet, topupWallet, withdrawWallet } = require('../controllers/walletController');

router.get('/', protect, getMyWallet);
router.post('/topup', protect, topupWallet);
router.post('/withdraw', protect, withdrawWallet);

module.exports = router;