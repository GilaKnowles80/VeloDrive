const { User, Vehicle, Booking, Transaction, Wallet } = require('../models');

const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalOwners = await User.count({ where: { role: 'owner' } });
    const totalRenters = await User.count({ where: { role: 'renter' } });
    const totalVehicles = await Vehicle.count();
    const totalBookings = await Booking.count();
    const totalRevenue = await Transaction.sum('amount', { where: { type: 'commission', status: 'completed' } }) || 0;

    const recentBookings = await Booking.findAll({
      include: [
        { model: Vehicle },
        { model: User, as: 'renter' },
        { model: User, as: 'owner' }
      ],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOwners,
        totalRenters,
        totalVehicles,
        totalBookings,
        totalRevenue: parseFloat(totalRevenue)
      },
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [{ model: Wallet }]
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      include: [{ model: User, as: 'owner', attributes: ['firstName', 'lastName', 'email'] }]
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
        { model: User, as: 'renter' },
        { model: User, as: 'owner' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const verifyVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    await vehicle.update({ isVerified: true });
    res.json({ success: true, message: 'Vehicle verified', vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const suspendUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await user.update({ isActive: false });
    res.json({ success: true, message: 'User suspended', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      include: [{ model: User, attributes: ['firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']]
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
  getAllTransactions
};