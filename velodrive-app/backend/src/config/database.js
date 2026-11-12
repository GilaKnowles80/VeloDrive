'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Support Neon serverless PostgreSQL connection string or individual params.
const rawDbUrl = process.env.DATABASE_URL;
let dbUrl = rawDbUrl;
if (dbUrl) {
  // Remove channel_binding param (Neon-specific, not needed by Sequelize/pg)
  dbUrl = dbUrl.replace(/[?&]channel_binding=[^&]*/gi, '');
  // If channel_binding was the first param, the '?' was consumed; restore it
  if (!dbUrl.includes('?') && dbUrl.includes('&')) {
    dbUrl = dbUrl.replace('&', '?');
  }
  dbUrl = dbUrl.replace(/&$/, '').replace(/\?$/, '');
}

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
    throw error;
  }
};

module.exports = { sequelize, connectDB };
