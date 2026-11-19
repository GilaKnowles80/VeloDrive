'use strict';

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const multerS3 = require('multer-s3');
const { s3Client, useS3 } = require('../services/uploadStorage');

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error('upload mkdir error:', e.message);
  }
};

// Create upload directories safely across local and Vercel production environments
const isProduction = process.env.NODE_ENV === 'production';
const uploadsRoot = isProduction
  ? path.join('/tmp', 'uploads')
  : path.resolve(__dirname, '..', 'uploads');

ensureDir(uploadsRoot);
ensureDir(path.join(uploadsRoot, 'ads'));
ensureDir(path.join(uploadsRoot, 'documents'));
ensureDir(path.join(uploadsRoot, 'profile'));

const storage = useS3
  ? multerS3({
      s3: s3Client,
      bucket: process.env.S3_BUCKET_NAME,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const privateFileFields = ['or', 'proofOfOwnership', 'cr', 'file'];
        const folder = privateFileFields.includes(file.fieldname) ? 'private' : 'media';
        const ext = path.extname(file.originalname);
        cb(null, `${folder}/${req.user.id}/${randomUUID()}${ext}`);
      },
    })
  : multer.memoryStorage();

// Local 60-day Admin Inventory disk storage (routes into profile, documents, or ads)
const localInventoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subFolder = 'ads'; // Default for VIN Tracker / ad campaigns

    if (['profilePicture', 'profile'].includes(file.fieldname)) {
      subFolder = 'profile';
    } else if (['or', 'proofOfOwnership', 'cr', 'file', 'document', 'verificationFile'].includes(file.fieldname)) {
      subFolder = 'documents';
    } else if (['vinTracker', 'adCampaignImage', 'adImages', 'adCampaignVideo'].includes(file.fieldname)) {
      subFolder = 'ads';
    }

    const targetDir = path.join(uploadsRoot, subFolder);
    ensureDir(targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userTag = req.user && req.user.id ? req.user.id : 'anon';
    cb(null, `${file.fieldname}-${userTag}-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
  },
});

const isProfileField = (field) => ['profilePicture', 'profile'].includes(field);
const isAdImageField = (field) => ['adCampaignImage', 'adImages'].includes(field);
const isDocumentField = (field) => ['or', 'proofOfOwnership', 'cr', 'file', 'document', 'verificationFile'].includes(field);
const isVinTrackerField = (field) => ['vinTracker'].includes(field);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (isProfileField(file.fieldname)) {
    const ok = ['.jpeg', '.jpg', '.png', '.webp'].includes(ext) && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (ok) return cb(null, true);
    return cb(new Error('Profile pictures must be JPEG, PNG, or WEBP'), false);
  }

  if (isDocumentField(file.fieldname)) {
    const ok = ext === '.pdf' && file.mimetype === 'application/pdf';
    if (ok) return cb(null, true);
    return cb(new Error('Uploaded documents must be PDF files'), false);
  }

  if (isAdImageField(file.fieldname)) {
    const ok = ['.jpeg', '.jpg', '.png'].includes(ext) && ['image/jpeg', 'image/png'].includes(file.mimetype);
    if (ok) return cb(null, true);
    return cb(new Error('Vehicle ad images must be PNG or JPEG (1–10 images)'), false);
  }

  if (isVinTrackerField(file.fieldname)) {
    const ok = ['.csv', '.xlsx', '.json', '.pdf', '.jpeg', '.jpg', '.png'].includes(ext);
    if (ok) return cb(null, true);
    return cb(new Error('VIN Tracker files must be CSV, XLSX, JSON, PDF, or image files'), false);
  }

  if (file.fieldname === 'adCampaignVideo') {
    const videoMimes = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
    };
    if (videoMimes[ext] === file.mimetype) return cb(null, true);
    return cb(new Error('Vehicle ad videos must be MP4, MOV, or AVI files'), false);
  }

  return cb(new Error('Unsupported vehicle upload file type'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

const localInventoryUpload = multer({
  storage: localInventoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

module.exports = { upload, localInventoryUpload, useS3, s3Client };