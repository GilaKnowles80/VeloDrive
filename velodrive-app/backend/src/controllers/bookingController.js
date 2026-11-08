const { Op } = require('sequelize');
const { Booking, Vehicle, User, Transaction } = require('../models');
const { calculateBookingAmounts } = require('../services/paymentService');
const { createPayPalOrder } = require('../services/paypalService');

const USER_ATTRS = ['id', 'firstName', 'lastName', 'email', 'phone', 'role'];
const ACTIVE_STATUSES = ['pending', 'confirmed', 'active'];
const MAX_RENTAL_DAYS = 365;

const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const daysBetween = (start, end) =>
  Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);

const findConflictingBooking = async (vehicleId, rentalStartDate, rentalEndDate) =>
  Booking.findOne({
    where: {
      vehicleId,
      status: { [Op.in]: ACTIVE_STATUSES },
      rentalStartDate: { [Op.lt]: rentalEndDate },
      rentalEndDate: { [Op.gt]: rentalStartDate },
    },
  });

const createBooking = async (req, res) => {
  try {
    const {
      vehicleId,
      rentalStartDate,
      rentalEndDate,
      pickupPoint,
      returnPoint,
      destinationPoint,
    } = req.body;

    const missing = [
      ['vehicleId', vehicleId],
      ['rentalStartDate', rentalStartDate],
      ['rentalEndDate', rentalEndDate],
      ['pickupPoint', pickupPoint],
      ['returnPoint', returnPoint],
    ]
      .filter(([, value]) => String(value ?? '').trim() === '')
      .map(([field]) => field);

    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!isIsoDate(rentalStartDate) || !isIsoDate(rentalEndDate)) {
      return res.status(400).json({ success: false, message: 'Dates must use the YYYY-MM-DD format' });
    }

    const numberOfDays = daysBetween(rentalStartDate, rentalEndDate);
    if (numberOfDays < 1 || numberOfDays > MAX_RENTAL_DAYS) {
      return res.status(400).json({ success: false, message: `Rental length must be between 1 and ${MAX_RENTAL_DAYS} days` });
    }

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (vehicle.ownerId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot book your own vehicle' });
    }
    if (!vehicle.isVerified || vehicle.status !== 'active' || !vehicle.isAvailable) {
      return res.status(400).json({ success: false, message: 'This vehicle is not available for booking' });
    }

    const conflict = await findConflictingBooking(vehicle.id, rentalStartDate, rentalEndDate);
    if (conflict) {
      return res.status(409).json({ success: false, message: 'This vehicle is already booked for those dates' });
    }

    const rentalAmount = Number(vehicle.pricePerDay) * numberOfDays;
    const { basePrice, serviceChargeAmount, ownerPayout } = calculateBookingAmounts(rentalAmount);

    const booking = await Booking.create({
      bookingReference: `VD-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      vehicleId: vehicle.id,
      ownerId: vehicle.ownerId,
      renterId: req.user.id,
      rentalStartDate,
      rentalEndDate,
      numberOfDays,
      pickupPoint: String(pickupPoint).trim(),
      returnPoint: String(returnPoint).trim(),
      destinationPoint: String(destinationPoint || returnPoint).trim(),
      basePrice,
      commissionAmount: serviceChargeAmount,
      serviceChargeAmount,
      ownerPayout,
      totalAmount: basePrice,
      currency: vehicle.currency || 'PHP',
      paymentStatus: 'pending',
      escrowStatus: 'not_held',
      status: 'pending',
    });

    const frontendUrl = (process.env.FRONTEND_URL || '').split(',')[0].trim();
    const paypalOrder = await createPayPalOrder({
      bookingId: booking.id,
      ownerId: vehicle.ownerId,
      salesAgentId: null,
      basePrice,
      serviceChargeFlatFee: serviceChargeAmount,
      currency: booking.currency,
      returnUrl: `${frontendUrl}/booking-success/${booking.id}`,
      cancelUrl: `${frontendUrl}/booking-cancel/${booking.id}`,
    });

    if (!paypalOrder.success) {
      await booking.destroy();
      return res.status(502).json({
        success: false,
        message: 'Could not start the PayPal checkout. Please try again.',
      });
    }

    booking.paypalOrderId = paypalOrder.orderId;
    await booking.save();

    await Transaction.create({
      reference: `TXN-BK-${booking.id}`,
      type: 'booking_payment',
      userId: req.user.id,
      bookingId: booking.id,
      amount: basePrice,
      status: 'pending',
      description: `Payment for booking ${booking.bookingReference}`,
      metadata: { paypalOrderId: paypalOrder.orderId, provider: 'paypal' },
    });

    res.status(201).json({
      success: true,
      message: 'Booking created. Complete the PayPal payment to confirm it.',
      booking,
      paypalOrder: {
        orderId: paypalOrder.orderId,
        approvalUrl: paypalOrder.approvalUrl,
        status: paypalOrder.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getRenterBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: { renterId: req.user.id },
      include: [
        { model: Vehicle },
        { model: User, as: 'owner', attributes: USER_ATTRS },
      ],
      order: [['createdAt', 'DESC']],
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
      include: [
        { model: Vehicle },
        { model: User, as: 'renter', attributes: USER_ATTRS },
      ],
      order: [['createdAt', 'DESC']],
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
        { model: User, as: 'renter', attributes: USER_ATTRS },
        { model: User, as: 'owner', attributes: USER_ATTRS },
      ],
      order: [['createdAt', 'DESC']],
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
        { model: User, as: 'renter', attributes: USER_ATTRS },
        { model: User, as: 'owner', attributes: USER_ATTRS },
      ],
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
