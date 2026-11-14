# VeloDrive OTP Email Setup (Prevents “Didn’t Receive OTP” Complaints)

The registration OTP trigger is: `POST /api/auth/register` → `authController.register` → `sendOTPEmail` (`backend/src/services/emailService.js`). Delivery uses **Resend (recommended)** or **SMTP (Nodemailer)**. The application returns an `emailSent` status and provides a **“Resend code”** (`POST /api/auth/resend-otp`) directly in the UI.

---

## 1. Recommended for Vercel / Production: Resend
1. Create an API key at [Resend](https://resend.com/) and verify your sending domain (or use `onboarding@resend.dev` for testing).
2. Set environment variables on your Vercel backend project (**`velodrive-backend`**) and your local `backend/.env` (gitignored):
   - `RESEND_API_KEY=re_...`
   - `FROM_EMAIL=<noreply@your-verified-domain.com>`
3. Redeploy your backend:
   ```bash
   cd velodrive-app/backend
   vercel --prod --yes