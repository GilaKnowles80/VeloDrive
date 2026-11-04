'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.ENUM(
      'subscription', 'booking_payment', 'commission', 'owner_payout',
      'refund', 'wallet_topup', 'wallet_withdrawal', 'fuel_charge', 'damage_charge', 'delay_charge'
    ),
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'bookings', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'PHP'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'reversed'),
    defaultValue: 'pending'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['bookingId'] },
    { fields: ['reference'] }
  ]
});

module.exports = Transaction;