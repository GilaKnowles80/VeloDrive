'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bookingReference: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  vehicleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'vehicles', key: 'id' }
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  renterId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  // Rental details from renter form
  rentalStartDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  rentalEndDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  numberOfDays: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pickupPoint: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  returnPoint: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  destinationPoint: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // Pricing
  basePrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  commissionPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 10.00
  },
  commissionAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  platformFee: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'PHP'
  },
  // Payment / escrow status
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'held_in_escrow', 'released_to_owner', 'refunded', 'failed'),
    defaultValue: 'pending'
  },
  escrowStatus: {
    type: DataTypes.ENUM('not_held', 'held', 'released', 'refunded'),
    defaultValue: 'not_held'
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // PayPal order id, persisted so payment can be captured when the buyer returns
  paypalOrderId: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Service charge (flat Php 250) deducted by Admin
  serviceChargeAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 250.00
  },
  // Owner payout = totalAmount - serviceChargeAmount
  ownerPayout: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  // Net vehicle owner's setup payment (what owner receives before admin Opex)
  ownerNetAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  // 10% service charge fee charged on top of owner net amount
  serviceChargeFee: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 'confirmed', 'active', 'completed', 'cancelled', 'disputed'
    ),
    defaultValue: 'pending'
  },
  // Renter responsibilities
  fuelCharged: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  damageCharged: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  delayHours: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  delayCharge: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  additionalCharges: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  // Timestamps
  actualReturnDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  indexes: [
    { fields: ['vehicleId'] },
    { fields: ['ownerId'] },
    { fields: ['renterId'] },
    { fields: ['status'] },
    { fields: ['paymentStatus'] },
    { fields: ['bookingReference'] }
  ]
});

module.exports = Booking;
