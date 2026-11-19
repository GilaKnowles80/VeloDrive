'use strict';

const { Sequelize } = require('sequelize');
const pg = require('pg');
require('dotenv').config();

// Prefer the connection string provided by the Neon Vercel integration.
const rawDbUrl = process.env.NEON_POSTGRES_URL || process.env.DATABASE_URL;
let dbUrl = rawDbUrl;
if (dbUrl) {
  // TLS is configured below; remove URL flags that conflict with pg's SSL parser.
  dbUrl = dbUrl.replace(/[?&](?:channel_binding|sslmode)=[^&]*/gi, '');
  if (!dbUrl.includes('?') && dbUrl.includes('&')) {
    dbUrl = dbUrl.replace('&', '?');
  }
  dbUrl = dbUrl.replace(/&$/, '').replace(/\?$/, '');
}

const common = {
  dialect: 'postgres',
  dialectModule: pg,
  logging: process.env.NODE_ENV === 'production' ? console.log : false,
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
