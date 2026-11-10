const nodemailer = require('nodemailer');
const { withTimeout, retry, CircuitBreaker } = require('../utils/resilience');

const emailCircuit = new CircuitBreaker({ name: 'email', failureThreshold: 4, resetMs: 60000 });
const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 15000);

/**
 * Robust OTP email delivery:
 * 1) Resend HTTP API if RESEND_API_KEY is set (reliable on Vercel/serverless)
 * 2) SMTP via Nodemailer if EMAIL_USER/EMAIL_PASS are set
 * Always logs OTP in non-production for local/dev testing fallback.
 */
const buildOtpEmail = (otpCode) => ({
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
  `,
});

const sendViaResend = async (to, otpCode) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const from = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'VeloDrive <onboarding@resend.dev>';
  const { subject, text, html } = buildOtpEmail(otpCode);
  const resp = await withTimeout(fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  }), EMAIL_TIMEOUT_MS, 'resend');
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.message || data?.error?.message || `Resend API error ${resp.status}`);
  return { provider: 'resend', messageId: data.id };
};

const sendViaSmtp = async (to, otpCode) => {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, FROM_EMAIL } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS) return null;
  const port = Number(EMAIL_PORT || 587);
  const secure = port === 465 || String(process.env.EMAIL_SECURE).toLowerCase() === 'true';
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    connectionTimeout: Math.min(EMAIL_TIMEOUT_MS, 15000),
    greetingTimeout: 10000,
    socketTimeout: EMAIL_TIMEOUT_MS,
  });
  const { subject, text, html } = buildOtpEmail(otpCode);
  const info = await withTimeout(transporter.sendMail({
    from: `"VeloDrive" <${FROM_EMAIL || EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  }), EMAIL_TIMEOUT_MS, 'smtp');
  return { provider: 'smtp', messageId: info.messageId };
};

const sendOTPEmail = async (email, otpCode) => {
  try {
    const result = await emailCircuit.exec(() => retry(async () => {
      let r = null;
      // 1) Try Resend first
      if (process.env.RESEND_API_KEY) {
        try {
          r = await sendViaResend(email, otpCode);
        } catch (e) {
          // Resend failed (e.g., onboarding@resend.dev can't send to unverified emails)
          // Fall through to SMTP below
          console.warn(JSON.stringify({ level: 'warn', msg: 'resend_failed_fallback_to_smtp', error: e.message }));
        }
      }
      // 2) Try SMTP fallback if Resend didn't succeed
      if (!r) r = await sendViaSmtp(email, otpCode);
      if (!r) {
        const e = new Error('No email provider configured. Set RESEND_API_KEY (recommended) or EMAIL_USER/EMAIL_PASS.');
        e.noRetry = true;
        throw e;
      }
      return r;
    }, {
      retries: 2,
      baseDelayMs: 400,
      shouldRetry: (err) => !err?.noRetry && err?.code !== 'EAUTH',
      onRetry: (err, attempt) => console.warn(JSON.stringify({ level: 'warn', msg: 'otp_email_retry', attempt, error: err.message })),
    }));
    if (process.env.NODE_ENV !== 'production') console.log(JSON.stringify({ level: 'info', msg: 'otp_email_sent', to: email, provider: result.provider, messageId: result.messageId }));
    return { success: true, ...result };
  } catch (error) {
    const detail = error?.response ? JSON.stringify(error.response) : error.message;
    console.error(JSON.stringify({ level: 'error', msg: 'otp_email_error', error: detail, circuit: emailCircuit.snapshot() }));
    if (process.env.NODE_ENV !== 'production') console.warn('[otp][dev-fallback] code for', email, 'is', otpCode);
    return { success: false, error: error.message || 'Failed to send OTP email', detail };
  }
};

const buildResetPasswordEmail = (resetUrl) => ({
  subject: 'VeloDrive - Reset Your Password',
  text: `You requested a password reset. Click here to reset your password: ${resetUrl}. This link expires in 1 hour.`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2563eb;">VeloDrive Password Reset</h2>
      <p>You requested a password reset for your VeloDrive account.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
    </div>
  `,
});

const sendResetPasswordEmail = async (email, resetUrl) => {
  try {
    const result = await emailCircuit.exec(() => retry(async () => {
      let r = null;
      if (process.env.RESEND_API_KEY) {
        try {
          const apiKey = process.env.RESEND_API_KEY;
          const from = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'VeloDrive <onboarding@resend.dev>';
          const { subject, text, html } = buildResetPasswordEmail(resetUrl);
          const resp = await withTimeout(fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: [email], subject, text, html }),
          }), EMAIL_TIMEOUT_MS, 'resend');
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(data?.message || data?.error?.message || `Resend API error ${resp.status}`);
          r = { provider: 'resend', messageId: data.id };
        } catch (e) {
          console.warn(JSON.stringify({ level: 'warn', msg: 'resend_failed_fallback_to_smtp', error: e.message }));
        }
      }
      if (!r) {
        const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, FROM_EMAIL } = process.env;
        if (!EMAIL_USER || !EMAIL_PASS) {
          const e = new Error('No email provider configured.');
          e.noRetry = true;
          throw e;
        }
        const port = Number(EMAIL_PORT || 587);
        const secure = port === 465 || String(process.env.EMAIL_SECURE).toLowerCase() === 'true';
        const transporter = nodemailer.createTransport({
          host: EMAIL_HOST || 'smtp.gmail.com',
          port,
          secure,
          auth: { user: EMAIL_USER, pass: EMAIL_PASS },
          connectionTimeout: Math.min(EMAIL_TIMEOUT_MS, 15000),
          greetingTimeout: 10000,
          socketTimeout: EMAIL_TIMEOUT_MS,
        });
        const { subject, text, html } = buildResetPasswordEmail(resetUrl);
        const info = await withTimeout(transporter.sendMail({
          from: `"VeloDrive" <${FROM_EMAIL || EMAIL_USER}>`,
          to: email,
          subject,
          text,
          html,
        }), EMAIL_TIMEOUT_MS, 'smtp');
        r = { provider: 'smtp', messageId: info.messageId };
      }
      if (!r) {
        const e = new Error('No email provider configured. Set RESEND_API_KEY (recommended) or EMAIL_USER/EMAIL_PASS.');
        e.noRetry = true;
        throw e;
      }
      return r;
    }, {
      retries: 2,
      baseDelayMs: 400,
      shouldRetry: (err) => !err?.noRetry && err?.code !== 'EAUTH',
      onRetry: (err, attempt) => console.warn(JSON.stringify({ level: 'warn', msg: 'reset_email_retry', attempt, error: err.message })),
    }));
    if (process.env.NODE_ENV !== 'production') console.log(JSON.stringify({ level: 'info', msg: 'reset_email_sent', to: email, provider: result.provider, messageId: result.messageId }));
    return { success: true, ...result };
  } catch (error) {
    const detail = error?.response ? JSON.stringify(error.response) : error.message;
    console.error(JSON.stringify({ level: 'error', msg: 'reset_email_error', error: detail, circuit: emailCircuit.snapshot() }));
    if (process.env.NODE_ENV !== 'production') console.warn('[reset][dev-fallback] reset link for', email, 'is', resetUrl);
    return { success: false, error: error.message || 'Failed to send reset email', detail };
  }
};

module.exports = { sendOTPEmail, sendResetPasswordEmail };
