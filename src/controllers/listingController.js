'use strict';

const Listing = require('../models/Listing');
const { scrapeListings } = require('../services/scraper');
const { analyseListing } = require('../services/priceAnalysis');
const { processListings } = require('../services/scheduler');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * POST /api/listings/scrape
 * Trigger an on-demand scrape and store results.
 */
async function scrape(req, res) {
  const { location, maxPrice, limit = 20 } = req.query;

  logger.info(`Manual scrape triggered by user ${req.user._id}: location=${location}, maxPrice=${maxPrice}`);

  const rawListings = await scrapeListings({
    location,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    limit: Number(limit),
  });

  const deals = await processListings(rawListings);

  return successResponse(res, {
    fetched: rawListings.length,
    dealsFound: deals.length,
    deals,
  });
}

/**
 * GET /api/listings
 * List stored listings with optional filters and pagination.
 */
async function getListings(req, res) {
  const {
    page = 1,
    limit = 20,
    dealsOnly,
    make,
    model,
    maxPrice,
    minProfit,
    sortBy = 'scrapedAt',
    order = 'desc',
  } = req.query;

  const filter = { isActive: true };
  if (dealsOnly === 'true') filter['analysis.isDeal'] = true;
  if (make) filter.make = new RegExp(make, 'i');
  if (model) filter.model = new RegExp(model, 'i');
  if (maxPrice) filter.price = { $lte: Number(maxPrice) };
  if (minProfit) filter['analysis.profitMarginPercent'] = { $gte: Number(minProfit) };

  const skip = (Number(page) - 1) * Number(limit);
  const sortOrder = order === 'asc' ? 1 : -1;

  const [listings, total] = await Promise.all([
    Listing.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(Number(limit)),
    Listing.countDocuments(filter),
  ]);

  return successResponse(res, {
    listings,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
}

/**
 * GET /api/listings/:id
 * Get a single listing by MongoDB ID.
 */
async function getListingById(req, res) {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return errorResponse(res, 'Listing not found', 404);
  return successResponse(res, { listing });
}

/**
 * POST /api/listings/analyse
 * Analyse a custom listing (not necessarily from Marketplace).
 */
async function analyseListing_ctrl(req, res) {
  const analysis = analyseListing(req.body);
  if (!analysis) return errorResponse(res, 'Unable to analyse listing with provided data', 422);
  return successResponse(res, { analysis });
}

module.exports = { scrape, getListings, getListingById, analyseListing: analyseListing_ctrl };
