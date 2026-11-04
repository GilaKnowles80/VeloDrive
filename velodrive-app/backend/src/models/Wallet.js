'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'users', key: 'id' }
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'PHP'
  },
  // Linked bank account for withdrawals
  bankAccountName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  bankAccountNumber: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bankName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'wallets',
  timestamps: true
});

module.exports = Wallet;