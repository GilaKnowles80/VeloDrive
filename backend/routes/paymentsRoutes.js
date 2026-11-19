import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  savePaymentAccountHandler,
  getPaymentAccountHandler,
} from '../controllers/paymentsController.cjs';

const router = express.Router();

const retiredWalletPayment = (_req, res) => res.status(410).json({
  success: false,
  message: 'This payment flow is no longer available. Use the PayPal wallet top-up flow.',
});

router.post('/create', protect, retiredWalletPayment);
router.post('/capture', protect, retiredWalletPayment);

// User payment account (bank / GCash / PayPal preference)
router.post('/account', protect, savePaymentAccountHandler);
router.get('/account', protect, getPaymentAccountHandler);

export default router;