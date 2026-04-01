'use strict';

const alertService = require('../services/alertService');
const { successResponse } = require('../utils/response');

/**
 * GET /api/alerts
 */
async function getAlerts(req, res) {
  const { page = 1, limit = 20, unreadOnly = false } = req.query;

  const result = await alertService.getUserAlerts(req.user._id, {
    unreadOnly: unreadOnly === 'true',
    page: Number(page),
    limit: Number(limit),
  });

  return successResponse(res, result);
}

/**
 * PATCH /api/alerts/read
 * Mark all unread alerts as read.
 */
async function markAllRead(req, res) {
  const count = await alertService.markAlertsRead(req.user._id);
  return successResponse(res, { markedRead: count });
}

/**
 * PATCH /api/alerts/:id/read
 * Mark a single alert as read.
 */
async function markOneRead(req, res) {
  const count = await alertService.markAlertsRead(req.user._id, req.params.id);
  return successResponse(res, { markedRead: count });
}

module.exports = { getAlerts, markAllRead, markOneRead };
