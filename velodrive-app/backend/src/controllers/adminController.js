const { Op } = require('sequelize');
const { User, Vehicle, Booking, Transaction, Wallet } = require('../models');

const USER_ATTRS = ['id', 'firstName', 'lastName', 'email', 'phone', 'role', 'isActive', 'isEmailVerified', 'createdAt'];

// The platform earns through the 10% flat per-booking service charge and platform membership subscriptions.
const REVENUE_TYPES = ['service_charge', 'subscription', 'commission'];
const SERVICE_CHARGE_RATE = Number(process.env.SERVICE_CHARGE_FLAT_FEE) || 0.10;
const PLATFORM_MEMBERSHIP_FEE = { 
  monthly: Number(process.env.PLATFORM_MEMBERSHIP_FEE) || 499.00, 
  yearly: Number(process.env.PLATFORM_MEMBERSHIP_FEE) || 4999.00,
 };

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

const exportTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'role'] }],
      order: [['createdAt', 'DESC']],
      limit: 10000,
    });

    // Build CSV header
    const headers = [
      'Reference', 'Type', 'Status', 'Amount (PHP)', 'Currency',
      'User ID', 'User Name', 'User Email', 'User Role',
      'Booking ID', 'Description', 'Created At'
    ];

    const rows = transactions.map((t) => {
      const u = t.User || {};
      const createdAt = t.createdAt ? new Date(t.createdAt).toISOString() : '';
      return [
        t.reference || '',
        t.type || '',
        t.status || '',
        t.amount || 0,
        t.currency || 'PHP',
        u.id || '',
        `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        u.email || '',
        u.role || '',
        t.bookingId || '',
        (t.description || '').replace(/"/g, '""'),
        createdAt,
      ];
    });

    // Escape fields that contain commas, quotes, or newlines
    const escapeCell = (cell) => {
      const s = String(cell == null ? '' : cell);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows.map((row) => row.map(escapeCell).join(',')),
    ].join('\n');

    const filename = `velodrive_transactions_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(csvContent);
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
  exportTransactions,
};
