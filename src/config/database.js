'use strict';

const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let isConnected = false;

/**
 * Connect to MongoDB.
 * Resolves immediately if already connected.
 */
async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(config.db.uri);
  isConnected = true;
  logger.info(`MongoDB connected: ${config.db.uri}`);
}

/**
 * Disconnect from MongoDB (useful in tests).
 */
async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected');
}

module.exports = { connectDB, disconnectDB };
