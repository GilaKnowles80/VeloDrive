'use strict';

const { sequelize } = require('../config/database');

const runMigrations = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Align users table legacy columns with Sequelize User model
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS "id" UUID,
      ADD COLUMN IF NOT EXISTS "firstName" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "lastName" VARCHAR(100),
      ADD COLUMN IF NOT EXISTS "password" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20) DEFAULT '',
      ADD COLUMN IF NOT EXISTS "address" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS paypal_verified BOOLEAN DEFAULT FALSE;
    `);

    // Backfill any nulls on existing rows from legacy columns
    await sequelize.query(`
      UPDATE users SET "id" = user_id WHERE "id" IS NULL AND user_id IS NOT NULL;
      UPDATE users SET "firstName" = first_name WHERE "firstName" IS NULL AND first_name IS NOT NULL;
      UPDATE users SET "lastName" = last_name WHERE "lastName" IS NULL AND last_name IS NOT NULL;
      UPDATE users SET "password" = password_hash WHERE "password" IS NULL AND password_hash IS NOT NULL;
      UPDATE users SET "phone" = '+639154401150' WHERE "phone" IS NULL OR "phone" = '';
      UPDATE users SET "address" = 'VeloDrive Headquarters, Metro Manila, Philippines' WHERE "address" IS NULL OR "address" = '';
      UPDATE users SET "createdAt" = COALESCE(created_at, NOW()) WHERE "createdAt" IS NULL;
      UPDATE users SET "updatedAt" = COALESCE(updated_at, NOW()) WHERE "updatedAt" IS NULL;
    `);

    // Ensure "id" has a unique constraint so foreign keys can reference it
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_id_unique'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_id_unique UNIQUE ("id");
        END IF;
      END $$;
    `);
    console.log('✅ Users table aligned with unique id constraint');

    // Ensure vehicles table has unique id constraint
    await sequelize.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "id" UUID DEFAULT gen_random_uuid();
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_id_unique'
        ) THEN
          ALTER TABLE vehicles ADD CONSTRAINT vehicles_id_unique UNIQUE ("id");
        END IF;
      END $$;
    `);
    console.log('✅ Vehicles table aligned with unique id constraint');

    // Ensure bookings table has unique id constraint
    await sequelize.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "id" UUID DEFAULT gen_random_uuid();
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bookings_id_unique'
        ) THEN
          ALTER TABLE bookings ADD CONSTRAINT bookings_id_unique UNIQUE ("id");
        END IF;
      END $$;
    `);
    console.log('✅ Bookings table aligned with unique id constraint');

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
