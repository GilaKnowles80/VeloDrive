# VeloDrive OTP Email Setup (prevents “didn’t receive OTP” complaints)

The registration OTP trigger is: `POST /api/auth/register` → `authController.register` → `sendOTPEmail` (`backend/src/services/emailService.js`). Delivery uses **Resend (recommended)** or **SMTP (Nodemailer)**. The app now returns `emailSent` status and provides **“Resend code”** (`POST /api/auth/resend-otp`) in the UI.

## Recommended for Vercel/production: Resend
1. Create an API key at Resend and verify your sending domain (or use `onboarding@resend.dev` for testing if allowed).
2. Set env vars on **Vercel backend project `velo-drive-lj7t`** (and local `backend/.env`, gitignored):
   - `RESEND_API_KEY=re_...`
   - `FROM_EMAIL=VeloDrive <noreply@your-verified-domain.com>`
3. Redeploy backend: `cd velodrive-app/backend && vercel --prod --yes`

## Gmail SMTP fallback (local/dev or if you must)
Gmail rejects normal account passwords (`535 5.7.8 BadCredentials`). You **must** use a **Gmail App Password** (Google Account → Security → 2‑Step Verification → App passwords).
- `EMAIL_HOST=smtp.gmail.com`
- `EMAIL_PORT=587`
- `EMAIL_USER=your@gmail.com`
- `EMAIL_PASS=<16-char App Password>`
- `FROM_EMAIL=your@gmail.com`

## Test the trigger
From `velodrive-app/backend`:
```bash
node scripts/send-otp-test.js your-valid@email.com 123456
```
Expect `OTP email sent { provider, messageId }`. In non-production, failed sends log `[otp][dev-fallback]` so local testing isn’t blocked.

## User-facing behavior (implemented)
- Register reports whether the verification email was actually sent (`emailSent`).
- Verify step has **Resend code**.
- API: `POST /api/auth/resend-otp` with `{ "email": "..." }`.

## Security
Never commit `.env` or API keys. Keep **one Neon `DATABASE_URL`** only on `velo-drive-lj7t`. Rotate any exposed SMTP/App/Resend secrets.
