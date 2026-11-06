const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createVehicle, getOwnerVehicles, getAllVehicles,
  getVehicleById, updateVehicle, updateGPSLocation, getVehicleGPS,
  getGPSHistory
} = require('../controllers/vehicleController');
const { upload } = require('../middleware/upload');

// PUBLIC ROUTE: Allow everyone (including unauthenticated homepage visitors) to browse and filter vehicles
router.get('/', getAllVehicles);

// PROTECTED ROUTES: Require authentication/owner authorization
router.post('/', protect, authorize('owner'), upload.fields([
  { name: 'certificateOfRegistration', maxCount: 1 },
  { name: 'proofOfOwnership', maxCount: 1 },
  { name: 'originalCertificate', maxCount: 1 },
  { name: 'adCampaignImage', maxCount: 1 },
  { name: 'adImages', maxCount: 10 },
  { name: 'adCampaignVideo', maxCount: 1 }
]), createVehicle);

router.get('/my-vehicles', protect, authorize('owner'), getOwnerVehicles);
router.get('/:id', protect, getVehicleById);
router.put('/:id', protect, updateVehicle);
router.post('/:vehicleId/gps', protect, updateGPSLocation);
router.get('/:vehicleId/gps', protect, getVehicleGPS);
router.get('/:vehicleId/gps-history', protect, getGPSHistory);

module.exports = router;