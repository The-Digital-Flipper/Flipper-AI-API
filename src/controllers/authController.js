'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Generate a signed JWT for the given user id.
 * @param {string} id
 * @returns {string}
 */
function signToken(id) {
  return jwt.sign({ id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    return errorResponse(res, 'Username or email already in use', 409);
  }

  const user = await User.create({ username, email, password });
  const token = signToken(user._id.toString());

  logger.info(`New user registered: ${email}`);
  return successResponse(res, { user, token }, 201);
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email: { $eq: String(email) } }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return errorResponse(res, 'Invalid email or password', 401);
  }

  if (!user.isActive) {
    return errorResponse(res, 'Account is deactivated', 403);
  }

  const token = signToken(user._id.toString());
  logger.info(`User logged in: ${email}`);

  // Don't send password hash in the response
  user.password = undefined;
  return successResponse(res, { user, token });
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res) {
  return successResponse(res, { user: req.user });
}

/**
 * PATCH /api/auth/me/settings
 */
async function updateSettings(req, res) {
  const allowed = ['minProfitMarginPercent', 'maxRepairCost', 'emailNotifications', 'pushNotifications'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[`alertSettings.${key}`] = req.body[key];
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  return successResponse(res, { user });
}

module.exports = { register, login, getMe, updateSettings };
