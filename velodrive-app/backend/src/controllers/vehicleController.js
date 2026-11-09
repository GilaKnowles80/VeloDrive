const { Vehicle, GPSLocation, User } = require('../models');

const OWNER_ATTRS = ['id', 'firstName', 'lastName', 'email', 'phone', 'address', 'companyName', 'companyAddress', 'contactNumber', 'contactPerson'];

const VEHICLE_TYPES = [
  'motorcycle', 'car', 'van', 'suv', 'sedan', 'coupe', 'hatchback', 'pickup',
  'off-road', 'sport', 'micro', 'convertible', 'wagon', 'crossover', 'muscle',
  'roadster', 'cabriolet', 'limousine', 'formula 1', 'mini van', 'liftback',
  '10-wheeler truck', 'trailer truck', 'dump truck', 'wheel loader', 'payloaders',
  'boom truck', 'crane', 'other',
];

// Fields an owner may change on their own vehicle.
const OWNER_EDITABLE_FIELDS = [
  'make', 'model', 'year', 'color', 'licensePlate', 'vin', 'description',
  'specifications', 'pricePerDay', 'pricePerHour', 'currency',
  'adCampaignTitle', 'adCampaignDescription', 'adCampaignImage', 'adImages',
  'adCampaignVideo', 'gpsDeviceId', 'isAvailable',
];

// Fields only an admin may change.
const ADMIN_ONLY_FIELDS = ['isVerified', 'status'];

const pick = (source, keys) =>
  keys.reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});

// Convert a multer memory-storage file to a base64 data URL (works on Vercel read-only FS)
const fileToDataUrl = (file) => {
  if (!file) return null;
  const mime = file.mimetype || 'application/octet-stream';
  const base64 = file.buffer.toString('base64');
  return `data:${mime};base64,${base64}`;
};

const firstFile = (files, field) => fileToDataUrl(files?.[field]?.[0]);

const normalizeType = (raw) => {
  if (!raw) return null;
  const candidate = String(raw).trim().toLowerCase();
  return VEHICLE_TYPES.includes(candidate) ? candidate : null;
};

