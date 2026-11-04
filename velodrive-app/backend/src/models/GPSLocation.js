'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GPSLocation = sequelize.define('GPSLocation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vehicleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'vehicles', key: 'id' }
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'bookings', key: 'id' }
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false
  },
  speed: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true
  },
  heading: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recordedAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'gps_locations',
  timestamps: true,
  indexes: [
    { fields: ['vehicleId'] },
    { fields: ['bookingId'] },
    { fields: ['recordedAt'] }
  ]
});

module.exports = GPSLocation;