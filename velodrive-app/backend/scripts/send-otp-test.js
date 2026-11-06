/**
 * OTP email trigger (diagnostic) — sends the same OTP email used at registration.
 * Does NOT modify application code or create users; reads EMAIL_* from .env.
 *
 * Usage (from velodrive-app/backend):
 *   node scripts/send-otp-test.js <email> [otp]
 * Example:
 *   node scripts/send-otp-test.js you@example.com 123456
 *
 * If [otp] is omitted, a random 6-digit code is generated (same format as registration).
 */
require('dotenv').config();
const { sendOTPEmail } = require('../src/services/emailService');

(async () => {
  const email = process.argv[2];
  const otp = (process.argv[3] || String(Math.floor(100000 + Math.random() * 900000))).trim();
  if (!email) {
    console.error('Usage: node scripts/send-otp-test.js <email> [otp]');
    process.exit(1);
  }
  console.log('OTP trigger: sending verification code', { to: email, otpLength: otp.length });
  const result = await sendOTPEmail(email, otp);
  if (result && result.success) {
    console.log('OTP email sent', { messageId: result.messageId });
    process.exit(0);
  }
  console.error('OTP email failed', result);
  process.exit(2);
})();
