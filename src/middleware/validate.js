'use strict';

const Joi = require('joi');
const { errorResponse } = require('../utils/response');

/**
 * Validate request body against a Joi schema.
 * Returns a 422 with validation errors if validation fails.
 *
 * @param {import('joi').ObjectSchema} schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((d) => d.message);
      return errorResponse(res, 'Validation failed', 422, errors);
    }
    next();
  };
}

/**
 * Validate request query parameters against a Joi schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.query, { abortEarly: false, allowUnknown: true });
    if (error) {
      const errors = error.details.map((d) => d.message);
      return errorResponse(res, 'Invalid query parameters', 422, errors);
    }
    next();
  };
}

// ── Reusable Joi schemas ─────────────────────────────────────────────────────

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const scrapeQuerySchema = Joi.object({
  location: Joi.string().max(100),
  maxPrice: Joi.number().positive().max(1_000_000),
  limit: Joi.number().integer().min(1).max(100),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  unreadOnly: Joi.boolean(),
});

const analyseBodySchema = Joi.object({
  price: Joi.number().positive().required(),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1),
  make: Joi.string().max(50),
  model: Joi.string().max(50),
  mileage: Joi.number().min(0),
  condition: Joi.string().valid('excellent', 'good', 'fair', 'poor', 'salvage', 'damaged', 'for parts'),
});

module.exports = {
  validateBody,
  validateQuery,
  registerSchema,
  loginSchema,
  scrapeQuerySchema,
  paginationSchema,
  analyseBodySchema,
};
