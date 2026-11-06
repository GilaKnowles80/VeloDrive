const { Sequelize } = require('sequelize');
require('dotenv').config();

// Support Neon serverless PostgreSQL connection string or individual params.
// IMPORTANT: Use the standard `pg` driver for Sequelize. Do not set `dialectModule`
// to @neondatabase/serverless here — it is not compatible with this Sequelize
// version and can cause "SASL"/connection failures. Neon works over `pg` with SSL.
const rawDbUrl = process.env.DATABASE_URL;
// pg@6 (required for Sequelize 3) can mis-handle Neon URLs with
// `channel_binding=require`, causing SASL/authentication failures. Strip it;
// Neon SSL is enforced via dialectOptions below.
const dbUrl = rawDbUrl
  ? rawDbUrl
      .replace(/([?&])channel_binding=[^&]*(&?)/gi, (_, p, amp) => (p === '?' && amp ? '?' : amp ? p : ''))
      .replace(/[?&]$/, '')
  : rawDbUrl;

const common = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};

const sequelize = dbUrl
  ? new Sequelize(dbUrl, {
      ...common,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'velodrive',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || '',
      {
        ...common,
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
      }
    );

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected successfully');
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
    if (error.original && error.original.message) {
      console.error('Database error detail:', error.original.message);
    }
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };