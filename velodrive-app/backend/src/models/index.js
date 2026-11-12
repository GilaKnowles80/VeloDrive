'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

const User = require('./User');
const Vehicle = require('./Vehicle');
const Booking = require('./Booking');
const Transaction = require('./Transaction');
const Wallet = require('./Wallet');
const GDPRConsent = require('./GDPRConsent');
const Document = require('./Document');
const GPSLocation = require('./GPSLocation');
const RefreshToken = require('./RefreshToken');

// Associations
User.hasMany(Vehicle, { foreignKey: 'ownerId', as: 'vehicles', onDelete: 'CASCADE' });
Vehicle.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

User.hasMany(Booking, { foreignKey: 'renterId', onDelete: 'CASCADE' });
User.hasMany(Booking, { foreignKey: 'ownerId', onDelete: 'CASCADE' });
Booking.belongsTo(User, { foreignKey: 'renterId', as: 'renter' });
Booking.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

Vehicle.hasMany(Booking, { foreignKey: 'vehicleId', onDelete: 'CASCADE' });
Booking.belongsTo(Vehicle, { foreignKey: 'vehicleId' });

User.hasMany(Transaction, { foreignKey: 'userId', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

Booking.hasMany(Transaction, { foreignKey: 'bookingId', onDelete: 'SET NULL' });
Transaction.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

User.hasOne(Wallet, { foreignKey: 'userId', onDelete: 'CASCADE' });
Wallet.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(GDPRConsent, { foreignKey: 'userId', onDelete: 'CASCADE' });
GDPRConsent.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Document, { foreignKey: 'userId', onDelete: 'CASCADE' });
Document.belongsTo(User, { foreignKey: 'userId' });

Vehicle.hasMany(Document, { foreignKey: 'vehicleId', onDelete: 'SET NULL' });
Document.belongsTo(Vehicle, { foreignKey: 'vehicleId' });

Vehicle.hasMany(GPSLocation, { foreignKey: 'vehicleId', onDelete: 'CASCADE' });
GPSLocation.belongsTo(Vehicle, { foreignKey: 'vehicleId' });

Booking.hasMany(GPSLocation, { foreignKey: 'bookingId', onDelete: 'SET NULL' });
GPSLocation.belongsTo(Booking, { foreignKey: 'bookingId' });

User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

const db = {
  sequelize,
  User,
  Vehicle,
  Booking,
  Transaction,
  Wallet,
  GDPRConsent,
  Document,
  GPSLocation,
  RefreshToken
};

module.exports = db;