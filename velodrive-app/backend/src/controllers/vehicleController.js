const { Vehicle, Document } = require('../models');

const createVehicle = async (req, res) => {
  try {
    const {
      type, make, model, year, color, licensePlate, vin, description,
      specifications, pricePerDay, pricePerHour, currency,
      adCampaignTitle, adCampaignDescription, gpsDeviceId
    } = req.body;

    const vehicle = await Vehicle.create({
      ownerId: req.user.id,
      type,
      make,
      model,
      year,
      color,
      licensePlate,
      vin,
      description,
      specifications: specifications ? JSON.parse(specifications) : null,
      pricePerDay,
      pricePerHour: pricePerHour || 0,
      currency: currency || 'PHP',
      adCampaignTitle,
      adCampaignDescription,
      gpsDeviceId,
      certificateOfRegistration: req.files?.certificateOfRegistration?.[0]?.path || null,
      proofOfOwnership: req.files?.proofOfOwnership?.[0]?.path || null,
      originalCertificate: req.files?.originalCertificate?.[0]?.path || null,
      adCampaignImage: req.files?.adCampaignImage?.[0]?.path || null,
      adCampaignVideo: req.files?.adCampaignVideo?.[0]?.path || null
    });

    res.status(201).json({ success: true, message: 'Vehicle created', vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOwnerVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({ where: { ownerId: req.user.id } });
    res.json({ success: true, vehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.findAll({
      where: { isAvailable: true, status: 'active', isVerified: true },
      include: [{ model: require('../models').User, as: 'owner', attributes: ['firstName', 'lastName', 'email', 'phone'] }]
    });
    res.json({ success: true, vehicles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (vehicle.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await vehicle.update(req.body);
    res.json({ success: true, message: 'Vehicle updated', vehicle });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateGPSLocation = async (req, res) => {
  try {
    const { latitude, longitude, speed, heading, address, bookingId } = req.body;
    const { vehicleId } = req.params;

    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    await vehicle.update({
      currentLatitude: latitude,
      currentLongitude: longitude,
      lastGpsUpdate: new Date()
    });

    const { GPSLocation } = require('../models');
    await GPSLocation.create({
      vehicleId,
      bookingId,
      latitude,
      longitude,
      speed,
      heading,
      address,
      recordedAt: new Date()
    });

    res.json({ success: true, message: 'GPS location updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getVehicleGPS = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const locations = await GPSLocation.findAll({
      where: { vehicleId },
      order: [['recordedAt', 'DESC']],
      limit: 1
    });
    res.json({ success: true, gps: locations[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getGPSHistory = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { limit = 100 } = req.query;
    const locations = await GPSLocation.findAll({
      where: { vehicleId },
      order: [['recordedAt', 'DESC']],
      limit: parseInt(limit)
    });
    res.json({ success: true, history: locations });
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
  getGPSHistory
};