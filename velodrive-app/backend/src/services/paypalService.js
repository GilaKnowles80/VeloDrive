const paypal = require('@paypal/checkout-server-sdk');
const { Booking, Transaction, User, Vehicle } = require('../models');
const { withTimeout, retry, CircuitBreaker } = require('../utils/resilience');
const { assertPayPalRuntimeAllowed } = require('../config/runtimeReadiness');

const paypalCircuit = new CircuitBreaker({ name: 'paypal', failureThreshold: 4, resetMs: 60000 });
const PAYPAL_TIMEOUT_MS = Number(process.env.PAYPAL_TIMEOUT_MS || 20000);

const execPayPal = (request) =>
  Promise.resolve().then(() => {
    assertPayPalRuntimeAllowed();
    return paypalCircuit.exec(() => retry(
      () => withTimeout(paypalClient.execute(request), PAYPAL_TIMEOUT_MS, 'paypal'),
      {
        retries: 2,
        baseDelayMs: 500,
        shouldRetry: (err) => err?.code !== 'CIRCUIT_OPEN' && !/invalid|unauthorized|malformed/i.test(err?.message || ''),
        onRetry: (err, attempt) => console.warn(JSON.stringify({ level: 'warn', msg: 'paypal_retry', attempt, error: err.message })),
      }
    ));
  });

/**
 * PayPal Environment Configuration
 */
const environment = process.env.PAYPAL_MODE === 'live'
  ? paypal.core.LiveEnvironment
  : paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(
  new environment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_SECRET_KEY
  )
);

/**
 * Build a booking payment request that pays the owner directly and routes the
 * service fee to the platform. This does not hold funds in escrow.
 */
const buildMultiPartyPaymentRequest = ({
  bookingId,
  referenceId,
  ownerId,
  salesAgentId,
  basePrice,
  serviceChargeFee,
  totalAmount,
  currency = 'PHP',
  returnUrl,
  cancelUrl,
  ownerPaypalEmail
}) => {
  const serviceChargeAmount = parseFloat(serviceChargeFee.toFixed(2));
  const ownerNetAmount = parseFloat(basePrice.toFixed(2));
  if (serviceChargeAmount > 0 && process.env.PAYPAL_PLATFORM_FEES_ENABLED !== 'true') {
    throw new Error('PayPal platform fees are not enabled; confirm marketplace approval before creating booking orders');
  }

  const purchaseUnit = {
    reference_id: referenceId || `booking_${bookingId}`,
    custom_id: referenceId || `booking_${bookingId}`,
    amount: {
      currency_code: currency,
      value: totalAmount.toFixed(2),
      breakdown: {
        item_total: {
          currency_code: currency,
          value: totalAmount.toFixed(2)
        }
      }
    },
    items: [
      {
        name: `Vehicle Booking ${bookingId}`,
        unit_amount: {
          currency_code: currency,
          value: totalAmount.toFixed(2)
        },
        quantity: 1
      }
    ],
    payee: {
      email_address: ownerPaypalEmail || process.env.PAYPAL_ADMIN_EMAIL
    }
  };

  // Direct-to-platform orders, such as membership, do not use platform_fees.
  if (serviceChargeAmount > 0) {
    purchaseUnit.payment_instruction = {
      platform_fees: [
        {
          amount: {
            currency_code: currency,
            value: serviceChargeAmount.toFixed(2)
          },
          type: 'SERVICE_CHARGE_FEE',
          description: 'VeloDrive service charge fee (10%)',
          payee: {
            email_address: process.env.PAYPAL_ADMIN_EMAIL
          }
        }
      ]
    };
  }

  const request = new paypal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      purchaseUnit
    ],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      branding_name: 'VeloDrive',
      locale: 'en-PH',
      shipping_preference: 'NO_SHIPPING'
    }
  });

  return {
    request,
    split: {
      bookingId,
      ownerId,
      salesAgentId,
      serviceChargeAmount,
      ownerNetAmount,
      totalAmount,
      adminPaypalEmail: process.env.PAYPAL_ADMIN_EMAIL,
      ownerPaypalEmail
    }
  };
};

