'use strict';

/**
 * Standard API response helpers.
 */

function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function errorResponse(res, message, statusCode = 500, errors = undefined) {
  const body = { success: false, message };
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
}

/**
 * Wrap an async route handler so Express catches thrown errors.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { successResponse, errorResponse, asyncHandler };
