import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getDashboardStats, 
  getAllUsers, 
  getAllVehicles,
  getAllBookings, 
  verifyVehicle, 
  suspendUser, 
  getAllTransactions, 
  exportTransactions,
  getAdminInventory
} from '../controllers/adminController.cjs';

const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getDashboardStats);
router.get('/users', protect, authorize('admin'), getAllUsers);
router.get('/vehicles', protect, authorize('admin'), getAllVehicles);
router.get('/bookings', protect, authorize('admin'), getAllBookings);
router.get('/transactions', protect, authorize('admin'), getAllTransactions);
router.get('/transactions/export', protect, authorize('admin'), exportTransactions);
router.get('/inventory', protect, authorize('admin'), getAdminInventory);
router.put('/vehicles/:id/verify', protect, authorize('admin'), verifyVehicle);
router.put('/users/:id/suspend', protect, authorize('admin'), suspendUser);

export default router;