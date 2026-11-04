const bcrypt = require('bcryptjs');
const { User, Wallet } = require('../models');

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'gctravelandtours2021@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

    let admin = await User.findOne({ where: { email: adminEmail } });
    if (admin) {
      console.log('Admin already exists');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    admin = await User.create({
      role: 'admin',
      firstName: 'VeloDrive',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      phone: '+639000000000',
      address: 'VeloDrive Headquarters, Metro Manila, Philippines',
      gdprConsent: true,
      gdprConsentDate: new Date()
    });

    await Wallet.create({ userId: admin.id, balance: 0.00 });

    console.log('✅ Admin user created');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
  }
};

module.exports = { seedAdmin };

if (require.main === module) {
  seedAdmin().then(() => process.exit(0));
}