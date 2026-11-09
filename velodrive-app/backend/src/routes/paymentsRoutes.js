const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createPaymentHandler,
  capturePaymentHandler,
  savePaymentAccountHandler,
  getPaymentAccountHandler,
} = require('../controllers/paymentsController');

// Unified payment gateway
router.post('/create', protect, createPaymentHandler);
router.post('/capture', protect, capturePaymentHandler);

// User payment account (bank / GCash / PayPal preference)
router.post('/account', protect, savePaymentAccountHandler);
router.get('/account', protect, getPaymentAccountHandler);

module.exports = router;
