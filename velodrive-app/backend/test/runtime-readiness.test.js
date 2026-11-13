'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertPayPalRuntimeAllowed,
  getEnvironmentReadiness,
} = require('../src/config/runtimeReadiness');

test('allows sandbox PayPal requests in development', () => {
  assert.doesNotThrow(() =>
    assertPayPalRuntimeAllowed({ NODE_ENV: 'development', PAYPAL_MODE: 'sandbox' })
  );
});

test('blocks live PayPal requests outside production', () => {
  assert.throws(
    () => assertPayPalRuntimeAllowed({ NODE_ENV: 'development', PAYPAL_MODE: 'live' }),
    /disabled outside the production deployment/
  );
});

test('preview deployments do not qualify for live PayPal requests', () => {
  assert.throws(
    () => assertPayPalRuntimeAllowed({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      PAYPAL_MODE: 'live',
    }),
    /disabled outside the production deployment/
  );
});

test('production readiness requires approved live PayPal configuration', () => {
  const result = getEnvironmentReadiness({
    NODE_ENV: 'production',
    JWT_SECRET: 'configured',
    DATABASE_URL: 'configured',
    FRONTEND_URL: 'https://frontend.example',
    RESEND_API_KEY: 'configured',
    FROM_EMAIL: 'VeloDrive <noreply@example.com>',
    PAYPAL_CLIENT_ID: 'configured',
    PAYPAL_SECRET_KEY: 'configured',
    PAYPAL_WEBHOOK_ID: 'configured',
    PAYPAL_ADMIN_EMAIL: 'admin@example.com',
    PAYPAL_MODE: 'live',
    PAYPAL_PLATFORM_FEES_ENABLED: 'false',
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    'PAYPAL_PLATFORM_FEES_ENABLED=true (only after PayPal approval)',
  ]);
});

test('production readiness rejects OTP bypass', () => {
  const result = getEnvironmentReadiness({
    NODE_ENV: 'production',
    OTP_BYPASS: 'true',
  });

  assert.equal(result.ok, false);
  assert.ok(result.missing.includes('OTP_BYPASS=false in production'));
});

test('sandbox preview does not require live marketplace approval', () => {
  const result = getEnvironmentReadiness({
    NODE_ENV: 'production',
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    JWT_SECRET: 'configured',
    DATABASE_URL: 'configured',
    FRONTEND_URL: 'https://preview.example',
    RESEND_API_KEY: 'configured',
    FROM_EMAIL: 'VeloDrive <noreply@example.com>',
    PAYPAL_MODE: 'sandbox',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
});
