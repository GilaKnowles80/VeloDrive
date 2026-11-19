'use strict';

const fs = require('fs');
const path = require('path');

const FOLDER_DIR = __dirname;
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days (2 months)

const getVinTrackerList = () => {
  const now = Date.now();
  const files = fs.readdirSync(FOLDER_DIR);
  const activeLogs = [];

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

    activeLogs.push({
      category: 'VIN Tracker',
      filename: file,
      sizeBytes: stats.size,
      loggedAt: stats.mtime,
      expiresInDays: Math.ceil((RETENTION_MS - ageMs) / (24 * 60 * 60 * 1000)),
      filePath: fullPath,
    });
  }

  return activeLogs.sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
};

module.exports = { getVinTrackerList };