const paypal = require('@paypal/checkout-server-sdk');
const { Booking, Transaction, User } = require('../models');
const { processBookingEscrow, releaseEscrowToOwner } = require('../services/walletService');

/**
 * Build PayPal HTTP client
 */
const getPayPalClient = () => {
  const environment = process.env.PAYPAL_MODE === 'live'
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

  return new paypal.core.PayPalHttpClient(
    new environment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET_KEY)
  );
};

/**
 * Capture a PayPal order after buyer approval
 */
const capturePayPalOrder = async (req, res) => {
  try {
    const { orderId, bookingId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    const client = getPayPalClient();
    const response = await client.execute(request);

    const capture = response.result.purchase_units[0].payments.captures[0];
    const paypalTransactionId = capture.id;
    const amount = parseFloat(capture.amount.value);

    // Find the booking
    const bookingIdFromRef = orderId && response.result.id;
    let booking = null;

    if (bookingId) {
      booking = await Booking.findByPk(bookingId);
    }

    if (!booking) {
      // Try to find booking by PayPal custom_id / reference
      const bookingRef = response.result.purchase_units[0].reference_id;
      if (bookingRef && bookingRef.startsWith('booking_')) {
        const internalBookingId = bookingRef.replace('booking_', '');
        booking = await Booking.findByPk(internalBookingId);
      }
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Update booking payment status
    booking.paymentMethod = 'paypal';
    booking.paymentDate = new Date();
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    await booking.save();

    // Create transaction record
    const { Transaction } = require('../models');
    await Transaction.create({
      reference: `TXN-PAYPAL-${paypalTransactionId}`,
      type: 'booking_payment',
      userId: booking.renterId,
      bookingId: booking.id,
      amount,
      status: 'completed',
      description: `PayPal payment for booking ${booking.bookingReference}`,
      metadata: { paypalTransactionId, paypalOrderId: orderId }
    });

    // Process escrow: hold funds, split after rental completion
    await processBookingEscrow(booking.id);

    res.json({
      success: true,
      message: 'Payment captured successfully',
      booking,
      paypalTransaction: {
        id: paypalTransactionId,
        status: capture.status,
        amount
      }
    });
  } catch (error) {
    console.error('PayPal capture error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get PayPal order details (for frontend to check status)
 */
const getPayPalOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const client = getPayPalClient();
    const request = new paypal.orders.OrdersGetRequest(orderId);
    const response = await client.execute(request);

    res.json({
      success: true,
      order: response.result
    });
  } catch (error) {
    console.error('Get PayPal order error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { capturePayPalOrder, getPayPalOrder };