'use strict';

const express = require('express');
const router = express.Router();
const {
  scrape,
  getListings,
  getListingById,
  analyseListing,
} = require('../controllers/listingController');
const { authenticate } = require('../middleware/auth');
const {
  validateQuery,
  validateBody,
  scrapeQuerySchema,
  analyseBodySchema,
} = require('../middleware/validate');
const { asyncHandler } = require('../utils/response');

router.get('/', authenticate, asyncHandler(getListings));
router.get('/:id', authenticate, asyncHandler(getListingById));
router.post('/scrape', authenticate, validateQuery(scrapeQuerySchema), asyncHandler(scrape));
router.post('/analyse', authenticate, validateBody(analyseBodySchema), asyncHandler(analyseListing));

module.exports = router;
