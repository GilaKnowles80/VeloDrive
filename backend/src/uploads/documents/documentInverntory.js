'use strict';

const fs = require('fs');
const path = require('path');

const FOLDER_DIR = __dirname;
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days (2 months)

const getDocumentMonitoringList = () => {
  const now = Date.now();
  const files = fs.readdirSync(FOLDER_DIR);
  const activeDocuments = [];

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

    activeDocuments.push({
      category: 'Uploaded Documents',
      filename: file,
      sizeBytes: stats.size,
      uploadedAt: stats.mtime,
      expiresInDays: Math.ceil((RETENTION_MS - ageMs) / (24 * 60 * 60 * 1000)),
      filePath: fullPath,
    });
  }

  return activeDocuments.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
};

module.exports = { getDocumentMonitoringList };