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
 * Renter pays total â†’ Admin takes Php 250 service charge â†’ Owner receives remaining balance
 * Owner's PayPal email is used for payout after escrow release
 */
const buildMultiPartyPaymentRequest = ({
  bookingId,
  ownerId,
  salesAgentId,
  basePrice,
  serviceChargeFlatFee = 250,
  currency = 'PHP',
  returnUrl,
  cancelUrl,
  ownerPaypalEmail
}) => {
  const serviceChargeAmount = parseFloat(serviceChargeFlatFee.toFixed(2));
  const ownerAmount = parseFloat((basePrice - serviceChargeAmount).toFixed(2));

  const request = new paypal.orders.OrdersCreateRequest();
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `booking_${bookingId}`,
        amount: {
          currency_code: currency,
          value: basePrice.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: currency,
              value: basePrice.toFixed(2)
            }
          }
        },
        items: [
          {
            name: `Vehicle Booking ${bookingId}`,
            unit_amount: {
              currency_code: currency,
              value: basePrice.toFixed(2)
            },
            quantity: 1
          }
        ],
        payee: {
          email_address: process.env.PAYPAL_ADMIN_EMAIL
        },
        payment_instruction: {
          platform_fees: [
            {
              amount: {
                currency_code: currency,
                value: serviceChargeAmount.toFixed(2)
              },
              type: 'SERVICE_CHARGE',
              description: 'VeloDrive service charge (Php 250 flat)',
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
      serviceChargeAmount,
      ownerAmount,
      adminPaypalEmail: process.env.PAYPAL_ADMIN_EMAIL,
      ownerPaypalEmail
    }
  };
};

/**
 * Create PayPal order for booking
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
 * Admin (service charge Php 250), Owner payout to their PayPal
 */
const processSplitPayment = async ({
  bookingId,
  paypalTransactionId,
  adminAmount,
  ownerAmount,
  salesAgentAmount,
  salesAgentId,
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

    // 1. Record Admin service charge (platform fee)
    if (Number(adminAmount) > 0) {
      await Transaction.create({
        reference: `PAY-${paypalTransactionId}-ADMIN`,
        type: 'service_charge',
        userId: adminUser.id,
        bookingId,
        amount: adminAmount,
        status: 'completed',
        description: `VeloDrive service charge (Php 250) for booking ${booking.bookingReference}`,
        metadata: {
          paypalTransactionId,
          recipient: process.env.PAYPAL_ADMIN_EMAIL,
          role: 'admin',
          feeType: 'service_charge'
        }
      }, { transaction });
    }

    // 2. Record Sales Agent Commission (if applicable)
    if (salesAgentId && salesAgentAmount > 0) {
      await Transaction.create({
        reference: `PAY-${paypalTransactionId}-AGENT`,
        type: 'commission',
        userId: salesAgentId,
        bookingId,
        amount: salesAgentAmount,
        status: 'completed',
        description: `Sales Agent commission for booking ${booking.bookingReference}`,
        metadata: {
          paypalTransactionId,
          recipient: salesAgentId,
          role: 'sales_agent',
          feeType: 'commission'
        }
      }, { transaction });
    }

    // 3. Record Owner Payout
    if (Number(ownerAmount) > 0) {
      await Transaction.create({
        reference: `PAY-${paypalTransactionId}-OWNER`,
        type: 'owner_payout',
        userId: booking.ownerId,
        bookingId,
        amount: ownerAmount,
        status: 'completed',
        description: `Owner payout for booking ${booking.bookingReference}`,
        metadata: {
          paypalTransactionId,
          recipient: ownerPaypalEmail || booking.owner?.paypalEmail,
          role: 'owner',
          feeType: 'payout'
        }
      }, { transaction });
    }

    // 4. Record Owner Add-On Fee (charged to owner's account per booking)
    const bookingData = await Booking.findByPk(bookingId, { transaction });
    if (bookingData && Number(bookingData.ownerAddOnFee) > 0) {
      await Transaction.create({
        reference: `PAY-${paypalTransactionId}-OWNER-ADDON`,
        type: 'owner_add_on_fee',
        userId: booking.ownerId,
        bookingId,
        amount: bookingData.ownerAddOnFee,
        status: 'completed',
        description: `Owner add-on fee for booking ${booking.bookingReference}`,
        metadata: {
          paypalTransactionId,
          recipient: booking.owner?.paypalEmail,
          role: 'owner',
          feeType: 'add_on_fee'
        }
      }, { transaction });
    }

    // 4. Update booking payment status
    booking.paymentStatus = 'paid';
    booking.escrowStatus = 'released';
    booking.paymentDate = new Date();
    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save({ transaction });

    await transaction.commit();
    return { success: true, booking };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Process Owner One-Time Yearly Membership â†’ Admin
 * Charged once per year when owner registers and becomes a member,
 * regardless of how many vehicles they own.
 */
const processOwnerMembership = async ({ ownerId, amount = 2500, currency = 'PHP' }) => {
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
      returnUrl: `${process.env.FRONTEND_URL}/owner/dashboard?membership=success`,
      cancelUrl: `${process.env.FRONTEND_URL}/owner/dashboard?membership=cancelled`
    });

    if (!membershipResponse.success) {
      throw new Error(membershipResponse.error);
    }

    await Transaction.create({
      reference: `MEMB-${ownerId}-${Date.now()}`,
      type: 'subscription',
      userId: ownerId,
      amount,
      currency,
      status: 'pending',
      description: `One-time yearly VeloDrive membership fee (Php ${amount})`,
      metadata: {
        paypalOrderId: membershipResponse.orderId,
        role: 'owner',
        feeType: 'membership',
        recipient: process.env.PAYPAL_ADMIN_EMAIL,
        isOneTime: true,
        billingCycle: 'yearly'
      }
    }, { transaction });

    await transaction.commit();

    return {
      success: true,
      orderId: membershipResponse.orderId,
      approvalUrl: membershipResponse.approvalUrl,
      amount,
      currency,
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
