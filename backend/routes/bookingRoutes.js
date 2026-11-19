import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  createBooking, 
  getRenterBookings, 
  getOwnerBookings,
  getAllBookings, 
  getBookingById
} from '../controllers/bookingController.js';
import { 
  confirmBooking, 
  startRental, 
  completeRental, 
  cancelBooking 
} from '../controllers/bookingActions.js';

const router = express.Router();

router.post('/', protect, authorize('renter'), createBooking);
router.get('/my-rentals', protect, authorize('renter'), getRenterBookings);
router.get('/my-bookings', protect, authorize('owner'), getOwnerBookings);
router.get('/', protect, authorize('admin'), getAllBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/confirm', protect, authorize('owner'), confirmBooking);
router.put('/:id/start', protect, authorize('owner'), startRental);
router.put('/:id/complete', protect, authorize('owner'), completeRental);
router.put('/:id/cancel', protect, authorize('renter'), cancelBooking);

export default router;
