'use strict';

/**
 * Alert Service
 *
 * Manages deal alerts – creates Alert records in the database and emits
 * real-time notifications over Socket.io to the connected user.
 */

const Alert = require('../models/Alert');
const logger = require('../utils/logger');

/** Holds the Socket.io server instance once initialised */
let _io = null;

/**
 * Inject the Socket.io instance so the service can emit events.
 * Called once during server startup.
 *
 * @param {import('socket.io').Server} io
 */
function setSocketIO(io) {
  _io = io;
}

/**
 * Emit a real-time alert to a specific user's Socket.io room.
 *
 * @param {string} userId
 * @param {object} alertData
 */
function emitToUser(userId, alertData) {
  if (!_io) return;
  _io.to(`user:${userId}`).emit('alert', alertData);
  logger.debug(`Alert emitted to user:${userId}`);
}

/**
 * Create and persist a deal alert for each subscribed user.
 *
 * @param {object} listing  - Mongoose Listing document
 * @param {object[]} users  - Array of User documents to notify
 * @returns {Promise<object[]>} Created Alert documents
 */
async function createDealAlerts(listing, users) {
  const created = [];

  for (const user of users) {
    try {
      const { analysis } = listing;
      const message =
        `New deal found! ${listing.title} – ` +
        `$${listing.price} asking price with ` +
        `~${analysis.profitMarginPercent}% projected profit margin ` +
        `($${analysis.profitAmount} profit).`;

      const alert = await Alert.create({
        user: user._id,
        listing: listing._id,
        type: 'deal_found',
        message,
        metadata: {
          profitMarginPercent: analysis.profitMarginPercent,
          profitAmount: analysis.profitAmount,
          listingPrice: listing.price,
          estimatedResalePrice: analysis.potentialResalePrice,
        },
      });

      created.push(alert);

      // Emit in real-time
      emitToUser(user._id.toString(), {
        id: alert._id,
        type: alert.type,
        message: alert.message,
        listing: {
          id: listing._id,
          title: listing.title,
          price: listing.price,
          url: listing.url,
          analysis: listing.analysis,
        },
        createdAt: alert.createdAt,
      });

      logger.info(`Alert created for user ${user._id}: ${message}`);
    } catch (err) {
      logger.error(`Failed to create alert for user ${user._id}:`, err);
    }
  }

  return created;
}

/**
 * Mark one or all alerts as read for a user.
 *
 * @param {string} userId
 * @param {string} [alertId] - If omitted, marks all unread alerts as read
 * @returns {Promise<number>} Number of alerts updated
 */
async function markAlertsRead(userId, alertId) {
  const query = { user: userId, isRead: false };
  if (alertId) query._id = alertId;

  const result = await Alert.updateMany(query, { isRead: true });
  return result.modifiedCount;
}

/**
 * Get paginated alerts for a user.
 *
 * @param {string} userId
 * @param {object} [options]
 * @param {boolean} [options.unreadOnly=false]
 * @param {number} [options.page=1]
 * @param {number} [options.limit=20]
 */
async function getUserAlerts(userId, { unreadOnly = false, page = 1, limit = 20 } = {}) {
  const query = { user: userId };
  if (unreadOnly) query.isRead = false;

  const skip = (page - 1) * limit;
  const [alerts, total] = await Promise.all([
    Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('listing', 'title price url analysis'),
    Alert.countDocuments(query),
  ]);

  return { alerts, total, page, limit, pages: Math.ceil(total / limit) };
}

module.exports = { setSocketIO, createDealAlerts, markAlertsRead, getUserAlerts };
