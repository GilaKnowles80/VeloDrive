'use strict';

const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const S3_REFERENCE_PREFIX = 's3://';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const PRIVATE_VEHICLE_FIELDS = ['or', 'proofOfOwnership', 'cr'];
const VEHICLE_MEDIA_FIELDS = ['adCampaignImage', 'adCampaignVideo'];

const bucket = process.env.S3_BUCKET_NAME;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const hasS3Settings = Boolean(bucket || accessKeyId || secretAccessKey);

if (hasS3Settings && (!bucket || !accessKeyId || !secretAccessKey)) {
  throw new Error('S3_BUCKET_NAME, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY must be configured together');
}

const useS3 = Boolean(bucket && accessKeyId && secretAccessKey);
const s3Client = useS3
  ? new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

const fileToStorageValue = (file) => {
  if (!file) return null;
  if (file.key) return `${S3_REFERENCE_PREFIX}${file.key}`;
  if (!file.buffer) throw new Error('Uploaded file has no S3 key or in-memory buffer');

  const mime = file.mimetype || 'application/octet-stream';
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
};

const signStorageValue = async (value) => {
  if (typeof value !== 'string' || !value.startsWith(S3_REFERENCE_PREFIX)) return value;
  if (!useS3) throw new Error('Cannot sign an S3 object URL because S3 is not configured');

  const key = value.slice(S3_REFERENCE_PREFIX.length);
  if (!key) throw new Error('Stored S3 object reference is missing its key');

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: SIGNED_URL_TTL_SECONDS }
  );
};

const signArrayField = async (value) => {
  if (Array.isArray(value)) return Promise.all(value.map(signStorageValue));
  if (typeof value !== 'string') return value;

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return signStorageValue(value);
  }

  if (Array.isArray(parsed)) {
    return JSON.stringify(await Promise.all(parsed.map(signStorageValue)));
  }

  return signStorageValue(value);
};

const serializeVehicle = async (vehicle, { includePrivate = false } = {}) => {
  const result = typeof vehicle.toJSON === 'function' ? vehicle.toJSON() : { ...vehicle };

  if (!includePrivate) {
    PRIVATE_VEHICLE_FIELDS.forEach((field) => delete result[field]);
  } else {
    await Promise.all(PRIVATE_VEHICLE_FIELDS.map(async (field) => {
      result[field] = await signStorageValue(result[field]);
    }));
  }

  await Promise.all(VEHICLE_MEDIA_FIELDS.map(async (field) => {
    result[field] = await signStorageValue(result[field]);
  }));
  result.adImages = await signArrayField(result.adImages);

  return result;
};

const serializeDocument = async (document) => {
  const result = typeof document.toJSON === 'function' ? document.toJSON() : { ...document };
  result.filePath = await signStorageValue(result.filePath);
  return result;
};

module.exports = {
  fileToStorageValue,
  serializeDocument,
  serializeVehicle,
  s3Client,
  useS3,
};
