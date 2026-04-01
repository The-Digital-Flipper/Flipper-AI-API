'use strict';

/**
 * Tests for the Price Analysis service.
 * These tests run entirely in-memory – no DB or network required.
 */

const {
  analyseListing,
  estimateMarketValue,
  estimateRepairCost,
} = require('../src/services/priceAnalysis');

describe('estimateMarketValue', () => {
  it('returns a positive number', () => {
    const value = estimateMarketValue({ year: 2018, make: 'Toyota', model: 'Camry', mileage: 80000 });
    expect(value).toBeGreaterThan(0);
  });

  it('returns a lower value for older vehicles', () => {
    const newer = estimateMarketValue({ year: 2020 });
    const older = estimateMarketValue({ year: 2005 });
    expect(newer).toBeGreaterThan(older);
  });

  it('penalises high mileage', () => {
    const low = estimateMarketValue({ year: 2015, mileage: 30000 });
    const high = estimateMarketValue({ year: 2015, mileage: 200000 });
    expect(low).toBeGreaterThan(high);
  });

  it('returns at least 500 for very old/high-mileage vehicles', () => {
    const value = estimateMarketValue({ year: 1990, mileage: 999999 });
    expect(value).toBeGreaterThanOrEqual(500);
  });

  it('handles missing params gracefully', () => {
    const value = estimateMarketValue({});
    expect(value).toBeGreaterThan(0);
  });
});

describe('estimateRepairCost', () => {
  const marketValue = 10000;

  it('returns lower cost for excellent condition', () => {
    const excellent = estimateRepairCost('excellent', marketValue);
    const poor = estimateRepairCost('poor', marketValue);
    expect(excellent).toBeLessThan(poor);
  });

  it('returns highest cost for salvage', () => {
    const salvage = estimateRepairCost('salvage', marketValue);
    const good = estimateRepairCost('good', marketValue);
    expect(salvage).toBeGreaterThan(good);
  });

  it('defaults to fair condition for unknown values', () => {
    const unknown = estimateRepairCost('mystery', marketValue);
    const fair = estimateRepairCost('fair', marketValue);
    expect(unknown).toBe(fair);
  });

  it('is case-insensitive', () => {
    const lower = estimateRepairCost('good', marketValue);
    const upper = estimateRepairCost('GOOD', marketValue);
    expect(lower).toBe(upper);
  });
});

describe('analyseListing', () => {
  const baseListing = {
    externalId: 'test-001',
    price: 5000,
    year: 2015,
    make: 'Honda',
    model: 'Civic',
    mileage: 90000,
    condition: 'good',
  };

  it('returns an analysis object with expected keys', () => {
    const result = analyseListing(baseListing);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('estimatedMarketValue');
    expect(result).toHaveProperty('estimatedRepairCost');
    expect(result).toHaveProperty('potentialResalePrice');
    expect(result).toHaveProperty('profitMarginPercent');
    expect(result).toHaveProperty('profitAmount');
    expect(result).toHaveProperty('isDeal');
    expect(result).toHaveProperty('dealScore');
    expect(result).toHaveProperty('analysisNotes');
  });

  it('isDeal is boolean', () => {
    const result = analyseListing(baseListing);
    expect(typeof result.isDeal).toBe('boolean');
  });

  it('dealScore is between 0 and 100', () => {
    const result = analyseListing(baseListing);
    expect(result.dealScore).toBeGreaterThanOrEqual(0);
    expect(result.dealScore).toBeLessThanOrEqual(100);
  });

  it('returns null for invalid price', () => {
    const result = analyseListing({ ...baseListing, price: 0 });
    expect(result).toBeNull();
  });

  it('a very underpriced listing is flagged as a deal', () => {
    // Price is $500 for a 2020 vehicle in good condition – should be a deal
    const listing = { ...baseListing, price: 500, year: 2020, condition: 'good' };
    const result = analyseListing(listing);
    expect(result.isDeal).toBe(true);
    expect(result.profitMarginPercent).toBeGreaterThan(0);
  });

  it('an overpriced listing is not flagged as a deal', () => {
    // Price is $50,000 for a 1995 vehicle
    const listing = { ...baseListing, price: 50000, year: 1995, condition: 'poor' };
    const result = analyseListing(listing);
    expect(result.isDeal).toBe(false);
  });
});
