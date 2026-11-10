const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createVehicle,
  getOwnerVehicles,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  updateGPSLocation,
  getVehicleGPS,
  getGPSHistory,
  updateVehicleStatus,
} = require('../controllers/vehicleController');
const { upload } = require('../middleware/upload');

const vehicleUpload = upload.fields([
  { name: 'or', maxCount: 1 },
  { name: 'proofOfOwnership', maxCount: 1 },
  { name: 'cr', maxCount: 1 },
  { name: 'adCampaignImage', maxCount: 1 },
  { name: 'adImages', maxCount: 10 },
  { name: 'adCampaignVideo', maxCount: 1 },
]);

// Turn multer failures into a 4xx with a usable message instead of a generic 500.
const handleVehicleUpload = (req, res, next) => {
  vehicleUpload(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'File too large. Maximum size is 50MB.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ success: false, message: `Unexpected file field: ${error.field}` });
    }
    return res.status(400).json({ success: false, message: error.message || 'Upload failed' });
  });
};

// Public: browse verified listings (?type=&search= supported)
router.get('/', getAllVehicles);

// Owner: create a listing
router.post('/', protect, authorize('owner'), handleVehicleUpload, createVehicle);

// Owner: own listings
router.get('/my-vehicles', protect, authorize('owner'), getOwnerVehicles);

// Authenticated: single vehicle (owner/admin may see unverified)
router.get('/:id', protect, getVehicleById);
router.put('/:id', protect, updateVehicle);

// Owner/admin: manually set vehicle status (active / en-route / maintenance / suspended)
router.put('/:id/status', protect, updateVehicleStatus);

// Owner/admin: GPS write + read
router.post('/:vehicleId/gps', protect, authorize('owner', 'admin'), updateGPSLocation);
router.get('/:vehicleId/gps', protect, authorize('owner', 'admin'), getVehicleGPS);
router.get('/:vehicleId/gps-history', protect, authorize('owner', 'admin'), getGPSHistory);

module.exports = router;
