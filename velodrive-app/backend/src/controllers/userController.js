const { User, Document } = require('../models');
const { getOrCreateWallet } = require('../services/paymentService');
const { exportUserData, eraseUserData, withdrawConsent } = require('../services/gdprService');

const DOCUMENT_TYPES = [
  'certificate_of_registration', 'proof_of_ownership', 'original_certificate',
  'nbi_clearance', 'tax_certificate', 'valid_id', 'drivers_license',
  'ad_campaign_image', 'ad_campaign_video', 'profile_image', 'other',
];

const PROFILE_FIELDS = [
  'firstName', 'lastName', 'phone', 'address',
  'bankAccountName', 'bankAccountNumber', 'bankName', 'paypalEmail',
];

const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const updates = {};
    PROFILE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined && String(req.body[field]).trim() !== '') {
        updates[field] = String(req.body[field]).trim();
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No profile fields supplied' });
    }

    await user.update(updates);

    const wallet = await getOrCreateWallet(req.user.id);
    const bankUpdate = {};
    ['bankAccountName', 'bankAccountNumber', 'bankName']
      .filter((field) => updates[field])
      .forEach((field) => { bankUpdate[field] = updates[field]; });
    if (Object.keys(bankUpdate).length) await wallet.update(bankUpdate);

    const userResponse = user.toJSON();
    delete userResponse.password;
    delete userResponse.otpCode;

    res.json({
      success: true,
      message: 'Profile updated',
      user: userResponse,
      // Email is the account identifier and is intentionally not editable here.
      emailChangeSupported: false,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const type = String(req.body.type || 'other');
    if (!DOCUMENT_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported document type. Allowed: ${DOCUMENT_TYPES.join(', ')}`,
      });
    }

    const { Vehicle } = require('../models');
    let vehicleId = null;
    if (req.body.vehicleId) {
      const vehicle = await Vehicle.findByPk(req.body.vehicleId);
      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      if (vehicle.ownerId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized for this vehicle' });
      }
      vehicleId = vehicle.id;
    }

    const document = await Document.create({
      userId: req.user.id,
      vehicleId,
      type,
      fileName: req.file.originalname || req.file.filename,
      filePath: req.file.path || req.file.location,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json({ success: true, message: 'Document uploaded', document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const exportMyData = async (req, res) => {
  try {
    const data = await exportUserData(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const eraseMyData = async (req, res) => {
  try {
    const result = await eraseUserData(req.user.id);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const withdrawMyConsent = async (req, res) => {
  try {
    const { consentType } = req.body;
    if (!consentType) {
      return res.status(400).json({ success: false, message: 'consentType is required' });
    }
    await withdrawConsent(req.user.id, consentType);
    res.json({ success: true, message: 'Consent withdrawn' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { updateProfile, uploadDocument, exportMyData, eraseMyData, withdrawMyConsent };
