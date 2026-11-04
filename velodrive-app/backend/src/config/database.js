const { Sequelize } = require('sequelize');
require('dotenv').config();

// Support Neon serverless PostgreSQL connection string or individual params
const dbUrl = process.env.DATABASE_URL; // e.g. postgres://user:pass@ep-xxx.us-east-1.aws.neon.tech/veodrive?sslmode=require

const sequelize = new Sequelize(
  dbUrl || process.env.DB_NAME || 'veodrive',
  dbUrl ? undefined : process.env.DB_USER || 'postgres',
  dbUrl ? undefined : process.env.DB_PASSWORD || 'your_password',
  {
    host: dbUrl ? undefined : process.env.DB_HOST || 'localhost',
    port: dbUrl ? undefined : (process.env.DB_PORT || 5432),
    dialect: 'postgres',
    dialectModule: dbUrl ? require('@neondatabase/serverless') : require('pg'),
    dialectOptions: dbUrl ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected successfully');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };