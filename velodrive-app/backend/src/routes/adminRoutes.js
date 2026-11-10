const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboardStats, getAllUsers, getAllVehicles,
  getAllBookings, verifyVehicle, suspendUser, getAllTransactions, exportTransactions
} = require('../controllers/adminController');

router.get('/dashboard', protect, authorize('admin'), getDashboardStats);
router.get('/users', protect, authorize('admin'), getAllUsers);
router.get('/vehicles', protect, authorize('admin'), getAllVehicles);
router.get('/bookings', protect, authorize('admin'), getAllBookings);
router.get('/transactions', protect, authorize('admin'), getAllTransactions);
router.get('/transactions/export', protect, authorize('admin'), exportTransactions);
router.put('/vehicles/:id/verify', protect, authorize('admin'), verifyVehicle);
router.put('/users/:id/suspend', protect, authorize('admin'), suspendUser);

module.exports = router;