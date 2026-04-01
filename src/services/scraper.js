'use strict';

/**
 * Facebook Marketplace Scraper Service
 *
 * Uses Puppeteer to scrape vehicle listings from Facebook Marketplace.
 *
 * IMPORTANT: Facebook Marketplace requires a logged-in session. Provide
 * valid credentials via environment variables FB_EMAIL and FB_PASSWORD,
 * or supply a pre-authenticated cookie string via FB_COOKIES.
 *
 * Facebook's terms of service restrict automated scraping. Use this
 * service responsibly and only for personal, non-commercial research.
 */

const puppeteer = require('puppeteer');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const FB_MARKETPLACE_URL =
  'https://www.facebook.com/marketplace/category/vehicles';

/**
 * Launch a Puppeteer browser instance configured for scraping.
 */
async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800',
    ],
  });
}

/**
 * Authenticate with Facebook using stored cookies or credentials.
 *
 * @param {import('puppeteer').Page} page
 */
async function authenticate(page) {
  const cookieString = process.env.FB_COOKIES;
  if (cookieString) {
    try {
      const cookies = JSON.parse(cookieString);
      await page.setCookie(...cookies);
      logger.info('Scraper: authenticated via saved cookies');
      return;
    } catch (err) {
      logger.warn('Scraper: failed to parse FB_COOKIES, falling back to login');
    }
  }

  const email = process.env.FB_EMAIL;
  const password = process.env.FB_PASSWORD;

  if (!email || !password) {
    logger.warn(
      'Scraper: FB_EMAIL/FB_PASSWORD not set – scraper will run without authentication'
    );
    return;
  }

  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
  await page.type('#email', email, { delay: 50 });
  await page.type('#pass', password, { delay: 50 });
  await page.click('[name="login"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20_000 });
  logger.info('Scraper: authenticated via email/password');
}

/**
 * Parse raw listing data from a Puppeteer page context.
 * Returns an array of raw listing objects.
 *
 * @param {import('puppeteer').Page} page
 * @returns {Promise<object[]>}
 */
async function parseListings(page) {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-testid="marketplace_feed_item"]') ||
        document.querySelectorAll('div[class*="x1yztbdb"]') ||
        []
    );

    return cards.slice(0, 50).map((card) => {
      const titleEl = card.querySelector('[class*="x1lliihq"]');
      const priceEl = card.querySelector('[class*="x193iq5w"]');
      const locationEl = card.querySelectorAll('[class*="x1lliihq"]')[1];
      const linkEl = card.querySelector('a[href*="/marketplace/item/"]');

      const priceText = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '';
      return {
        title: titleEl ? titleEl.textContent.trim() : '',
        price: priceText ? parseInt(priceText, 10) : 0,
        location: locationEl ? locationEl.textContent.trim() : '',
        url: linkEl
          ? `https://www.facebook.com${linkEl.getAttribute('href')}`
          : '',
      };
    });
  });
}

/**
 * Parse vehicle details (year, make, model, mileage, condition) from a
 * listing title string.
 *
 * E.g. "2018 Toyota Camry – 85,000 miles"
 *
 * @param {string} title
 * @returns {{ year?: number, make?: string, model?: string, mileage?: number }}
 */
function parseTitleDetails(title) {
  const result = {};
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) result.year = parseInt(yearMatch[0], 10);

  const mileageMatch = title.match(/([\d,]+)\s*(miles?|mi\.?|km)/i);
  if (mileageMatch) {
    result.mileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10);
  }

  // Extremely simplified make/model extraction – production code should
  // use a dedicated automotive API or data set.
  const KNOWN_MAKES = [
    'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Chevy', 'Dodge', 'Ram',
    'Nissan', 'Hyundai', 'Kia', 'BMW', 'Mercedes', 'Volkswagen', 'VW',
    'Audi', 'Subaru', 'Jeep', 'GMC', 'Buick', 'Cadillac', 'Lexus',
    'Acura', 'Infiniti', 'Mazda', 'Volvo', 'Tesla', 'Mitsubishi',
  ];

  for (const make of KNOWN_MAKES) {
    const re = new RegExp(`\\b${make}\\b`, 'i');
    if (re.test(title)) {
      result.make = make;
      // Try to grab the next word after the make as model
      const modelMatch = title.match(new RegExp(`${make}\\s+(\\S+)`, 'i'));
      if (modelMatch) result.model = modelMatch[1];
      break;
    }
  }

  return result;
}

/**
 * Scrape Facebook Marketplace for vehicle listings.
 *
 * @param {object} [options]
 * @param {string} [options.location]  - Location to search (city name)
 * @param {number} [options.maxPrice]  - Maximum price filter
 * @param {number} [options.limit=20]  - Maximum number of listings to return
 * @returns {Promise<object[]>} Array of normalised listing objects
 */
async function scrapeListings(options = {}) {
  const { location, maxPrice, limit = 20 } = options;
  let browser;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await authenticate(page);

    let url = FB_MARKETPLACE_URL;
    if (location) url += `?city=${encodeURIComponent(location)}`;
    if (maxPrice) url += `${url.includes('?') ? '&' : '?'}maxPrice=${maxPrice}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

    // Scroll to load more listings
    await page.evaluate(() => window.scrollBy(0, 3000));
    await new Promise((r) => setTimeout(r, 2000));

    const rawListings = await parseListings(page);

    const listings = rawListings
      .filter((l) => l.title && l.url)
      .slice(0, limit)
      .map((l) => {
        const details = parseTitleDetails(l.title);
        return {
          externalId: uuidv4(),
          url: l.url,
          title: l.title,
          price: l.price,
          location: l.location,
          condition: 'fair',
          scrapedAt: new Date(),
          ...details,
        };
      });

    logger.info(`Scraper: fetched ${listings.length} listings`);
    return listings;
  } catch (err) {
    logger.error('Scraper error:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { scrapeListings, parseTitleDetails, estimateListingDetails: parseTitleDetails };
