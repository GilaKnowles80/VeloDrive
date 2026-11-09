const paypal = require('@paypal/checkout-server-sdk');
const { Booking, Transaction, User, Vehicle } = require('../models');
const { withTimeout, retry, CircuitBreaker } = require('../utils/resilience');

const paypalCircuit = new CircuitBreaker({ name: 'paypal', failureThreshold: 4, resetMs: 60000 });
const PAYPAL_TIMEOUT_MS = Number(process.env.PAYPAL_TIMEOUT_MS || 20000);

const execPayPal = (request) =>
  paypalCircuit.exec(() => retry(
    () => withTimeout(paypalClient.execute(request), PAYPAL_TIMEOUT_MS, 'paypal'),
    {
      retries: 2,
      baseDelayMs: 500,
      shouldRetry: (err) => err?.code !== 'CIRCUIT_OPEN' && !/invalid|unauthorized|malformed/i.test(err?.message || ''),
      onRetry: (err, attempt) => console.warn(JSON.stringify({ level: 'warn', msg: 'paypal_retry', attempt, error: err.message })),
    }
  ));

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
 * Build a PayPal payment request object for booking escrow split
 * Renter pays total → Admin takes 10% Opex fee → Owner receives net amount
 * Owner's PayPal email is the payee; admin Opex goes to PAYPAL_ADMIN_EMAIL via platform_fees
 */
const buildMultiPartyPaymentRequest = ({
  bookingId,
  ownerId,
  salesAgentId,
  basePrice,
  adminOpexFee,
  totalAmount,
  currency = 'PHP',
  returnUrl,
  cancelUrl,
  ownerPaypalEmail
}) => {
  const adminOpexAmount = parseFloat(adminOpexFee.toFixed(2));
  const ownerNetAmount = parseFloat(basePrice.toFixed(2));

  const request = new paypal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `booking_${bookingId}`,
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
        },
        payment_instruction: {
          platform_fees: [
            {
              amount: {
                currency_code: currency,
                value: adminOpexAmount.toFixed(2)
              },
              type: 'OPEX_FEE',
              description: 'VeloDrive admin Opex fee (10%)',
              payee: {
                email_address: process.env.PAYPAL_ADMIN_EMAIL
              }
            }
          ]
        }
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

  return {
    request,
    split: {
      bookingId,
      ownerId,
      salesAgentId,
      adminOpexAmount,
      ownerNetAmount,
      totalAmount,
      adminPaypalEmail: process.env.PAYPAL_ADMIN_EMAIL,
      ownerPaypalEmail
    }
  };
};

/**
 * Create PayPal order for booking
 * Payee = owner's PayPal email; platform_fees = admin 10% Opex to admin email
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

    const capture = response.result.purchase_units[0].payments.captures[0];
    return {
      success: true,
      transactionId: capture.id,
      status: capture.status,
      amount: parseFloat(capture.amount.value),
      currency: capture.amount.currency_code,
      paypalResponse: response.result
    };
  } catch (error) {
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
  adminOpexAmount,
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

    // 1. Record Admin Opex fee (10%) → admin wallet, completed immediately
    if (Number(adminOpexAmount) > 0) {
      await Transaction.create({
        reference: `PAY-${paypalTransactionId}-ADMIN-OPEX`,
        type: 'service_charge',
        userId: adminUser.id,
        bookingId,
        amount: adminOpexAmount,
        status: 'completed',
        description: `VeloDrive admin Opex fee (10%) for booking ${booking.bookingReference}`,
        metadata: {
          paypalTransactionId,
          recipient: process.env.PAYPAL_ADMIN_EMAIL,
          role: 'admin',
          feeType: 'opex_fee'
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
const processOwnerMembership = async ({ ownerId, amount = 4999, currency = 'PHP', billingCycle = 'yearly' }) => {
  const transaction = await Booking.sequelize.transaction();
  try {
    const owner = await User.findByPk(ownerId, { transaction });
    if (!owner) throw new Error('Owner not found');
    if (owner.role !== 'owner') throw new Error('User is not an owner');

    const membershipResponse = await createPayPalOrder({
      bookingId: `membership_${ownerId}`,
      ownerId,
      salesAgentId: null,
      basePrice: amount,
      serviceChargeFlatFee: 0,
      currency,
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
      currency,
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
      currency,
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

    return {
      success: true,
      order: {
        id: response.result.id,
        status: response.result.status,
        amount: unit?.amount?.value,
        currency: unit?.amount?.currency_code,
        referenceId: unit?.reference_id,
      },
    };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'paypal_get_order_error', error: error.message }));
    return { success: false, error: error.message };
  }
};

module.exports = {
  buildMultiPartyPaymentRequest,
  createPayPalOrder,
  capturePayPalPayment,
  createTopupOrder,
  getOrder,
  processSplitPayment,
  processOwnerMembership,
  refundPayment
};
