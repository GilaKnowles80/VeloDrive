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
    const { amount = 4999, currency = 'PHP', billingCycle = 'yearly' } = req.body;

    const result = await processOwnerMembership({
      ownerId: req.user.id,
      amount,
      currency,
      billingCycle
    });

    res.json({
      success: true,
      message: 'Membership payment order created',
      orderId: result.orderId,
      approvalUrl: result.approvalUrl,
      amount: result.amount,
      currency: result.currency,
      billingCycle: result.billingCycle
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;