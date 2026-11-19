const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createBooking, getRenterBookings, getOwnerBookings,
  getAllBookings, getBookingById
} = require('../controllers/bookingController');
const { confirmBooking, startRental, completeRental, cancelBooking } = require('../controllers/bookingActions');

router.post('/', protect, authorize('renter'), createBooking);
router.get('/my-rentals', protect, authorize('renter'), getRenterBookings);
router.get('/my-bookings', protect, authorize('owner'), getOwnerBookings);
router.get('/', protect, authorize('admin'), getAllBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/confirm', protect, authorize('owner'), confirmBooking);
router.put('/:id/start', protect, authorize('owner'), startRental);
router.put('/:id/complete', protect, authorize('owner'), completeRental);
router.put('/:id/cancel', protect, authorize('renter'), cancelBooking);

module.exports = router;