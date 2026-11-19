import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getMyWallet,
  requestTopup,
  captureTopup,
  withdrawWallet,
} from '../controllers/walletController.cjs';

const router = express.Router();

router.get('/', protect, getMyWallet);

// Top-up is a two-step PayPal flow: create the order, then capture it to fund the wallet.
router.post('/topup', protect, requestTopup);
router.post('/topup/capture', protect, captureTopup);

router.post('/withdraw', protect, withdrawWallet);

export default router;