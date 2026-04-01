'use strict';

const dotenv = require('dotenv');

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/flipper-ai-api',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'changeme-supersecret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  scraper: {
    /** Minimum profit margin (%) to trigger a deal alert */
    minProfitMarginPercent: parseFloat(process.env.MIN_PROFIT_MARGIN_PERCENT) || 20,
    /** Maximum repair cost ($) to consider a vehicle viable */
    maxRepairCost: parseFloat(process.env.MAX_REPAIR_COST) || 5000,
    /** Polling interval in milliseconds for the scraper scheduler */
    pollIntervalMs: parseInt(process.env.SCRAPER_POLL_INTERVAL_MS, 10) || 15 * 60 * 1000,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;
