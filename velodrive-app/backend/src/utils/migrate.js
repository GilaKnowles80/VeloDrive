'use strict';

const { sequelize } = require('../config/database');

const runMigrations = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Add paypalEmail and paypalVerified to users table
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS paypal_verified BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Added paypal_email and paypal_verified to users table');

    // Add serviceChargeAmount and ownerPayout to bookings table
    await sequelize.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS service_charge_amount DECIMAL(12, 2) DEFAULT 250.00,
      ADD COLUMN IF NOT EXISTS owner_payout DECIMAL(12, 2) DEFAULT 0.00;
    `);
    console.log('✅ Added service_charge_amount and owner_payout to bookings table');

    console.log('✅ All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
};

runMigrations();
