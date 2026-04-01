'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { errorResponse } = require('../utils/response');

/**
 * Verify Bearer JWT and attach `req.user`.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'No token provided', 401);
  }

  const token = authHeader.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user || !user.isActive) {
    return errorResponse(res, 'User not found or inactive', 401);
  }

  req.user = user;
  next();
}

/**
 * Role-based authorisation guard.
 *
 * @param {...string} roles - Allowed roles
 */
function authorise(...roles) {
  return (req, res, next) => {
    if (!req.user) return errorResponse(res, 'Not authenticated', 401);
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Forbidden: insufficient permissions', 403);
    }
    next();
  };
}

module.exports = { authenticate, authorise };
