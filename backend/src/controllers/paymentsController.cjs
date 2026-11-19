import {
  createPayment,
  capturePayment,
  savePaymentAccount,
  getPaymentAccount,
} from '../services/paymentGatewayService.js';

export const createPaymentHandler = async (req, res) => {
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

export const capturePaymentHandler = async (req, res) => {
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

export const savePaymentAccountHandler = async (req, res) => {
  try {
    const { bankAccountName, bankAccountNumber, bankName, gcashNumber, paymentPreference, paypalEmail } = req.body;
    const result = await savePaymentAccount({
      userId: req.user.id,
      bankAccountName,
      bankAccountNumber,
      bankName,
      gcashNumber,
      paymentPreference,
      paypalEmail,
    });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPaymentAccountHandler = async (req, res) => {
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

export default {
  createPaymentHandler,
  capturePaymentHandler,
  savePaymentAccountHandler,