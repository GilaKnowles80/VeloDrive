'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Vehicle = sequelize.define('Vehicle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'id'
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    field: 'owner_id'
  },
  // Full list of vehicle types supported
  type: {
    type: DataTypes.ENUM(
      'motorcycle', 'car', 'van', 'suv', 'sedan', 'coupe', 'hatchback', 'pickup',
      'off-road', 'sport', 'micro', 'convertible', 'wagon', 'crossover', 'muscle',
      'roadster', 'cabriolet', 'limousine', 'formula 1', 'mini van', 'liftback',
      '10-wheeler truck', 'trailer truck', 'dump truck', 'wheel loader', 'payloaders',
      'boom truck', 'crane', 'other'
    ),
    allowNull: false
  },
  make: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  model: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  color: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  licensePlate: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  vin: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  specifications: {
    type: DataTypes.JSON,
    allowNull: true
  },
  pricePerDay: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  pricePerHour: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'PHP'
  },
  // Original certificates uploaded by owner
  or: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'OR'
  },
  proofOfOwnership: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  cr: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'CR'
  },
  // Marketing ad campaign
  adCampaignTitle: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  adCampaignDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  adCampaignImage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // 1-10 ad image URLs/paths; used by owner ad uploader
  adImages: {
    type: DataTypes.JSON,
    allowNull: true
  },
  adCampaignVideo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // GPS tracking
  gpsDeviceId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  currentLatitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  currentLongitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  lastGpsUpdate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('active', 'en-route', 'inactive', 'maintenance', 'suspended'),
    defaultValue: 'active'
  }
}, {
  tableName: 'vehicles',
  timestamps: true,
  indexes: [
    { fields: ['ownerId'] },
    { fields: ['type'] },
    { fields: ['isAvailable'] },
    { fields: ['isVerified'] },
    { fields: ['status'] }
  ]
});

module.exports = Vehicle;