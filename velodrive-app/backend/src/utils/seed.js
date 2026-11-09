require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { User, Wallet, Vehicle } = require('../models');

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
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      admin = await User.create({
        role: 'admin',
        firstName: 'Gila',
        lastName: 'Knowles',
        email: adminEmail,
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
    }

    await seedSampleAd(admin);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

const seedSampleAd = async (admin) => {
  try {
    const sampleEmail = process.env.SAMPLE_OWNER_EMAIL || 'sample.owner@velodrive.test';
    const samplePassword = process.env.SAMPLE_OWNER_PASSWORD || 'SampleOwner123!';

    let owner = await User.findOne({ where: { email: sampleEmail } });
    if (!owner) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(samplePassword, salt);
      owner = await User.create({
        role: 'owner',
        firstName: 'Sample',
        lastName: 'Owner',
        email: sampleEmail,
        password: hashedPassword,
        phone: '+639000000000',
        address: 'Sample Address, Metro Manila, Philippines',
        companyName: 'Sample Vehicle Rentals',
        companyAddress: 'Sample Address, Metro Manila, Philippines',
        contactNumber: '+639000000000',
        contactPerson: 'Sample Owner',
        gdprConsent: true,
        gdprConsentDate: new Date(),
        isEmailVerified: true,
        isKycVerified: true
      });
      await Wallet.create({ userId: owner.id, balance: 0.00 });
      console.log('✅ Sample owner created:', sampleEmail);
    } else {
      console.log('Sample owner already exists:', sampleEmail);
    }

    const existing = await Vehicle.findOne({ where: { ownerId: owner.id, adCampaignTitle: { [Op.iLike]: '%sample ad%' } } });
    if (existing) {
      console.log('Sample ad already exists');
      return;
    }

    await Vehicle.create({
      ownerId: owner.id,
      type: 'car',
      make: 'Toyota',
      model: 'Vios',
      year: 2023,
      color: 'White',
      licensePlate: 'SAMPLE-001',
      vin: 'SAMPLEVIN0012023',
      description: 'Sample Ad — Demo vehicle for testing the VeloDrive booking and checkout flow. This is a sample listing; real owner ads will appear separately.',
      specifications: { transmission: 'Automatic', seats: 5, fuel: 'Gasoline', driveType: 'Self-drive' },
      pricePerDay: 1500.00,
      pricePerHour: 200.00,
      currency: 'PHP',
      certificateOfRegistration: 'https://via.placeholder.com/150/cccccc/000000?text=CR+Sample',
      proofOfOwnership: 'https://via.placeholder.com/150/cccccc/000000?text=PO+Sample',
      originalCertificate: 'https://via.placeholder.com/150/cccccc/000000?text=OC+Sample',
      adCampaignTitle: 'Sample Ad — Toyota Vios 2023',
      adCampaignDescription: 'Demo vehicle for testing. Clean, well-maintained sedan. Self-drive. Includes basic insurance.',
      adCampaignImage: 'https://via.placeholder.com/400x300/cccccc/000000?text=Sample+Ad+Vehicle',
      adImages: ['https://via.placeholder.com/400x300/cccccc/000000?text=Sample+Ad+Vehicle'],
      isAvailable: true,
      isVerified: true,
      status: 'active'
    });

    console.log('✅ Sample ad created: Sample Ad — Toyota Vios 2023 (verified, active)');
  } catch (error) {
    console.error('❌ Sample ad seed error:', error.message);
  }
};

module.exports = { seedAdmin, seedSampleAd };

if (require.main === module) {
  seedAdmin().then(() => process.exit(0));
}