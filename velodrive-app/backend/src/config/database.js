'use strict';

const { Sequelize } = require('sequelize');
const pg = require('pg');
const { EventEmitter } = require('events');
require('dotenv').config();

// pg v8.x changed query() to return a Promise instead of an EventEmitter (Query).
// Sequelize 6.x expects query() to return an object with .on() AND .rows, .rowCount, etc.
// Patch wraps Promise results in an EventEmitter and copies result properties onto it.
function patchQueryResult(origQuery) {
  return function (...args) {
    const result = origQuery.apply(this, args);
    if (result && typeof result.then === 'function' && !result.on) {
      const emitter = new EventEmitter();
      result.then((res) => {
        if (res && res.rows && Array.isArray(res.rows)) {
          emitter.rows = res.rows;
          emitter.rowCount = res.rowCount;
          emitter.command = res.command;
          emitter.fields = res.fields;
          for (const row of res.rows) {
            emitter.emit('row', row);
          }
        }
        emitter.emit('end', res);
        emitter.emit('result', res);
      }).catch((err) => {
        emitter.emit('error', err);
      });
      return emitter;
    }
    return result;
  };
}

const _originalClientQuery = pg.Client.prototype.query;
const _originalPoolQuery = pg.Pool.prototype.query;
pg.Client.prototype.query = patchQueryResult(_originalClientQuery);
pg.Pool.prototype.query = patchQueryResult(_originalPoolQuery);

// Support Neon serverless PostgreSQL connection string or individual params.
const rawDbUrl = process.env.DATABASE_URL;
const dbUrl = rawDbUrl
  ? rawDbUrl
      .replace(/[?&]channel_binding=[^&]*/gi, '')
      .replace(/&$/, '')
      .replace(/\\\?$/, '')
  : rawDbUrl;

const common = {
  dialect: 'postgres',
  dialectModule: pg,
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
