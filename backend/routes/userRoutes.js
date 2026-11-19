import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  updateProfile,
  uploadDocument,
  exportMyData,
  eraseMyData,
  withdrawMyConsent,
} from '../controllers/userController.cjs';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.put('/profile', protect, updateProfile);
router.post('/document', protect, upload.single('file'), uploadDocument);
router.get('/gdpr/export', protect, exportMyData);
router.delete('/gdpr/erase', protect, eraseMyData);
router.post('/gdpr/withdraw-consent', protect, withdrawMyConsent);

export default router;