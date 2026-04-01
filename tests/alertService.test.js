'use strict';

process.env.NODE_ENV = 'test';

const { setSocketIO, createDealAlerts, markAlertsRead, getUserAlerts } = require('../src/services/alertService');

// ── Mock the Alert model ──────────────────────────────────────────────────────
jest.mock('../src/models/Alert', () => {
  const alerts = [];

  const Alert = {
    create: jest.fn(async (data) => {
      const doc = { _id: String(alerts.length + 1), ...data, createdAt: new Date(), isRead: false };
      alerts.push(doc);
      return doc;
    }),
    updateMany: jest.fn(async () => ({ modifiedCount: 1 })),
    find: jest.fn(() => ({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue([]),
    })),
    countDocuments: jest.fn(async () => 0),
    __clear: () => {
      alerts.length = 0;
    },
  };
  return Alert;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('alertService.setSocketIO', () => {
  it('sets the io instance without throwing', () => {
    expect(() => setSocketIO({ to: () => ({ emit: () => {} }) })).not.toThrow();
  });
});

describe('alertService.createDealAlerts', () => {
  const fakeListing = {
    _id: 'listing-001',
    title: '2018 Toyota Camry',
    price: 5000,
    url: 'https://fb.com/marketplace/item/123',
    analysis: {
      profitMarginPercent: 35,
      profitAmount: 4000,
      potentialResalePrice: 13000,
    },
  };

  const fakeUsers = [
    { _id: 'user-001', alertSettings: { minProfitMarginPercent: 20 } },
    { _id: 'user-002', alertSettings: { minProfitMarginPercent: 20 } },
  ];

  it('creates one alert per user', async () => {
    const Alert = require('../src/models/Alert');
    Alert.create.mockClear();

    await createDealAlerts(fakeListing, fakeUsers);

    expect(Alert.create).toHaveBeenCalledTimes(2);
  });

  it('the alert message contains listing title', async () => {
    const Alert = require('../src/models/Alert');
    Alert.create.mockClear();

    await createDealAlerts(fakeListing, [fakeUsers[0]]);

    const callArgs = Alert.create.mock.calls[0][0];
    expect(callArgs.message).toContain('2018 Toyota Camry');
  });

  it('handles empty user list gracefully', async () => {
    const Alert = require('../src/models/Alert');
    Alert.create.mockClear();

    const result = await createDealAlerts(fakeListing, []);
    expect(result).toHaveLength(0);
    expect(Alert.create).not.toHaveBeenCalled();
  });
});

describe('alertService.markAlertsRead', () => {
  it('calls updateMany and returns modifiedCount', async () => {
    const count = await markAlertsRead('user-001');
    expect(count).toBe(1);
  });
});

describe('alertService.getUserAlerts', () => {
  it('returns expected shape', async () => {
    const result = await getUserAlerts('user-001');
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('pages');
  });
});
