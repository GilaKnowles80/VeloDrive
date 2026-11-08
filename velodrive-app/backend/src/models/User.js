'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  role: {
    type: DataTypes.ENUM('admin', 'owner', 'renter'),
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // Vehicle owner business details (shown alongside vehicle listings)
  companyName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  companyAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contactNumber: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  contactPerson: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  nbiClearance: {
    type: DataTypes.STRING(255), // path to uploaded file
    allowNull: true
  },
  taxCertificate: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  validId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  driversLicense: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  otpCode: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  otpExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  otpLastSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Start of current 10-minute OTP send window'
  },
  otpSendCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'OTP sends in current 10-minute window (max 3)'
  },
  isKycVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  gdprConsent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  gdprConsentDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dataDeletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
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
  paypalEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: { isEmail: true }
  },
  paypalVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  walletBalance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['isActive'] }
  ]
});

module.exports = User;