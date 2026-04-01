'use strict';

const logger = require('../utils/logger');

/**
 * Price Analysis Service
 *
 * Analyses a car listing's price and calculates potential profit margin
 * based on estimated market value and repair cost.
 *
 * Facebook Marketplace does not expose a public API, so market value is
 * estimated using a heuristic model. In a production deployment this
 * service can be extended to call a third-party valuation API
 * (e.g. Edmunds, KBB, or NADA).
 */

/** Rough depreciation table: estimated market-value multiplier by age bucket */
const DEPRECIATION_TABLE = [
  { maxAge: 1, multiplier: 0.85 },
  { maxAge: 3, multiplier: 0.75 },
  { maxAge: 5, multiplier: 0.65 },
  { maxAge: 8, multiplier: 0.55 },
  { maxAge: 12, multiplier: 0.42 },
  { maxAge: 18, multiplier: 0.30 },
  { maxAge: Infinity, multiplier: 0.20 },
];

/** Average new-car price used when no specific data is available */
const AVG_NEW_CAR_PRICE = 35_000;

/** Mileage adjustment: reduce value by $0.008 per mile over 15,000/year */
const MILEAGE_VALUE_PER_MILE = 0.008;
const MILEAGE_BASE_ANNUAL = 15_000;

/**
 * Estimate market value for a vehicle.
 *
 * @param {object} params
 * @param {number} params.year
 * @param {string} params.make
 * @param {string} params.model
 * @param {number} [params.mileage]
 * @returns {number} Estimated fair-market value in USD
 */
function estimateMarketValue({ year, make, model, mileage } = {}) {
  const currentYear = new Date().getFullYear();
  const age = year ? currentYear - year : 5;

  // Pick depreciation multiplier
  const entry =
    DEPRECIATION_TABLE.find((e) => age <= e.maxAge) ||
    DEPRECIATION_TABLE[DEPRECIATION_TABLE.length - 1];
  let value = AVG_NEW_CAR_PRICE * entry.multiplier;

  // Mileage adjustment
  if (mileage && year) {
    const expectedMileage = age * MILEAGE_BASE_ANNUAL;
    const excessMiles = Math.max(0, mileage - expectedMileage);
    value -= excessMiles * MILEAGE_VALUE_PER_MILE;
  }

  return Math.max(500, Math.round(value));
}

/**
 * Estimate repair cost for a vehicle based on condition.
 *
 * @param {string} condition - e.g. 'excellent', 'good', 'fair', 'poor', 'salvage'
 * @param {number} marketValue - estimated market value
 * @returns {number} Estimated repair cost in USD
 */
function estimateRepairCost(condition, marketValue) {
  const conditionLower = (condition || 'fair').toLowerCase();

  const repairRatioMap = {
    excellent: 0.02,
    good: 0.05,
    fair: 0.12,
    poor: 0.22,
    salvage: 0.40,
    damaged: 0.30,
    'for parts': 0.50,
  };

  const ratio =
    repairRatioMap[conditionLower] ?? repairRatioMap['fair'];

  return Math.round(marketValue * ratio);
}

/**
 * Analyse a listing and return full profit analysis.
 *
 * @param {object} listing - Raw listing data
 * @returns {object} Analysis result
 */
function analyseListing(listing) {
  const { price, year, make, model, mileage, condition } = listing;

  if (!price || price <= 0) {
    logger.warn(`analyseListing: invalid price for listing ${listing.externalId}`);
    return null;
  }

  const estimatedMarketValue = estimateMarketValue({ year, make, model, mileage });
  const estimatedRepairCost = estimateRepairCost(condition, estimatedMarketValue);

  // Potential resale price after repairs (small buffer for selling costs)
  const sellingCostFactor = 0.05;
  const potentialResalePrice = Math.round(
    estimatedMarketValue * (1 - sellingCostFactor)
  );

  const totalCost = price + estimatedRepairCost;
  const profitAmount = potentialResalePrice - totalCost;
  const profitMarginPercent =
    totalCost > 0 ? Math.round((profitAmount / totalCost) * 100 * 10) / 10 : 0;

  // Deal score: 0–100, higher is better
  const dealScore = Math.min(
    100,
    Math.max(0, Math.round(profitMarginPercent * 2))
  );

  const isDeal = profitMarginPercent > 0 && profitAmount > 0;

  const notes = buildAnalysisNotes({ price, estimatedMarketValue, estimatedRepairCost, profitMarginPercent, condition });

  logger.debug(
    `Analysis for ${listing.externalId}: market=$${estimatedMarketValue} repair=$${estimatedRepairCost} profit=${profitMarginPercent}%`
  );

  return {
    estimatedMarketValue,
    estimatedRepairCost,
    potentialResalePrice,
    profitMarginPercent,
    profitAmount,
    isDeal,
    dealScore,
    analysisNotes: notes,
  };
}

function buildAnalysisNotes({ price, estimatedMarketValue, estimatedRepairCost, profitMarginPercent, condition }) {
  const parts = [];
  const discount = Math.round(((estimatedMarketValue - price) / estimatedMarketValue) * 100);
  if (discount > 0) {
    parts.push(`Listed ${discount}% below estimated market value.`);
  } else {
    parts.push(`Listed at or above estimated market value.`);
  }
  if (estimatedRepairCost > 0) {
    parts.push(`Estimated repair cost: $${estimatedRepairCost} (condition: ${condition || 'unknown'}).`);
  }
  parts.push(`Projected profit margin: ${profitMarginPercent}%.`);
  return parts.join(' ');
}

module.exports = { analyseListing, estimateMarketValue, estimateRepairCost };
