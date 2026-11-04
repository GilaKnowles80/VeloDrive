const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { capturePayPalOrder, getPayPalOrder } = require('../controllers/paypalController');

/**
 * Capture a PayPal order after buyer approval
 * POST /api/paypal/capture
 */
router.post('/capture', protect, authorize('renter'), capturePayPalOrder);

/**
 * Get PayPal order details
 * GET /api/paypal/order/:orderId
 */
router.get('/order/:orderId', protect, getPayPalOrder);

module.exports = router;