/**
 * Create PayPal order for booking
 * Payee = owner's PayPal email; platform_fees = admin 10% service charge to admin email
 */
const createPayPalOrder = async (paymentDetails) => {
  try {
    const { request, split } = buildMultiPartyPaymentRequest(paymentDetails);
    const response = await execPayPal(request);

    return {
      success: true,
      orderId: response.result.id,
      status: response.result.status,
      split,
      approvalUrl: response.result.links.find(l => l.rel === 'approve')?.href
    };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_order_create_error', error: error.message, circuit: paypalCircuit.snapshot() }));
    return { success: false, error: error.message };
  }
};

/**
 * Capture PayPal payment (after buyer approval)
 */
const capturePayPalPayment = async (orderId) => {
  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    const response = await execPayPal(request);

    const unit = response.result.purchase_units?.[0];
    const capture = unit?.payments?.captures?.find((item) => item.status === 'COMPLETED')
      || unit?.payments?.captures?.[0];
    if (!capture) throw new Error('PayPal order did not return a capture');
    return {
      success: true,
      transactionId: capture.id,
      status: capture.status,
      amount: parseFloat(capture.amount.value),
      currency: capture.amount.currency_code,
      referenceId: unit.reference_id,
      orderAmount: parseFloat(unit.amount.value),
      orderCurrency: unit.amount.currency_code,
      paypalResponse: response.result
    };
  } catch (error) {
    if (/ALREADY_CAPTURED|ORDER_ALREADY_CAPTURED/i.test(error?.message || '')) {
      const existing = await getOrder(orderId);
      const capture = existing.order?.capture;
      if (existing.success && existing.order.status === 'COMPLETED' && capture?.status === 'COMPLETED') {
        return {
          success: true,
          alreadyCaptured: true,
          transactionId: capture.id,
          status: capture.status,
          amount: Number(capture.amount),
          currency: capture.currency,
          referenceId: existing.order.referenceId,
          orderAmount: Number(existing.order.amount),
          orderCurrency: existing.order.currency,
        };
      }
    }
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_capture_error', error: error.message, circuit: paypalCircuit.snapshot() }));
    return { success: false, error: error.message };
  }
};

/**
 * Process split payment after PayPal capture
 * Admin (10% Opex fee) → admin wallet, completed immediately
 * Owner (net amount) → owner wallet, escrow held until rental completion
 */
