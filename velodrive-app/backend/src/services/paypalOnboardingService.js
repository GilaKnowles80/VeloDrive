'use strict';

const PAYPAL_TIMEOUT_MS = Number(process.env.PAYPAL_TIMEOUT_MS || 20000);

const paypalApiBase = () =>
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const getPayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;
  if (!clientId || !secret) {
    throw new Error('PayPal client credentials are not configured');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const signal = AbortSignal.timeout(PAYPAL_TIMEOUT_MS);
  const response = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`PayPal OAuth failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('PayPal OAuth response did not include an access token');
  }
  return data.access_token;
};

/**
 * Generate a PayPal Partner Referral onboarding link for a Vehicle Owner.
 *
 * Creates a partner referral that, when completed by the owner, links their
 * PayPal business account to VeloDrive as the marketplace partner. The owner
 * is redirected back to `return_url` after onboarding.
 *
 * @param {object} params
 * @param {string} params.ownerEmail - Owner's PayPal business email
 * @param {string} params.businessName - Owner's legal business name
 * @returns {Promise<{ onboardingUrl: string, trackingId: string }>}
 */
const generatePartnerOnboardingLink = async ({ ownerEmail, businessName }) => {
  if (!ownerEmail || !businessName) {
    throw new Error('ownerEmail and businessName are required');
  }

  const accessToken = await getPayPalAccessToken();
  const trackingId = `owner_${Date.now()}`;
  const returnUrl = `${process.env.FRONTEND_URL || ''}/dashboard/owner?onboarding=success`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  // Optional Partner Attribution ID; only set when the partner has a BN code.
  if (process.env.PAYPAL_BN_CODE) {
    headers['PayPal-Partner-Attribution-Id'] = process.env.PAYPAL_BN_CODE;
  }

  const signal = AbortSignal.timeout(PAYPAL_TIMEOUT_MS);
  const response = await fetch(`${paypalApiBase()}/v2/customer/partner-referrals`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tracking_id: trackingId,
      operations: [
        {
          operation: 'API_INTEGRATION',
          api_integration_preference: {
            rest_api_integration: {
              integration_method: 'PAYPAL',
              first_party_details: {
                seller_ops_status: 'TRACKING_OBLIGATORY',
              },
            },
          },
        },
      ],
      products: ['EXPRESS_CHECKOUT'],
      legal_consents: [
        {
          type: 'SHARE_DATA_CONSENT',
          granted: true,
        },
      ],
      return_url: returnUrl,
      business_details: {
        names: [{ legal_name: businessName }],
      },
      // Note: ownerEmail is not a top-level partner-referrals field; it is
      // captured on the PayPal onboarding form itself. We record it locally
      // for correlation once the owner completes onboarding.
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'paypal_partner_referral_failed',
        status: response.status,
        trackingId,
        body,
      })
    );
    throw new Error(`PayPal partner referral failed (${response.status})`);
  }

  const data = await response.json();
  const actionLink = data.links?.find((l) => l.rel === 'action_url');
  if (!actionLink || !actionLink.href) {
    throw new Error('PayPal partner referral response did not include an action_url');
  }

  console.info(
    JSON.stringify({
      level: 'info',
      msg: 'paypal_partner_referral_created',
      trackingId,
      ownerEmail,
      businessName,
    })
  );

  return {
    onboardingUrl: actionLink.href,
    trackingId,
  };
};

/**
 * Look up a PayPal Partner Referral by tracking ID to retrieve the onboarded
 * merchant ID (partner_customer_id) once the owner has completed onboarding.
 *
 * @param {string} trackingId - The tracking ID returned from generatePartnerOnboardingLink
 * @returns {Promise<{ partnerCustomerId: string | null, status: string }>}
 */
const getPartnerReferral = async (trackingId) => {
  if (!trackingId) {
    throw new Error('trackingId is required');
  }

  const accessToken = await getPayPalAccessToken();
  const signal = AbortSignal.timeout(PAYPAL_TIMEOUT_MS);
  const response = await fetch(`${paypalApiBase()}/v2/customer/partner-referrals/${encodeURIComponent(trackingId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'paypal_partner_referral_lookup_failed',
        status: response.status,
        trackingId,
        body,
      })
    );
    throw new Error(`PayPal partner referral lookup failed (${response.status})`);
  }

  const data = await response.json();
  // partner_customer_id is the onboarded merchant ID
  const partnerCustomerId = data.partner_customer_id || null;
  const status = data.status || null;

  console.info(
    JSON.stringify({
      level: 'info',
      msg: 'paypal_partner_referral_lookup_done',
      trackingId,
      partnerCustomerId,
      status,
    })
  );

  return { partnerCustomerId, status };
};

module.exports = { generatePartnerOnboardingLink, getPayPalAccessToken, getPartnerReferral };