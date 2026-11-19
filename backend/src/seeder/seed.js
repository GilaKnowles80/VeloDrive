import bcrypt from 'bcryptjs';
import db from '../models/index.js';
import { sequelize } from '../config/database.js';

const { User, Wallet, Vehicle } = db;

const seedDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database. Starting VeloDrive seeder...');

    const defaultPassword = await bcrypt.hash(
      process.env.ADMIN_SEED_PASSWORD || 'VeloDrive2026!',
      10
    );

    // 1. Seed Admin Account
    const adminEmail = process.env.PAYPAL_ADMIN_EMAIL || 'gctravelandtours2021@gmail.com';
    const [admin] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        firstName: 'Gila',
        lastName: 'Knowles',
        email: adminEmail,
        password: defaultPassword,
        role: 'admin',
        phone: '+639170000001',
        isVerified: true,
        gdprConsent: true,
      },
    });

    await Wallet.findOrCreate({
      where: { userId: admin.id },
      defaults: { userId: admin.id, balance: 0.0 },
    });

    // 2. Seed Sample Vehicle Owner
    const ownerEmail = 'owner.demo@gctravelandtour.com';
    const [owner] = await User.findOrCreate({
      where: { email: ownerEmail },
      defaults: {
        firstName: 'Catherine',
        lastName: 'Knowles',
        email: ownerEmail,
        password: defaultPassword,
        role: 'owner',
        phone: '+639170000002',
        paypalEmail: ownerEmail,
        isVerified: true,
        gdprConsent: true,
      },
    });

    await Wallet.findOrCreate({
      where: { userId: owner.id },
      defaults: { userId: owner.id, balance: 0.0 },
    });

    // 3. Seed Sample Renter
    const renterEmail = 'renter.demo@gctravelandtour.com';
    const [renter] = await User.findOrCreate({
      where: { email: renterEmail },
      defaults: {
        firstName: 'Marco',
        lastName: 'Reyes',
        email: renterEmail,
        password: defaultPassword,
        role: 'renter',
        phone: '+639170000003',
        isVerified: true,
        gdprConsent: true,
      },
    });

    await Wallet.findOrCreate({
      where: { userId: renter.id },
      defaults: { userId: renter.id, balance: 5000.0 },
    });

    // 4. Seed Sample Vehicles
    await Vehicle.findOrCreate({
      where: { licensePlate: 'VLD-2026' },
      defaults: {
        ownerId: owner.id,
        type: 'suv',
        make: 'Toyota',
        model: 'Fortuner GR-S',
        year: 2025,
        color: 'Pearl White',
        licensePlate: 'VLD-2026',
        vin: 'MHFBA3FS800123456',
        description: 'Well-maintained 7-seater SUV ideal for family road trips and out-of-town travel. Available for self-drive or with a professional driver.',
        specifications: {
          transmission: 'Automatic',
          fuelType: 'Diesel',
          seats: 7,
          airConditioning: true,
        },
        pricePerDay: 3500.00,
        pricePerHour: 450.00,
        currency: 'PHP',
        or: 'https://placehold.co/600x400?text=OR+Document',
        proofOfOwnership: 'https://placehold.co/600x400?text=Proof+of+Ownership',
        cr: 'https://placehold.co/600x400?text=CR+Document',
        adCampaignTitle: 'Weekend Ready Toyota Fortuner 2025',
        adCampaignDescription: 'Book now with instant confirmation and GPS safety tracking.',
        adCampaignImage: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80',
        adImages: [
          'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1000&q=80'
        ],
        location: 'Quezon City, Metro Manila',
        city: 'Quezon City',
        province: 'Metro Manila',
        driverOption: 'both',
        driverFeePerDay: 800.00,
        isAvailable: true,
        status: 'active',
        isVerified: true,
        verifiedAt: new Date(),
        rating: 4.95,
        totalTrips: 12,
      },
    });

    await Vehicle.findOrCreate({
      where: { licensePlate: 'VLD-8890' },
      defaults: {
        ownerId: owner.id,
        type: 'sedan',
        make: 'Honda',
        model: 'Civic RS Turbo',
        year: 2024,
        color: 'Ignite Red',
        licensePlate: 'VLD-8890',
        vin: 'MRHFE1650PT123789',
        description: 'Fuel-efficient, sleek sport sedan with Apple CarPlay, leather interior, and Honda Sensing.',
        specifications: {
          transmission: 'CVT Automatic',
          fuelType: 'Gasoline',
          seats: 5,
          airConditioning: true,
        },
        pricePerDay: 2500.00,
        pricePerHour: 350.00,
        currency: 'PHP',
        or: 'https://placehold.co/600x400?text=OR+Document',
        proofOfOwnership: 'https://placehold.co/600x400?text=Proof+of+Ownership',
        cr: 'https://placehold.co/600x400?text=CR+Document',
        adCampaignTitle: 'City Cruiser Honda Civic RS',
        adCampaignDescription: 'Smooth daily rates for city driving and business trips.',
        adCampaignImage: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1000&q=80',
        adImages: [
          'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1000&q=80'
        ],
        location: 'Makati City, Metro Manila',
        city: 'Makati',
        province: 'Metro Manila',
        driverOption: 'self-drive',
        driverFeePerDay: 0.00,
        isAvailable: true,
        status: 'active',
        isVerified: true,
        verifiedAt: new Date(),
        rating: 4.88,
        totalTrips: 8,
      },
    });

    console.log('VeloDrive seeding completed successfully!');
    console.log(`Admin Login:  ${adminEmail} / VeloDrive2026!`);
    console.log(`Owner Login:  ${ownerEmail} / VeloDrive2026!`);
    console.log(`Renter Login: ${renterEmail} / VeloDrive2026!`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();