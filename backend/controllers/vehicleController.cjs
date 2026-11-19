import { Op } from 'sequelize';
import db from '../models/index.js';
import { fileToStorageValue, serializeVehicle } from '../services/uploadStorage.js';

const { Vehicle, GPSLocation, User } = db;

const OWNER_ATTRS = ['id', 'firstName', 'lastName', 'email', 'phone', 'address', 'companyName', 'companyAddress', 'contactNumber', 'contactPerson'];
const PRIVATE_VEHICLE_FILE_FIELDS = ['or', 'proofOfOwnership', 'cr'];

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

const firstFile = (files, field) => fileToStorageValue(files?.[field]?.[0]);

const normalizeType = (raw) => {
  if (!raw) return null;
  const candidate = String(raw).trim().toLowerCase();
  return VEHICLE_TYPES.includes(candidate) ? candidate : null;
};

export const createVehicle = async (req, res) => {
  try {
    const missing = ['type', 'make', 'model', 'year', 'color', 'licensePlate', 'pricePerDay']
      .filter((field) => String(req.body[field] ?? '').trim() === '');
    if (