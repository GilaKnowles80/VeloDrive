require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { User, Wallet } = require('../models');

const seedAdmin = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    await sequelize.sync({ alter: { drop: false } });
    console.log('📦 Database models synchronized');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables before seeding. Do not hardcode credentials.');
    }

    let admin = await User.findOne({ where: { email: adminEmail } });
    if (admin) {
      console.log('Admin already exists');
      await sequelize.close();
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    admin = await User.create({
      role: 'admin',
      firstName: 'Gila',
      lastName: 'Knowles',
      email: 'gila.velodrive@gctravelandtour.com',
      password: hashedPassword,
      phone: '+639154401150',
      address: 'VeloDrive Headquarters, Metro Manila, Philippines',
      gdprConsent: true,
      gdprConsentDate: new Date(),
      isEmailVerified: true
    });

    await Wallet.create({ userId: admin.id, balance: 0.00 });

    console.log('✅ Admin user created');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

module.exports = { seedAdmin };

if (require.main === module) {
  seedAdmin().then(() => process.exit(0));
}