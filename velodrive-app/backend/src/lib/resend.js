const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOTPEmailResend(email, otpCode) {
  try {
    const from = process.env.FROM_EMAIL || 'noreply.velodrive@gctravelandtour.com';
    const data = await resend.emails.send({
      from,
      to: [email],
      subject: 'Your VeloDrive Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Welcome to VeloDrive!</h2>
          <p>Please use the 6-digit verification code below to complete your login/signup:</p>
          <h1 style="color: #2563eb; letter-spacing: 4px;">${otpCode}</h1>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send OTP email:', error?.message || error);
    return { success: false, error };
  }
}

module.exports = { resend, sendOTPEmailResend };
