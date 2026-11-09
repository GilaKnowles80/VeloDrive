const { createPayment, capturePayment, savePaymentAccount, getPaymentAccount } = require('../services/paymentGatewayService');
const { protect } = require('../middleware/auth');

const createPaymentHandler = async (req, res) => {
  try {
    const { amount, paymentMethod, returnUrl, cancelUrl } = req.body;
    const result = await createPayment({
      userId: req.user.id,
      amount,
      paymentMethod,
      returnUrl,
      cancelUrl,
    });
    if (!result.success) {
      const status = result.requiresSetup ? 400 : 400;
      return res.status(status).json({ success: false, message: result.error, requiresSetup: result.requiresSetup });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const capturePaymentHandler = async (req, res) => {
  try {
    const { paymentMethod, referenceId, confirmCode } = req.body;
    const result = await capturePayment({
      userId: req.user.id,
      paymentMethod,
      referenceId,
      confirmCode,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const savePaymentAccountHandler = async (req, res) => {
  try {
    const { bankAccountName, bankAccountNumber, bankName, gcashNumber, paymentPreference } = req.body;
    const result = await savePaymentAccount({
      userId: req.user.id,
      bankAccountName,
      bankAccountNumber,
      bankName,
      gcashNumber,
      paymentPreference,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPaymentAccountHandler = async (req, res) => {
  try {
    const result = await getPaymentAccount(req.user.id);
    if (!result.success) {
      return res.status(404).json({ success: false, message: result.error });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPaymentHandler,
  capturePaymentHandler,
  savePaymentAccountHandler,
  getPaymentAccountHandler,
};
