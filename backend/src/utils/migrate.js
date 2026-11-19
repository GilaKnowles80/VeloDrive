'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, connectDB } = require('../config/database');
const {
  Booking,
  Transaction,
  Wallet,
  GDPRConsent,
  Document,
  GPSLocation,
  RefreshToken,
} = require('../models');

const requiredTables = [
  ['bookings', Booking],
  ['transactions', Transaction],
  ['wallets', Wallet],
  ['gdpr_consents', GDPRConsent],
  ['documents', Document],
  ['gps_locations', GPSLocation],
  ['refresh_tokens', RefreshToken],
];

const validateBaseSchema = async (transaction) => {
  const [baseTables] = await sequelize.query(
    `SELECT
       to_regclass('public.users') IS NOT NULL AS users_exist,
       to_regclass('public.vehicles') IS NOT NULL AS vehicles_exist,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'vehicles'
           AND column_name = 'owner_id'
       ) AS vehicle_owner_id_exists`,
    { transaction, type: QueryTypes.SELECT }
  );

  if (!baseTables.users_exist || !baseTables.vehicles_exist) {
    throw new Error('Expected public.users and public.vehicles to exist; no schema changes were made.');
  }

  if (!baseTables.vehicle_owner_id_exists) {
    throw new Error('Expected public.vehicles.owner_id; no schema changes were made.');
  }
};

const runMigrations = async () => {
  await connectDB();

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      'SELECT pg_advisory_xact_lock(8754301, 20261113)',
      { transaction }
    );
    await validateBaseSchema(transaction);

    for (const [tableName, model] of requiredTables) {
      const [tableState] = await sequelize.query(
        'SELECT to_regclass(:tableName) IS NOT NULL AS table_exists',
        {
          replacements: { tableName: `public.${tableName}` },
          transaction,
          type: QueryTypes.SELECT,
        }
      );

      if (tableState.table_exists) {
        console.log(`Skipping existing table public.${tableName}`);
        continue;
      }

      await model.sync({
        schema: 'public',
        force: false,
        alter: false,
        transaction,
      });
      console.log(`Created public.${tableName}`);
    }
  });

  console.log('Database migration completed. Existing tables were not altered.');
};

if (require.main === module) {
  runMigrations()
    .catch((error) => {
      console.error('Database migration failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { runMigrations };
