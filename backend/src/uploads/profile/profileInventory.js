'use strict';

const fs = require('fs');
const path = require('path');

const FOLDER_DIR = __dirname;
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days (2 months)

const getProfileMonitoringList = () => {
  const now = Date.now();
  const files = fs.readdirSync(FOLDER_DIR);
  const activeRecords = [];

  for (const file of files) {
    if (file.endsWith('.js') || file === '.gitkeep') continue;

    const fullPath = path.join(FOLDER_DIR, file);
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) continue;

    const ageMs = now - stats.mtimeMs;
    if (ageMs > RETENTION_MS) {
      fs.unlinkSync(fullPath); // Auto-delete files older than 60 days
      continue;
    }

    activeRecords.push({
      category: 'Owner & Renter Profiles',
      filename: file,
      sizeBytes: stats.size,
      recordedAt: stats.mtime,
      expiresInDays: Math.ceil((RETENTION_MS - ageMs) / (24 * 60 * 60 * 1000)),
      filePath: fullPath,
    });
  }

  return activeRecords.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
};

module.exports = { getProfileMonitoringList };