const createVehicle = async (req, res) => {
  try {
    const missing = ['type', 'make', 'model', 'year', 'color', 'licensePlate', 'description', 'pricePerDay']
      .filter((field) => String(req.body[field] ?? '').trim() === '');
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    const type = normalizeType(req.body.type);
    if (!type) {
      return res.status(400).json({ success: false, message: 'Unsupported vehicle type' });
    }

    const requiredDocs = ['certificateOfRegistration', 'proofOfOwnership', 'originalCertificate'];
    const missingDocs = requiredDocs.filter((field) => !firstFile(req.files, field));
    if (missingDocs.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required documents: ${missingDocs.join(', ')}`,
      });
    }

    const adImages = (req.files?.adImages || []).slice(0, 10)
      .map((file) => fileToDataUrl(file))
      .filter(Boolean);

    let specifications = null;
    if (req.body.specifications) {
      try {
        specifications = typeof req.body.specifications === 'string'
          ? JSON.parse(req.body.specifications)
          : req.body.specifications;
      } catch {
        return res.status(400).json({ success: false, message: 'specifications must be valid JSON' });
      }
    }

    let adDescriptions = [];
    if (req.body.adImageDescriptions) {
      try {
        const parsed = JSON.parse(req.body.adImageDescriptions);
        if (Array.isArray(parsed)) adDescriptions = parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
      } catch {
        adDescriptions = [];
      }
    }

    const vehicle = await Vehicle.create({
      ownerId: req.user.id,
      type,
      make: req.body.make,
      model: req.body.model,
      year: req.body.year,
      color: req.body.color,
      licensePlate: req.body.licensePlate,
      vin: req.body.vin || null,
      description: req.body.description,
      specifications,
      pricePerDay: req.body.pricePerDay,
      pricePerHour: req.body.pricePerHour || 0,
      currency: req.body.currency || 'PHP',
      adCampaignTitle: req.body.adCampaignTitle || null,
      adCampaignDescription: req.body.adCampaignDescription || adDescriptions[0] || null,
      gpsDeviceId: req.body.gpsDeviceId || null,
      certificateOfRegistration: firstFile(req.files, 'certificateOfRegistration'),
      proofOfOwnership: firstFile(req.files, 'proofOfOwnership'),
      originalCertificate: firstFile(req.files, 'originalCertificate'),
      adCampaignImage: adImages[0] || firstFile(req.files, 'adCampaignImage'),
      adImages: adImages.length ? adImages : null,
      adCampaignVideo: firstFile(req.files, 'adCampaignVideo'),
      isVerified: false,
      status: 'active',
    });

    res.status(201).json({ success: true, message: 'Vehicle submitted for verification', vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOwnerVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      where: { ownerId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, vehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Public browse endpoint used by the homepage and the vehicle list.
 * Only verified, active, available vehicles are exposed.
 */
const getAllVehicles = async (req, res) => {
  try {
    const where = { isAvailable: true, status: 'active', isVerified: true };

    const type = normalizeType(req.query.type);
    if (type) where.type = type;

    if (req.query.search) {
      const { Op } = require('sequelize');
      const term = `%${String(req.query.search).trim()}%`;
      where[Op.or] = [
        { make: { [Op.iLike]: term } },
        { model: { [Op.iLike]: term } },
        { description: { [Op.iLike]: term } },
      ];
    }

    const vehicles = await Vehicle.findAll({
      where,
      include: [{ model: User, as: 'owner', attributes: OWNER_ATTRS }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    res.json({ success: true, count: vehicles.length, vehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: OWNER_ATTRS }],
    });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const isOwner = vehicle.ownerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin && (!vehicle.isVerified || vehicle.status !== 'active')) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.json({ success: true, vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const isOwner = vehicle.ownerId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Whitelisted updates only — isVerified/status stay admin-controlled.
    const updates = pick(req.body, OWNER_EDITABLE_FIELDS);
    if (isAdmin) Object.assign(updates, pick(req.body, ADMIN_ONLY_FIELDS));

    if (updates.type !== undefined) {
      const type = normalizeType(updates.type);
      if (!type) return res.status(400).json({ success: false, message: 'Unsupported vehicle type' });
      updates.type = type;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No updatable fields supplied' });
    }

    await vehicle.update(updates);
    res.json({ success: true, message: 'Vehicle updated', vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const canManageVehicle = async (vehicleId, user) => {
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) return { vehicle: null, allowed: false };
  const allowed = vehicle.ownerId === user.id || user.role === 'admin';
  return { vehicle, allowed };
};

const updateGPSLocation = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { latitude, longitude, speed, heading, address, bookingId } = req.body;

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ success: false, message: 'latitude/longitude are required and must be valid coordinates' });
    }

    const { vehicle, allowed } = await canManageVehicle(vehicleId, req.user);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });

    await vehicle.update({
      currentLatitude: lat,
      currentLongitude: lng,
      lastGpsUpdate: new Date(),
    });

    await GPSLocation.create({
      vehicleId: vehicle.id,
      bookingId: bookingId || null,
      latitude: lat,
      longitude: lng,
      speed: Number.isFinite(Number(speed)) ? Number(speed) : null,
      heading: Number.isFinite(Number(heading)) ? Number(heading) : null,
      address: address || null,
      recordedAt: new Date(),
    });

    res.json({ success: true, message: 'GPS location updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVehicleGPS = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { vehicle, allowed } = await canManageVehicle(vehicleId, req.user);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });

    const latest = await GPSLocation.findOne({
      where: { vehicleId: vehicle.id },
      order: [['recordedAt', 'DESC']],
    });

    res.json({ success: true, gps: latest || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getGPSHistory = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { vehicle, allowed } = await canManageVehicle(vehicleId, req.user);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (!allowed) return res.status(403).json({ success: false, message: 'Not authorized' });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

    const history = await GPSLocation.findAll({
      where: { vehicleId: vehicle.id },
      order: [['recordedAt', 'DESC']],
      limit,
    });

    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createVehicle,
  getOwnerVehicles,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  updateGPSLocation,
  getVehicleGPS,
  getGPSHistory,
};
