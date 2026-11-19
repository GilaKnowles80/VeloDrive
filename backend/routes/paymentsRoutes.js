const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  savePaymentAccountHandler,
  getPaymentAccountHandler,
} = require('../controllers/paymentsController');

const retiredWalletPayment = (_req, res) => res.status(410).json({
  success: false,
  message: 'This payment flow is no longer available. Use the PayPal wallet top-up flow.',
});

router.post('/create', protect, retiredWalletPayment);
router.post('/capture', protect, retiredWalletPayment);

// User payment account (bank / GCash / PayPal preference)
router.post('/account', protect, savePaymentAccountHandler);
router.get('/account', protect, getPaymentAccountHandler);

module.exports = router;
