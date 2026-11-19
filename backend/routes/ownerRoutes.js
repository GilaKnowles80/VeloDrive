import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { processOwnerMembership } from '../services/paypalService.js';

const router = express.Router();

/**
 * Create PayPal order for owner yearly membership
 * POST /api/owners/membership
 */
router.post('/membership', protect, authorize('owner'), async (req, res) => {
  try {
    const { billingCycle = 'yearly' } = req.body;

    const result = await processOwnerMembership({
      ownerId: req.user.id,
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

export default router;