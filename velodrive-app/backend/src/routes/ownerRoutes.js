const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { processOwnerMembership } = require('../services/paypalService');

/**
 * Create PayPal order for owner yearly membership
 * POST /api/owners/membership
 */
router.post('/membership', protect, authorize('owner'), async (req, res) => {
  try {
    const { amount = 1000, currency = 'PHP' } = req.body;

    const result = await processOwnerMembership({
      ownerId: req.user.id,
      amount,
      currency
    });

    res.json({
      success: true,
      message: 'Membership payment order created',
      orderId: result.orderId,
      approvalUrl: result.approvalUrl,
      amount: result.amount,
      currency: result.currency
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;