'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  vehicleId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'vehicles', key: 'id' }
  },
  type: {
    type: DataTypes.ENUM(
      'certificate_of_registration', 'proof_of_ownership', 'original_certificate',
      'nbi_clearance', 'tax_certificate', 'valid_id', 'drivers_license',
      'ad_campaign_image', 'ad_campaign_video', 'profile_image', 'other'
    ),
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  filePath: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  }
}, {
  tableName: 'documents',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['vehicleId'] },
    { fields: ['type'] },
    { fields: ['isVerified'] }
  ]
});

module.exports = Document;