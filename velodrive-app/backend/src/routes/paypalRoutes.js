const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { capturePayPalOrder, getPayPalOrder } = require('../controllers/paypalController');

/**
 * Capture a PayPal order after buyer approval.
 * This is the step that turns an approved checkout into held escrow funds.
 * POST /api/paypal/capture  { bookingId, orderId? }
 */
router.post('/capture', protect, authorize('renter', 'admin'), capturePayPalOrder);

/**
 * Read an order's status from PayPal.
 * GET /api/paypal/order/:orderId
 */
router.get('/order/:orderId', protect, getPayPalOrder);

module.exports = router;
