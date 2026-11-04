const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { updateProfile, uploadDocument, exportMyData, eraseMyData, withdrawMyConsent } = require('../controllers/userController');
const { upload } = require('../middleware/upload');

router.put('/profile', protect, updateProfile);
router.post('/document', protect, upload.single('file'), uploadDocument);
router.get('/gdpr/export', protect, exportMyData);
router.delete('/gdpr/erase', protect, eraseMyData);
router.post('/gdpr/withdraw-consent', protect, withdrawMyConsent);

module.exports = router;