'use strict';

const isProductionDeployment = (env) =>
  env.VERCEL_ENV
    ? env.VERCEL_ENV === 'production'
    : env.NODE_ENV === 'production';

const assertPayPalRuntimeAllowed = (env = process.env) => {
  if (env.PAYPAL_MODE === 'live' && !isProductionDeployment(env)) {
    throw new Error('Live PayPal requests are disabled outside the production deployment');
  }
};

const getEnvironmentReadiness = (env = process.env) => {
  const missing = [];
  const isDeployment = env.NODE_ENV === 'production' || Boolean(env.VERCEL);
  const isProduction = isProductionDeployment(env);
  const hasEmailProvider = Boolean(
    env.RESEND_API_KEY || (env.EMAIL_USER && env.EMAIL_PASS)
  );

  if (!env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!env.NEON_POSTGRES_URL && !env.DATABASE_URL) {
    missing.push('DATABASE_URL or NEON_POSTGRES_URL');
  }

  if (isDeployment) {
    if (!env.FRONTEND_URL) missing.push('FRONTEND_URL');
    if (!hasEmailProvider) missing.push('RESEND_API_KEY or EMAIL_USER/EMAIL_PASS');
    if (env.RESEND_API_KEY && !(env.FROM_EMAIL || env.EMAIL_FROM)) {
      missing.push('FROM_EMAIL or EMAIL_FROM');
    }
  }

  if (isProduction) {
    if (env.OTP_BYPASS === 'true') missing.push('OTP_BYPASS=false in production');
    for (const name of [
      'PAYPAL_CLIENT_ID',
      'PAYPAL_SECRET_KEY',
      'PAYPAL_WEBHOOK_ID',
      'PAYPAL_ADMIN_EMAIL',
    ]) {
      if (!env[name]) missing.push(name);
    }
    if (env.PAYPAL_MODE !== 'live') missing.push('PAYPAL_MODE=live');
    if (env.PAYPAL_PLATFORM_FEES_ENABLED !== 'true') {
      missing.push('PAYPAL_PLATFORM_FEES_ENABLED=true (only after PayPal approval)');
    }
  }

  return { ok: missing.length === 0, missing };
};

module.exports = { assertPayPalRuntimeAllowed, getEnvironmentReadiness };
