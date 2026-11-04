const { Booking, User } = require('../models');
const { releaseEscrowToOwner, refundBooking, debitWallet } = require('../services/paymentService');

const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    booking.status = 'confirmed';
    await booking.save();
    res.json({ success: true, message: 'Booking confirmed', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const startRental = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });

    booking.status = 'active';
    await booking.save();
    res.json({ success: true, message: 'Rental started', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const completeRental = async (req, res) => {
  try {
    const { fuelCharged, damageCharged, delayHours, delayCharge, additionalCharges } = req.body;
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    booking.fuelCharged = fuelCharged || 0;
    booking.damageCharged = damageCharged || 0;
    booking.delayHours = delayHours || 0;
    booking.delayCharge = delayCharge || 0;
    booking.additionalCharges = additionalCharges || 0;
    booking.actualReturnDate = new Date();
    booking.status = 'completed';

    const extraTotal = parseFloat(fuelCharged || 0) + parseFloat(damageCharged || 0) + parseFloat(delayCharge || 0) + parseFloat(additionalCharges || 0);
    if (extraTotal > 0) {
      await debitWallet(
        booking.renterId,
        extraTotal,
        'additional_charge',
        `Extra charges for booking ${booking.bookingReference}`,
        booking.id
      );
    }

    await releaseEscrowToOwner(booking.id);

    res.json({ success: true, message: 'Rental completed', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.renterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    booking.status = 'cancelled';
    await refundBooking(booking.id, 'Cancelled by user');
    res.json({ success: true, message: 'Booking cancelled and refunded' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { confirmBooking, startRental, completeRental, cancelBooking };