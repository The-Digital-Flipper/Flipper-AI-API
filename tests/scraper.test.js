'use strict';

const { parseTitleDetails } = require('../src/services/scraper');

describe('parseTitleDetails', () => {
  it('extracts year from title', () => {
    const result = parseTitleDetails('2018 Toyota Camry');
    expect(result.year).toBe(2018);
  });

  it('extracts make from title', () => {
    const result = parseTitleDetails('2018 Toyota Camry');
    expect(result.make).toBe('Toyota');
  });

  it('extracts model from title', () => {
    const result = parseTitleDetails('2018 Toyota Camry');
    expect(result.model).toBe('Camry');
  });

  it('extracts mileage from title (miles suffix)', () => {
    const result = parseTitleDetails('2016 Honda Civic – 95,000 miles');
    expect(result.mileage).toBe(95000);
  });

  it('extracts mileage from title (mi. suffix)', () => {
    const result = parseTitleDetails('2016 Honda Civic 95000 mi.');
    expect(result.mileage).toBe(95000);
  });

  it('handles title with no year', () => {
    const result = parseTitleDetails('Toyota Camry good condition');
    expect(result.year).toBeUndefined();
    expect(result.make).toBe('Toyota');
  });

  it('handles unknown make gracefully', () => {
    const result = parseTitleDetails('2020 Zephyr Roadster');
    expect(result.make).toBeUndefined();
  });

  it('returns empty object for empty title', () => {
    const result = parseTitleDetails('');
    expect(result).toEqual({});
  });

  it('handles case-insensitive make matching', () => {
    const result = parseTitleDetails('2019 FORD Mustang');
    expect(result.make).toBe('Ford');
  });
});
