const nodemailer = require('nodemailer');

const requireEmailConfig = () => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, FROM_EMAIL } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Email is not configured: set EMAIL_USER and EMAIL_PASS in environment variables.');
  }
  return {
    host: EMAIL_HOST || 'smtp.gmail.com',
    port: Number(EMAIL_PORT || 587),
    secure: false,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    from: FROM_EMAIL || EMAIL_USER,
  };
};

const sendOTPEmail = async (email, otpCode) => {
  try {
    const cfg = requireEmailConfig();
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.auth,
    });
    const info = await transporter.sendMail({
      from: `"VeloDrive" <${cfg.from}>`,
      to: email,
      subject: 'VeloDrive - Email Verification OTP',
      text: `Your OTP verification code is: ${otpCode}. This code expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2563eb;">VeloDrive Email Verification</h2>
          <p>Your OTP verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            ${otpCode}
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      `
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendOTPEmail };