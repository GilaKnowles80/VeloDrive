import { Op } from 'sequelize';
import db from '../models/index.js';

// 60-Day Admin Inventory Monitoring Scripts
import { getProfileMonitoringList } from '../uploads/profile/profileInventory.js';
import { getDocumentMonitoringList } from '../uploads/documents/documentInventory.js';
import { getVinTrackerList } from '../uploads/ads/vinTrackerInventory.js';

const { User, Vehicle, Booking, Transaction, Wallet } = db;

const USER_ATTRS = ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'isActive', 'isEmailVerified', 'createdAt'];

// The platform earns through the 10% flat per-booking service charge and platform membership subscriptions.
const REVENUE_TYPES = ['service_charge', 'subscription', 'commission'];
const SERVICE_CHARGE_RATE = Number(process.env.SERVICE_CHARGE_FLAT_FEE) || 0.10;
const PLATFORM_MEMBERSHIP_FEE = { 
  monthly: Number(process.env.PLATFORM_MEMBERSHIP_FEE) || 499.00, 
  yearly: Number(process.env.PLATFORM_MEMBERSHIP_FEE) || 4999.00,
};

export const getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalOwners, totalRenters, totalVehicles, totalBookings, pendingVehicles] =
      await Promise.all([
        User.count(),
        User.count({ where: { role: 'owner' } }),
        User.count({ where: { role: 'renter' } }),
        Vehicle.count(),
        Booking.count(),
        Vehicle.count({ where: { isVerified: false } }),
      ]);

    const totalRevenue = await Transaction.sum('amount', {
      where: { type: { [Op.in]: REVENUE_TYPES }, status: 'completed' },
    });

    const recentBookings = await Booking.findAll({
      include: [
        { model: Vehicle },
        { model: User, as: 'renter', attributes: USER_ATTRS },
        { model: User, as: 'owner', attributes: USER_ATTRS },
      ],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOwners,
        totalRenters,
        totalVehicles,
        totalBookings,
        pendingVehicles,
        totalRevenue: parseFloat(totalRevenue || 0),
      },
      recentBookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password', 'otpCode'] },
      include: [{ model: Wallet }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllVehicles = async (req, res) => {
  try {
    const where = {};
    if (req.query.status === 'pending') where.isVerified = false;
    if (req.query.status === 'verified') where.isVerified = true;

    const vehicles = await Vehicle.findAll({
      where,
      include: [{ model: User, as: 'owner', attributes: USER_ATTRS }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, vehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllBookings = async (req, res) => {
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

/**
 * Approve or revoke a listing. Body: { verified?: boolean } (defaults to true).
 */
export const verifyVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const verified = req.body.verified === undefined ? true : Boolean(req.body.verified);
    await vehicle.update({ isVerified: verified });

    res.json({
      success: true,
      message: verified ? 'Vehicle approved and published' : 'Vehicle verification revoked',
      vehicle,
    });