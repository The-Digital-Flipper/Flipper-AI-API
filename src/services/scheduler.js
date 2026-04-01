'use strict';

/**
 * Scraper Scheduler
 *
 * Periodically runs the scraper, persists new listings, analyses them,
 * and fires deal alerts for subscribed users.
 */

const Listing = require('../models/Listing');
const User = require('../models/User');
const { scrapeListings } = require('./scraper');
const { analyseListing } = require('./priceAnalysis');
const { createDealAlerts } = require('./alertService');
const config = require('../config');
const logger = require('../utils/logger');

let _timer = null;

/**
 * Process a batch of raw scraped listings:
 *  1. Upsert into DB
 *  2. Run price analysis
 *  3. Trigger deal alerts for eligible users
 *
 * @param {object[]} rawListings
 */
async function processListings(rawListings) {
  const dealListings = [];

  for (const raw of rawListings) {
    try {
      const analysis = analyseListing(raw);
      if (!analysis) continue;

      const listing = await Listing.findOneAndUpdate(
        { externalId: raw.externalId },
        {
          ...raw,
          analysis,
          scrapedAt: new Date(),
          isActive: true,
        },
        { upsert: true, new: true }
      );

      if (
        analysis.isDeal &&
        analysis.profitMarginPercent >= config.scraper.minProfitMarginPercent &&
        analysis.estimatedRepairCost <= config.scraper.maxRepairCost
      ) {
        dealListings.push(listing);
      }
    } catch (err) {
      logger.error(`processListings: failed to process listing ${raw.externalId}:`, err);
    }
  }

  if (dealListings.length > 0) {
    // Notify all active users who have push notifications enabled
    const users = await User.find({ isActive: true, 'alertSettings.pushNotifications': true });
    for (const deal of dealListings) {
      // Filter users whose profit margin threshold is met
      const eligibleUsers = users.filter(
        (u) => deal.analysis.profitMarginPercent >= u.alertSettings.minProfitMarginPercent
      );
      if (eligibleUsers.length > 0) {
        await createDealAlerts(deal, eligibleUsers);
      }
    }
  }

  logger.info(`Scheduler: processed ${rawListings.length} listings, ${dealListings.length} deals found`);
  return dealListings;
}

/**
 * Run one scrape-and-analyse cycle.
 */
async function runCycle() {
  logger.info('Scheduler: starting scrape cycle');
  try {
    const rawListings = await scrapeListings({ limit: 50 });
    await processListings(rawListings);
  } catch (err) {
    logger.error('Scheduler: scrape cycle error:', err);
  }
}

/**
 * Start the periodic scheduler.
 */
function startScheduler() {
  if (_timer) return;
  logger.info(
    `Scheduler started – polling every ${config.scraper.pollIntervalMs / 1000}s`
  );
  _timer = setInterval(runCycle, config.scraper.pollIntervalMs);
}

/**
 * Stop the periodic scheduler.
 */
function stopScheduler() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    logger.info('Scheduler stopped');
  }
}

module.exports = { startScheduler, stopScheduler, processListings, runCycle };
