'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GDPRConsent = sequelize.define('GDPRConsent', {
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
  consentType: {
    type: DataTypes.ENUM('privacy_policy', 'terms_of_service', 'marketing', 'data_processing', 'gps_tracking'),
    allowNull: false
  },
  isGranted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  grantedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  withdrawnAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: true
  }
}, {
  tableName: 'gdpr_consents',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['consentType'] }
  ]
});

module.exports = GDPRConsent;