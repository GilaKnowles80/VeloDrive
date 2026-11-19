import { Op } from 'sequelize';
import db from '../models/index.js';
import { calculateBookingAmounts } from '../services/paymentService.js';
import { createPayPalOrder } from '../services/paypalService.js';

const { Booking, Vehicle, User, Transaction } = db;

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

export const createBooking = async (req, res) => {
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
    const { ownerNetAmount, serviceChargeFee, totalAmount, ownerPayout } = calculateBookingAmounts(rentalAmount);

    // Fetch owner's PayPal email for direct payout
    const owner = await User.findByPk(vehicle.ownerId, { attributes: ['id', 'email', 'paypalEmail'] });
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Vehicle owner not found' });
    }

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
      basePrice: rentalAmount,
      commissionAmount: serviceChargeFee,
      serviceChargeAmount: serviceChargeFee,
      ownerPayout,
      ownerNetAmount,
      serviceChargeFee,
      totalAmount,
      currency: vehicle.currency || 'PHP',
      paymentStatus: 'pending',
      escrowStatus: 'not_held',
      status: 'pending',
    });

    const frontendUrl = (process.env.FRONTEND_URL