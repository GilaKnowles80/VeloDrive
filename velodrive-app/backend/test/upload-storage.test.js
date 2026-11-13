'use strict';

process.env.S3_BUCKET_NAME = 'vehicle-portfolio-uploader';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'test-access-key';
process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';

const assert = require('node:assert/strict');
const test = require('node:test');
const { fileToStorageValue, serializeVehicle } = require('../src/services/uploadStorage');

test('stores S3 keys as references and keeps memory uploads as data URLs', () => {
  assert.equal(
    fileToStorageValue({ key: 'private/user-id/document.pdf' }),
    's3://private/user-id/document.pdf'
  );
  assert.equal(
    fileToStorageValue({ buffer: Buffer.from('file'), mimetype: 'text/plain' }),
    `data:text/plain;base64,${Buffer.from('file').toString('base64')}`
  );
});

test('signs media URLs while excluding private vehicle documents from public responses', async () => {
  const vehicle = {
    or: 's3://private/user-id/or.pdf',
    proofOfOwnership: 's3://private/user-id/proof.pdf',
    cr: 's3://private/user-id/cr.pdf',
    adCampaignImage: 's3://media/user-id/ad.jpg',
    adImages: ['s3://media/user-id/ad.jpg'],
  };

  const publicVehicle = await serializeVehicle(vehicle);
  assert.equal('or' in publicVehicle, false);
  assert.equal('proofOfOwnership' in publicVehicle, false);
  assert.equal('cr' in publicVehicle, false);
  assert.match(publicVehicle.adCampaignImage, /X-Amz-Signature=/);
  assert.match(publicVehicle.adImages[0], /X-Amz-Signature=/);

  const ownerVehicle = await serializeVehicle(vehicle, { includePrivate: true });
  assert.match(ownerVehicle.or, /X-Amz-Signature=/);
  assert.match(ownerVehicle.proofOfOwnership, /X-Amz-Signature=/);
  assert.match(ownerVehicle.cr, /X-Amz-Signature=/);
});
