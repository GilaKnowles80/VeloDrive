import { sequelize } from '../config/database.js';

import User from './User.js';
import Vehicle from './Vehicle.js';
import Booking from './Booking.js';
import Transaction from './Transaction.js';
import Wallet from './Wallet.js';
import GDPRConsent from './GDPRConsent.js';
import Document from './Document.js';
import GPSLocation from './GPSLocation.js';
import RefreshToken from './RefreshToken.js';

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
  RefreshToken,
};

export {
  sequelize,
  User,
  Vehicle,
  Booking,
  Transaction,
  Wallet,
  GDPRConsent,
  Document,
  GPSLocation,
  RefreshToken,
};

export default db;