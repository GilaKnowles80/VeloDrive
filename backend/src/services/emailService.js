import nodemailer from 'nodemailer';
import { withTimeout, retry, CircuitBreaker } from '../utils/resilience.js';

const emailCircuit = new CircuitBreaker({ name: 'email', failureThreshold: 8, resetMs: 120000 });
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
  const from = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply.velodrive@gctravelandtour.com';
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
  const info = await withTimeout(transporter.sendMail({ from: FROM_EMAIL || EMAIL_USER, to, subject, text, html }), EMAIL_TIMEOUT_MS, 'smtp');
  return { provider: 'smtp', messageId: info.messageId };     
}
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







