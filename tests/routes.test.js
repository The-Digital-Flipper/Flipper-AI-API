'use strict';

/**
 * Integration tests for auth and listing routes.
 * Uses supertest against the Express app (no real DB – mongoose is mocked).
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/flipper-test';

const request = require('supertest');
const app = require('../src/app');

// ── Mock mongoose to avoid needing a real MongoDB ────────────────────────────
jest.mock('../src/models/User', () => {
  const users = new Map();
  let oidCounter = 1;

  function fakeId() {
    return String(oidCounter++).padStart(24, '0');
  }

  class FakeUser {
    constructor(data) {
      Object.assign(this, data);
      this._id = fakeId();
      this.isActive = true;
      this.role = 'user';
      this.alertSettings = {
        minProfitMarginPercent: 20,
        maxRepairCost: 5000,
        emailNotifications: false,
        pushNotifications: true,
      };
    }

    async comparePassword(pw) {
      const bcrypt = require('bcryptjs');
      return bcrypt.compare(pw, this.password);
    }

    toJSON() {
      const obj = { ...this };
      delete obj.password;
      return obj;
    }
  }

  FakeUser.findOne = jest.fn(async (query) => {
    for (const [, u] of users) {
      if (query.email && u.email === query.email) return u;
      if (query.username && u.username === query.username) return u;
      if (query.$or) {
        for (const cond of query.$or) {
          if (cond.email && u.email === cond.email) return u;
          if (cond.username && u.username === cond.username) return u;
        }
      }
    }
    return null;
  });

  FakeUser.findById = jest.fn(async (id) => {
    for (const [, u] of users) {
      if (u._id === id) return u;
    }
    return null;
  });

  FakeUser.create = jest.fn(async (data) => {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(data.password, 4);
    const u = new FakeUser({ ...data, password: hashed });
    users.set(u._id, u);
    return u;
  });

  // Expose a helper to wipe state between tests
  FakeUser.__clear = () => {
    users.clear();
    oidCounter = 1;
  };

  // Fake .select('+password') chainable
  FakeUser.findOne = jest.fn((query) => {
    let withPassword = false;
    const chain = {
      select(fields) {
        if (fields && fields.includes('+password')) withPassword = true;
        return chain;
      },
      then(resolve, reject) {
        (async () => {
          for (const [, u] of users) {
            if (query.email && u.email === query.email) return u;
          }
          return null;
        })().then(resolve, reject);
      },
    };
    // Make it thenable (a promise-like)
    return chain;
  });

  return FakeUser;
});

jest.mock('../src/models/Listing', () => ({}));
jest.mock('../src/models/Alert', () => ({}));
jest.mock('../src/config/database', () => ({
  connectDB: jest.fn(),
  disconnectDB: jest.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/auth/register – validation', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'not-an-email', password: 'password123' });
    expect(res.statusCode).toBe(422);
  });

  it('rejects password shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'user@test.com', password: 'short' });
    expect(res.statusCode).toBe(422);
  });
});

describe('POST /api/auth/login – validation', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(422);
  });

  it('returns 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Protected routes without token', () => {
  it('GET /api/listings returns 401', async () => {
    const res = await request(app).get('/api/listings');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/alerts returns 401', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
