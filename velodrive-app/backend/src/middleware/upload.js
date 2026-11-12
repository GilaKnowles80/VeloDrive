'use strict';

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// Check if S3 is configured (for production/Vercel)
const useS3 = process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY;

let s3Client = null;
if (useS3) {
  s3Client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error('upload mkdir error:', e.message);
  }
};

// Create upload directories only in non-production environments to avoid Vercel read-only filesystem errors
const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
if (process.env.NODE_ENV !== 'production') {
  ensureDir(uploadsRoot);
  ensureDir(path.resolve(uploadsRoot, 'ads'));
  ensureDir(path.resolve(uploadsRoot, 'documents'));
  ensureDir(path.resolve(uploadsRoot, 'profile'));
}

const storage = useS3
  ? multerS3({
      s3: s3Client,
      bucket: process.env.S3_BUCKET_NAME,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const folder = req.body.folder || 'documents';
        const ext = path.extname(file.originalname);
        const filename = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, filename);
      },
    })
  : multer.memoryStorage();

const isAdImageField = (field) => ['adCampaignImage', 'adImages'].includes(field);

const fileFilter = (req, file, cb) => {
  if (isAdImageField(file.fieldname)) {
    const ok = /jpeg|jpg|png/.test(path.extname(file.originalname).toLowerCase()) && /image\/(jpeg|png)/.test(file.mimetype);
    if (ok) return cb(null, true);
    return cb(new Error('Vehicle ad images must be PNG or JPEG (1–10 images)'), false);
  }

  const allowed = /jpeg|jpg|png|pdf|mp4|mov|avi|doc|docx/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only images, PDFs, and videos are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter
});

module.exports = { upload, useS3, s3Client };