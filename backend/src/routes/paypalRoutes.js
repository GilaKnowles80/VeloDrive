const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { capturePayPalOrder, getPayPalOrder } = require('../controllers/paypalController');
const { generatePartnerOnboardingLink, getPartnerReferral } = require('../services/paypalOnboardingService');
const { User } = require('../models');

/**
 * Generate a PayPal Partner Referral onboarding link for a Vehicle Owner.
 * The owner completes PayPal onboarding via the returned action_url.
 * POST /api/paypal/connect  { businessName }
 */
router.post(
  '/connect',
  protect,
  authorize('owner'),
  async (req, res) => {
    try {
      const { businessName } = req.body;
      const ownerEmail = req.user.email;

      if (!businessName) {
        return res
          .status(400)
          .json({ success: false, message: 'businessName is required' });
      }

      const { onboardingUrl, trackingId } = await generatePartnerOnboardingLink({
        ownerEmail,
        businessName,
      });

      // Store the tracking ID so we can look up the merchant ID after
      // the owner completes PayPal onboarding.
      await User.update(
        { paypalTrackingId: trackingId },
        { where: { id: req.user.id } }
      );

      return res.json({
        success: true,
        onboardingUrl,
        trackingId,
        message: 'Complete PayPal onboarding via the onboardingUrl above.',
      });
    } catch (error) {
      console.error('PayPal onboarding connect error:', error.message);
      return res
        .status(502)
        .json({ success: false, message: 'Failed to generate PayPal onboarding link' });
    }
  }
);

/**
 * Complete PayPal onboarding: lookup the referral by tracking ID and save the
 * merchant ID to the owner's profile.
 * POST /api/paypal/onboarding-complete  { trackingId }
 */
router.post(
  '/onboarding-complete',
  protect,
  authorize('owner'),
  async (req, res) => {
    try {
      const { trackingId } = req.body;

      if (!trackingId) {
        return res
          .status(400)
          .json({ success: false, message: 'trackingId is required' });
      }

      const { partnerCustomerId, status } = await getPartnerReferral(trackingId);

      const updateData = { paypalTrackingId: trackingId };
      if (partnerCustomerId) {
        updateData.paypalMerchantId = partnerCustomerId;
        updateData.paypalVerified = true;
      }

      await User.update(updateData, { where: { id: req.user.id } });

      return res.json({
        success: true,
        partnerCustomerId,
        status,
        message: partnerCustomerId
          ? 'PayPal merchant ID saved to your profile.'
          : 'Referral found but merchant ID not yet available. Owner may still be completing onboarding.',
      });
    } catch (error) {
      console.error('PayPal onboarding complete error:', error.message);
      return res
        .status(502)
        .json({ success: false, message: 'Failed to complete PayPal onboarding lookup' });
    }
  }
);

/**
 * Create a PayPal order for a vehicle rental with escrow commission split.
 * POST /api/paypal/create-order  { vehicleId, amount }
 */
router.post(
  '/create-order',
  protect,
  authorize('renter', 'owner', 'admin'),
  async (req, res) => {
    try {
      const { vehicleId, amount } = req.body;

      if (!vehicleId || !amount) {
        return res.status(400).json({ success: false, message: 'vehicleId and amount are required' });
      }

      // 10% platform service fee commission, 90% owner payout split
      const parsedAmount = Number(amount);
      const platformFee = parsedAmount * 0.10;
      const ownerPayout = parsedAmount * 0.90;

      // Create real PayPal order via SDK
      const request = new paypal.orders.OrdersCreateRequest();
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: `booking_${vehicleId}`,
            amount: {
              currency_code: 'PHP',
              value: parsedAmount.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: 'PHP',
                  value: parsedAmount.toFixed(2),
                },
              },
            },
            items: [
              {
                name: `Vehicle Booking ${vehicleId}`,
                unit_amount: {
                  currency_code: 'PHP',
                  value: parsedAmount.toFixed(2),
                },
                quantity: 1,
              },
            ],
          },
        ],
      });

      const response = await execPayPal(request);
      const approvalUrl = response.result.links?.find((l) => l.rel === 'approval_url')?.href;

      if (!approvalUrl) {
        throw new Error('PayPal order creation failed: no approval URL');
      }

      return res.json({
        success: true,
        approvalUrl,
        breakdown: {
          total: parsedAmount,
          platformFee: platformFee.toFixed(2),
          ownerPayout: ownerPayout.toFixed(2),
        },
      });
    } catch (error) {
      console.error('Create PayPal order error:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to create PayPal order' });
    }
  }
);

/**
 * Capture a PayPal order after buyer approval.
 * This is the step that turns an approved checkout into held escrow funds.
 * POST /api/paypal/capture  { bookingId, orderId? }
 */
router.post('/capture', protect, authorize('renter', 'owner', 'admin'), capturePayPalOrder);

/**
 * Read an order's status from PayPal.
 * GET /api/paypal/order/:orderId
 */
router.get('/order/:orderId', protect, getPayPalOrder);

module.exports = router;
