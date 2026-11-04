const { Booking, Vehicle, User } = require('../models');
const { calculateBookingAmounts, processBookingEscrow, releaseEscrowToOwner, refundBooking, creditWallet, debitWallet } = require('../services/paymentService');
const { createPayPalOrder, processSplitPayment } = require('../services/paypalService');

const createBooking = async (req, res) => {
  try {
    const {
      vehicleId, rentalStartDate, rentalEndDate, numberOfDays,
      pickupPoint, returnPoint, destinationPoint
    } = req.body;

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (!vehicle.isAvailable) return res.status(400).json({ success: false, message: 'Vehicle not available' });

    const basePrice = parseFloat(vehicle.pricePerDay) * numberOfDays;
    const { basePrice: totalBase, serviceChargeAmount, ownerPayout } = calculateBookingAmounts(basePrice, 250);

    const bookingReference = `VD-${Date.now()}-${Math.round(Math.random() * 1000)}`;

    const booking = await Booking.create({
      bookingReference,
      vehicleId,
      ownerId: vehicle.ownerId,
      renterId: req.user.id,
      rentalStartDate,
      rentalEndDate,
      numberOfDays,
      pickupPoint,
      returnPoint,
      destinationPoint,
      basePrice: totalBase,
      commissionAmount: serviceChargeAmount,
      ownerPayout,
      totalAmount: totalBase,
      paymentStatus: 'pending',
      escrowStatus: 'not_held',
      status: 'pending'
    });

    const returnUrl = `${process.env.FRONTEND_URL}/booking-success/${booking.id}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/booking-cancel/${booking.id}`;

    const paypalOrder = await createPayPalOrder({
      bookingId: booking.id,
      ownerId: vehicle.ownerId,
      salesAgentId: null,
      basePrice: totalBase,
      commissionPercent: 10,
      salesAgentPercent: 0,
      currency: 'PHP',
      returnUrl,
      cancelUrl
    });

    if (!paypalOrder.success) {
      await booking.destroy();
      return res.status(400).json({ success: false, message: 'Failed to create PayPal order', error: paypalOrder.error });
    }

    const { Transaction } = require('../models');
    await Transaction.create({
      reference: `TXN-BK-${booking.id}`,
      type: 'booking_payment',
      userId: req.user.id,
      bookingId: booking.id,
      amount: totalBase,
      status: 'pending',
      description: `Payment for booking ${booking.bookingReference}`,
      metadata: { paypalOrderId: paypalOrder.orderId }
    });

    res.status(201).json({
      success: true,
      message: 'Booking created. Please complete payment via PayPal.',
      booking,
      paypalOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRenterBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: { renterId: req.user.id },
      include: [{ model: Vehicle }, { model: User, as: 'owner' }]
    });
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOwnerBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: { ownerId: req.user.id },
      include: [{ model: Vehicle }, { model: User, as: 'renter' }]
    });
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      include: [
        { model: Vehicle },
        { model: User, as: 'renter' },
        { model: User, as: 'owner' }
      ]
    });
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: Vehicle },
        { model: User, as: 'renter' },
        { model: User, as: 'owner' }
      ]
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (
      req.user.role !== 'admin' &&
      booking.ownerId !== req.user.id &&
      booking.renterId !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createBooking, getRenterBookings, getOwnerBookings, getAllBookings, getBookingById };