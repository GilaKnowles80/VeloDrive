'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { User, Wallet } = require('../models');

const seedAdmin = async () => {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const hasEmailProvider = Boolean(
    process.env.RESEND_API_KEY || (process.env.EMAIL_USER && process.env.EMAIL_PASS)
  );
  const hasResendSender = Boolean(process.env.FROM_EMAIL || process.env.EMAIL_FROM);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set a valid ADMIN_EMAIL in the environment.');
  }
  if (Buffer.byteLength(password, 'utf8') < 16 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be between 16 and 72 UTF-8 bytes.');
  }
  if (!hasEmailProvider || (process.env.RESEND_API_KEY && !hasResendSender)) {
    throw new Error('Configure an email provider and sender before provisioning an admin; admin login requires OTP email.');
  }

  await sequelize.authenticate();

  await sequelize.transaction(async (transaction) => {
    const existing = await User.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existing) {
      if (existing.role !== 'admin') {
        throw new Error('ADMIN_EMAIL already belongs to a non-admin account; refusing to promote it.');
      }

      await Wallet.findOrCreate({
        where: { userId: existing.id },
        defaults: { balance: 0 },
        transaction,
      });
      console.log('Admin account already exists; password and profile were left unchanged.');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const admin = await User.create({
      role: 'admin',
      firstName: process.env.ADMIN_FIRST_NAME || 'Admin',
      lastName: process.env.ADMIN_LAST_NAME || 'Account',
      email,
      password: hashedPassword,
      phone: '',
      address: '',
      isEmailVerified: true,
    }, { transaction });

    await Wallet.create({ userId: admin.id, balance: 0 }, { transaction });
    console.log('Admin account provisioned. Complete the profile after signing in.');
  });
};

if (require.main === module) {
  seedAdmin()
    .catch((error) => {
      console.error('Admin provisioning failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = { seedAdmin };