const processSplitPayment = async ({
  bookingId,
  paypalTransactionId,
      serviceChargeAmount,
  ownerNetAmount,
  totalAmount,
  adminPaypalEmail,
  ownerPaypalEmail
}) => {
  const transaction = await Booking.sequelize.transaction();
  try {
    const booking = await Booking.findByPk(bookingId, {
      include: [
        { model: User, as: 'owner' },
        { model: User, as: 'renter' }
      ],
      transaction
    });

    if (!booking) throw new Error('Booking not found');

    const adminUser = await User.findOne({ where: { role: 'admin' }, transaction });
    if (!adminUser) throw new Error('Admin account not found');

    // 1. Record Service Charge fee (10%) → admin wallet, completed immediately
    if (Number(serviceChargeAmount) > 0) {
      await Transaction.create({
        reference: `PAY-${paypalTransactionId}-SERVICE-CHARGE`,
        type: 'service_charge',
        userId: adminUser.id,
        bookingId,
        amount: serviceChargeAmount,
        status: 'completed',
        description: `VeloDrive service charge fee (10%) for booking ${booking.bookingReference}`,
        metadata: {
          paypalTransactionId,
          recipient: process.env.PAYPAL_ADMIN_EMAIL,
          role: 'admin',
          feeType: 'service_charge_fee'
        }
      }, { transaction });
    }

    // 2. Record Owner net amount → owner wallet, ESCROW HELD (released on rental completion)
    if (Number(ownerNetAmount) > 0) {
      await Transaction.create({
        reference: `PAY-${paypalTransactionId}-OWNER-NET`,
        type: 'owner_payout',
        userId: booking.ownerId,
        bookingId,
        amount: ownerNetAmount,
        status: 'pending',
        description: `Owner net payout (escrow held) for booking ${booking.bookingReference}`,
        metadata: {
          paypalTransactionId,
          recipient: ownerPaypalEmail || booking.owner?.paypalEmail,
          role: 'owner',
          feeType: 'owner_net_payout',
          escrowStatus: 'held'
        }
      }, { transaction });
    }

    // 3. Update booking: payment held in escrow, status confirmed (not completed yet)
    booking.paymentStatus = 'held_in_escrow';
    booking.escrowStatus = 'held';
    booking.paymentDate = new Date();
    booking.status = 'confirmed';
    await booking.save({ transaction });

    await transaction.commit();
    return { success: true, booking };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Process Owner Membership (monthly Php 499 or yearly Php 4,999) â†’ Admin
 * Charged when owner subscribes. Payee = admin PayPal (gctravelandtours2021@gmail.com).
 */
const processOwnerMembership = async ({ ownerId, billingCycle = 'yearly' }) => {
  const transaction = await Booking.sequelize.transaction();
  try {
    const owner = await User.findByPk(ownerId, { transaction });
    if (!owner) throw new Error('Owner not found');
    if (owner.role !== 'owner') throw new Error('User is not an owner');

    const plans = { monthly: 499, yearly: 4999 };
    const amount = plans[billingCycle];
    if (!amount) throw new Error('Invalid membership billing cycle');

    const membershipResponse = await createPayPalOrder({
      bookingId: `membership_${ownerId}`,
      referenceId: `membership_${ownerId}`,
      ownerId,
      salesAgentId: null,
      basePrice: amount,
      serviceChargeFee: 0,
      totalAmount: amount,
      currency: 'PHP',
      returnUrl: `${process.env.FRONTEND_URL}/owner/membership?success=1&plan=${billingCycle}`,
      cancelUrl: `${process.env.FRONTEND_URL}/owner/membership?cancelled=1`,
      ownerPaypalEmail: process.env.PAYPAL_ADMIN_EMAIL,
    });

    if (!membershipResponse.success) {
      throw new Error(membershipResponse.error);
    }

    await Transaction.create({
      reference: `MEMB-${ownerId}-${Date.now()}`,
      type: 'membership',
      userId: ownerId,
      amount,
      currency: 'PHP',
      status: 'pending',
      description: `VeloDrive membership fee (Php ${amount}) — ${billingCycle}`,
      metadata: {
        paypalOrderId: membershipResponse.orderId,
        role: 'owner',
        feeType: 'membership',
        recipient: process.env.PAYPAL_ADMIN_EMAIL,
        billingCycle,
      }
    }, { transaction });

    await transaction.commit();

    return {
      success: true,
      orderId: membershipResponse.orderId,
      approvalUrl: membershipResponse.approvalUrl,
      amount,
      currency: 'PHP',
      billingCycle,
      recipient: process.env.PAYPAL_ADMIN_EMAIL
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Refund a booking payment via PayPal
 */
const refundPayment = async ({ paypalTransactionId, amount, reason }) => {
  try {
    const request = new paypal.payments.RefundCaptureRequest(paypalTransactionId);
    request.requestBody({
      amount: {
        value: amount.toFixed(2),
        currency_code: 'PHP'
      },
      note_to_payer: reason
    });

    const response = await execPayPal(request);

    return {
      success: true,
      refundId: response.result.id,
      status: response.result.status,
      amount: parseFloat(response.result.amount.value)
    };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_refund_error', error: error.message, circuit: paypalCircuit.snapshot() }));
    return { success: false, error: error.message };
  }
};

/**
 * Create a PayPal order for an e-wallet top-up.
 * Credited only after capturePayPalPayment succeeds, so funds can never be minted client-side.
 */
const createTopupOrder = async ({ userId, amount, currency = 'PHP', returnUrl, cancelUrl }) => {
  try {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid top-up amount');

    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `wallet_${userId}`,
          custom_id: `wallet_${userId}`,
          description: 'VeloDrive wallet top-up',
          amount: {
            currency_code: currency,
            value: value.toFixed(2),
            breakdown: {
              item_total: { currency_code: currency, value: value.toFixed(2) }
            }
          },
          items: [
            {
              name: 'VeloDrive Wallet Top-up',
              unit_amount: { currency_code: currency, value: value.toFixed(2) },
              quantity: 1
            }
          ],
          payee: { email_address: process.env.PAYPAL_ADMIN_EMAIL }
        }
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        branding_name: 'VeloDrive',
        locale: 'en-PH',
        shipping_preference: 'NO_SHIPPING'
      }
    });

    const response = await execPayPal(request);
    await Transaction.create({
      reference: `TOPUP-${response.result.id}`,
      type: 'wallet_topup',
      userId,
      amount: value,
      currency,
      status: 'pending',
      description: `Wallet top-up via PayPal (Php ${value.toFixed(2)})`,
      metadata: {
        paypalOrderId: response.result.id,
        provider: 'paypal',
        paymentMethod: 'paypal',
      },
    });
    return {
      success: true,
      orderId: response.result.id,
      status: response.result.status,
      approvalUrl: response.result.links.find((l) => l.rel === 'approve')?.href,
      amount: value,
      currency
    };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_topup_order_error', error: error.message, circuit: paypalCircuit.snapshot() }));
    return { success: false, error: error.message };
  }
};

/**
 * Fetch a PayPal order for reconciliation (status and captured amounts).
 */
const getOrder = async (orderId) => {
  try {
    const request = new paypal.orders.OrdersGetRequest(orderId);
    const response = await execPayPal(request);
    const unit = response.result.purchase_units?.[0];
    const capture = unit?.payments?.captures?.find((item) => item.status === 'COMPLETED')
      || unit?.payments?.captures?.[0];

    return {
      success: true,
      order: {
        id: response.result.id,
        status: response.result.status,
        amount: unit?.amount?.value,
        currency: unit?.amount?.currency_code,
        referenceId: unit?.reference_id,
        customId: unit?.custom_id,
        capture: capture ? {
          id: capture.id,
          status: capture.status,
          amount: capture.amount?.value,
          currency: capture.amount?.currency_code,
        } : null,
      },
    };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_get_order_error', error: error.message }));
    return { success: false, error: error.message };
  }
};

const verifyPayPalWebhook = async (headers, event) => {
  assertPayPalRuntimeAllowed();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;
  if (!webhookId || !clientId || !secret) {
    throw new Error('PayPal webhook verification is not configured');
  }

  const headerNames = {
    auth_algo: 'paypal-auth-algo',
    cert_url: 'paypal-cert-url',
    transmission_id: 'paypal-transmission-id',
    transmission_sig: 'paypal-transmission-sig',
    transmission_time: 'paypal-transmission-time',
  };
  const verification = { webhook_id: webhookId, webhook_event: event };
  for (const [field, headerName] of Object.entries(headerNames)) {
    const value = headers[headerName];
    if (!value) throw new Error(`Missing PayPal webhook header: ${headerName}`);
    verification[field] = value;
  }

  const apiBase = process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
  const signal = AbortSignal.timeout(PAYPAL_TIMEOUT_MS);
  const tokenResponse = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal,
  });
  if (!tokenResponse.ok) {
    throw new Error(`PayPal OAuth request failed with status ${tokenResponse.status}`);
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error('PayPal OAuth response did not include an access token');

  const verifyResponse = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verification),
    signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
  });
  if (!verifyResponse.ok) {
    throw new Error(`PayPal webhook verification failed with status ${verifyResponse.status}`);
  }
  const verifyData = await verifyResponse.json();
  return verifyData.verification_status === 'SUCCESS';
};

module.exports = {
  buildMultiPartyPaymentRequest,
  createPayPalOrder,
  capturePayPalPayment,
  createTopupOrder,
  getOrder,
  verifyPayPalWebhook,
  processSplitPayment,
  processOwnerMembership,
  refundPayment
};
