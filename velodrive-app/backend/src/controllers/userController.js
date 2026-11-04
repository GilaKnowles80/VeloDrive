const { User, Wallet, Document } = require('../models');
const { exportUserData, eraseUserData, withdrawConsent } = require('../services/gdprService');

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, address, bankAccountName, bankAccountNumber, bankName } = req.body;

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      phone: phone || user.phone,
      address: address || user.address,
      bankAccountName: bankAccountName || user.bankAccountName,
      bankAccountNumber: bankAccountNumber || user.bankAccountNumber,
      bankName: bankName || user.bankName
    });

    // Update wallet bank details if provided
    if (bankAccountName || bankAccountNumber || bankName) {
      let wallet = await Wallet.findOne({ where: { userId: req.user.id } });
      if (!wallet) {
        wallet = await Wallet.create({ userId: req.user.id, balance: 0.00 });
      }
      await wallet.update({
        bankAccountName: bankAccountName || wallet.bankAccountName,
        bankAccountNumber: bankAccountNumber || wallet.bankAccountNumber,
        bankName: bankName || wallet.bankName
      });
    }

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.json({ success: true, message: 'Profile updated', user: userResponse });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { type } = req.body;
    const document = await Document.create({
      userId: req.user.id,
      type: type || 'other',
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    res.json({ success: true, message: 'Document uploaded', document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GDPR - Export user data
const exportMyData = async (req, res) => {
  try {
    const data = await exportUserData(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GDPR - Erase user data
const eraseMyData = async (req, res) => {
  try {
    await eraseUserData(req.user.id);
    res.json({ success: true, message: 'Your data has been erased per GDPR right to erasure' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GDPR - Withdraw consent
const withdrawMyConsent = async (req, res) => {
  try {
    const { consentType } = req.body;
    await withdrawConsent(req.user.id, consentType);
    res.json({ success: true, message: 'Consent withdrawn' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { updateProfile, uploadDocument, exportMyData, eraseMyData, withdrawMyConsent };