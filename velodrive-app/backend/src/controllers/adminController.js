const { Op } = require('sequelize');
const { User, Vehicle, Booking, Transaction, Wallet } = require('../models');

const USER_ATTRS = ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'isActive', 'isEmailVerified', 'createdAt'];

// The platform earns through the flat per-booking service charge and any commission.
const REVENUE_TYPES = ['service_charge', 'commission'];

const getDashboardStats = async (req, res) => {
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

const getAllUsers = async (req, res) => {
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

const getAllVehicles = async (req, res) => {
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

/**
 * Approve or revoke a listing. Body: { verified?: boolean } (defaults to true).
 */
const verifyVehicle = async (req, res) => {
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Suspend or reactivate an account. Body: { isActive?: boolean } (defaults to false).
 */
const suspendUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot suspend your own admin account' });
    }
    if (user.role === 'admin' && req.body.isActive === false) {
      return res.status(400).json({ success: false, message: 'Other admin accounts cannot be suspended here' });
    }

    const isActive = req.body.isActive === undefined ? false : Boolean(req.body.isActive);
    await user.update({ isActive });

    if (!isActive) {
      await Transaction.sequelize.query('DELETE FROM refresh_tokens WHERE "userId" = :userId', {
        replacements: { userId: user.id },
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: isActive ? 'Account reactivated' : 'Account suspended',
      user: { id: user.id, email: user.email, isActive: user.isActive },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }],
      order: [['createdAt', 'DESC']],
      limit: 500,
    });
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getAllVehicles,
  getAllBookings,
  verifyVehicle,
  suspendUser,
  getAllTransactions,
};
