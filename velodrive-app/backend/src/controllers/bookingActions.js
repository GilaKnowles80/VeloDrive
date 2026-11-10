const { Booking, Vehicle } = require('../models');
const {
  releaseEscrowToOwner,
  refundBooking,
  chargeRenterExtras,
} = require('../services/paymentService');

const findBooking = async (id) => Booking.findByPk(id);

const denyUnlessOwnerOrAdmin = (booking, user) =>
  booking.ownerId === user.id || user.role === 'admin';

const confirmBooking = async (req, res) => {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!denyUnlessOwnerOrAdmin(booking, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (booking.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Cannot confirm a booking that is ${booking.status}` });
    }

    booking.status = 'confirmed';
    await booking.save();

    res.json({ success: true, message: 'Booking confirmed', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const startRental = async (req, res) => {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!denyUnlessOwnerOrAdmin(booking, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (booking.status !== 'confirmed') {
      return res.status(409).json({ success: false, message: `Cannot start a booking that is ${booking.status}` });
    }
    if (!['held_in_escrow', 'released_to_owner'].includes(booking.paymentStatus)) {
      return res.status(409).json({ success: false, message: 'Payment has not been received for this booking' });
    }

    booking.status = 'active';
    await booking.save();

    // Set vehicle to en-route and mark unavailable while rental is active
    await Vehicle.update(
      { status: 'en-route', isAvailable: false },
      { where: { id: booking.vehicleId } }
    );

    res.json({ success: true, message: 'Rental started', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toCharge = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : 0;
};

const completeRental = async (req, res) => {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!denyUnlessOwnerOrAdmin(booking, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (booking.status === 'completed') {
      return res.status(409).json({ success: false, message: 'Booking is already completed' });
    }
    if (booking.status !== 'active') {
      return res.status(409).json({ success: false, message: `Cannot complete a booking that is ${booking.status}` });
    }

    booking.fuelCharged = toCharge(req.body.fuelCharged);
    booking.damageCharged = toCharge(req.body.damageCharged);
    booking.delayHours = Number(req.body.delayHours) > 0 ? Number(req.body.delayHours) : 0;
    booking.delayCharge = toCharge(req.body.delayCharge);
    booking.additionalCharges = toCharge(req.body.additionalCharges);
    booking.actualReturnDate = new Date();
    booking.status = 'completed';
    await booking.save();

    // Return vehicle to active if no damage, else maintenance
    if (booking.damageCharged && booking.damageCharged > 0) {
      await Vehicle.update(
        { status: 'maintenance', isAvailable: false },
        { where: { id: booking.vehicleId } }
      );
    } else {
      await Vehicle.update(
        { status: 'active', isAvailable: true },
        { where: { id: booking.vehicleId } }
      );
    }

    const extraTotal = Number(
      (
        booking.fuelCharged +
        booking.damageCharged +
        booking.delayCharge +
        booking.additionalCharges
      ).toFixed(2)
    );
    const chargeResult = await chargeRenterExtras(booking, extraTotal);
    const escrowResult = await releaseEscrowToOwner(booking.id);

    res.json({
      success: true,
      message: chargeResult.pending
        ? 'Rental completed. Extra charges exceed the renter wallet balance and were recorded as outstanding.'
        : 'Rental completed',
      booking: escrowResult.booking || booking,
      extraCharges: { total: extraTotal, ...chargeResult },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await findBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.renterId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (['cancelled', 'completed'].includes(booking.status)) {
      return res.status(409).json({ success: false, message: `Booking is already ${booking.status}` });
    }

    const reason = req.user.role === 'admin' ? 'Cancelled by admin' : 'Cancelled by renter';
    const result = await refundBooking(booking.id, reason);

    // Return vehicle to active and available on cancellation
    await Vehicle.update(
      { status: 'active', isAvailable: true },
      { where: { id: booking.vehicleId } }
    );

    res.json({
      success: true,
      message: result.refunded
        ? 'Booking cancelled and refunded to your wallet'
        : 'Booking cancelled. No payment had been captured.',
      booking: result.booking,
      refunded: Boolean(result.refunded),
    });
  } catch (error) {
    res.status(409).json({ success: false, message: error.message });
  }
};

module.exports = { confirmBooking, startRental, completeRental, cancelBooking };
