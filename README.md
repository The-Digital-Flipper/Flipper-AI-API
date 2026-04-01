# Flipper AI API

> A powerful Node.js API that scrapes Facebook Marketplace for car listings, analyses prices, calculates profit margins, and delivers real-time deal alerts — built for car flippers at any scale.

---

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [API Reference](#api-reference)
   - [Health Check](#health-check)
   - [Authentication](#authentication)
   - [Listings](#listings)
   - [Alerts](#alerts)
7. [Real-Time Alerts (Socket.io)](#real-time-alerts-socketio)
8. [Price Analysis Logic](#price-analysis-logic)
9. [Scraper Notes](#scraper-notes)
10. [Logging](#logging)
11. [Testing](#testing)
12. [Project Structure](#project-structure)
13. [Extending the API](#extending-the-api)

---

## Features

- 🔍 **Facebook Marketplace Scraper** – Puppeteer-based scraper for vehicle listings
- 💰 **Price Analysis Engine** – Estimates market value, repair costs, and profit margins
- 🚨 **Real-Time Deal Alerts** – Socket.io push notifications when a new deal is found
- 🔐 **User Authentication** – JWT-based registration and login
- 👤 **Per-User Alert Settings** – Configurable profit margin and repair cost thresholds
- 📊 **Listing Database** – MongoDB-backed persistent storage with search/filter
- 🛡️ **Security** – Helmet headers, rate limiting, input validation (Joi)
- 📝 **Structured Logging** – Winston logger with file rotation
- ⚙️ **Scheduled Polling** – Configurable interval to continuously monitor new deals

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Express API                       │
│  /api/auth  /api/listings  /api/alerts  /health     │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────▼────────────┐
        │     Services Layer     │
        │  scraper  priceAnalysis│
        │  alertService scheduler│
        └───────────┬────────────┘
                    │
        ┌───────────▼────────────┐
        │     MongoDB (Mongoose) │
        │  User  Listing  Alert  │
        └────────────────────────┘
                    │
        ┌───────────▼────────────┐
        │     Socket.io Server   │
        │  Real-time push alerts │
        └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 5 |
| Database | MongoDB + Mongoose 8 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Scraping | Puppeteer |
| Real-Time | Socket.io |
| Logging | Winston |
| Validation | Joi |
| Security | Helmet, express-rate-limit |
| Testing | Jest + Supertest |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- (Optional) Facebook account credentials for scraping

### Installation

```bash
git clone https://github.com/The-Digital-Flipper/Flipper-AI-API.git
cd Flipper-AI-API
npm install
cp .env.example .env   # Fill in your values
npm start
```

For development with auto-reload:

```bash
npm run dev
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `PORT` | `3000` | HTTP server port |
| `MONGODB_URI` | `mongodb://localhost:27017/flipper-ai-api` | MongoDB connection string |
| `JWT_SECRET` | *(required)* | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | `7d` | JWT expiry duration |
| `MIN_PROFIT_MARGIN_PERCENT` | `20` | Minimum profit % to trigger an alert |
| `MAX_REPAIR_COST` | `5000` | Maximum repair cost ($) to consider a deal |
| `SCRAPER_POLL_INTERVAL_MS` | `900000` | Scheduler polling interval (ms) |
| `FB_COOKIES` | *(optional)* | JSON cookie string for Facebook auth |
| `FB_EMAIL` | *(optional)* | Facebook login email |
| `FB_PASSWORD` | *(optional)* | Facebook login password |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per IP |
| `LOG_LEVEL` | `info` | Winston log level |

---

## API Reference

All endpoints except `/health` and `/api/auth/register`/`login` require a `Bearer` token in the `Authorization` header.

### Health Check

```
GET /health
```

**Response:**
```json
{ "success": true, "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

---

### Authentication

#### Register

```
POST /api/auth/register
Content-Type: application/json

{
  "username": "flipper1",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "username": "flipper1", "email": "..." },
    "token": "<jwt>"
  }
}
```

#### Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Get Current User

```
GET /api/auth/me
Authorization: Bearer <token>
```

#### Update Alert Settings

```
PATCH /api/auth/me/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "minProfitMarginPercent": 25,
  "maxRepairCost": 3000,
  "pushNotifications": true
}
```

---

### Listings

#### Trigger On-Demand Scrape

```
POST /api/listings/scrape?location=Los+Angeles&maxPrice=15000&limit=20
Authorization: Bearer <token>
```

| Query Param | Type | Description |
|---|---|---|
| `location` | string | City/region to search |
| `maxPrice` | number | Max listing price |
| `limit` | number (1–100) | Max listings to fetch (default 20) |

**Response:**
```json
{
  "success": true,
  "data": {
    "fetched": 20,
    "dealsFound": 3,
    "deals": [ { "title": "2018 Toyota Camry", "price": 5000, "analysis": { ... } } ]
  }
}
```

#### List Stored Listings

```
GET /api/listings?dealsOnly=true&make=Toyota&maxPrice=10000&minProfit=20&page=1&limit=20
Authorization: Bearer <token>
```

| Query Param | Type | Description |
|---|---|---|
| `dealsOnly` | boolean | Only return flagged deals |
| `make` | string | Filter by vehicle make |
| `model` | string | Filter by vehicle model |
| `maxPrice` | number | Max asking price |
| `minProfit` | number | Min profit margin % |
| `page` | number | Page number (default 1) |
| `limit` | number | Results per page (default 20) |
| `sortBy` | string | Sort field (default `scrapedAt`) |
| `order` | string | `asc` or `desc` (default `desc`) |

#### Get Single Listing

```
GET /api/listings/:id
Authorization: Bearer <token>
```

#### Analyse a Custom Listing

```
POST /api/listings/analyse
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 6500,
  "year": 2017,
  "make": "Honda",
  "model": "Accord",
  "mileage": 95000,
  "condition": "fair"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "estimatedMarketValue": 12250,
      "estimatedRepairCost": 1470,
      "potentialResalePrice": 11638,
      "profitMarginPercent": 45.5,
      "profitAmount": 3668,
      "isDeal": true,
      "dealScore": 91,
      "analysisNotes": "Listed 47% below estimated market value. ..."
    }
  }
}
```

---

### Alerts

#### Get Alerts

```
GET /api/alerts?unreadOnly=true&page=1&limit=20
Authorization: Bearer <token>
```

#### Mark All Alerts as Read

```
PATCH /api/alerts/read
Authorization: Bearer <token>
```

#### Mark One Alert as Read

```
PATCH /api/alerts/:id/read
Authorization: Bearer <token>
```

---

## Real-Time Alerts (Socket.io)

Connect to the server and authenticate with your JWT:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Authenticate after connecting
socket.on('connect', () => {
  socket.emit('auth', '<your-jwt-token>');
});

socket.on('authenticated', ({ userId }) => {
  console.log('Real-time alerts active for', userId);
});

// Listen for deal alerts
socket.on('alert', (alert) => {
  console.log('New deal!', alert.message);
  // alert.listing contains full listing details
});
```

---

## Price Analysis Logic

The analysis engine uses a **heuristic depreciation model** when a third-party valuation API is not configured:

1. **Market Value** – Estimated from vehicle age using a depreciation table, adjusted downward for excess mileage.
2. **Repair Cost** – Estimated as a percentage of market value based on the reported condition (`excellent` → 2%, `salvage` → 40%).
3. **Resale Price** – Market value minus 5% selling costs (fees, time).
4. **Profit Margin** – `(resalePrice - (askingPrice + repairCost)) / (askingPrice + repairCost) × 100`.
5. **Deal Score** – 0–100 score derived from the profit margin percentage.

> **Extending:** Swap `estimateMarketValue()` in `src/services/priceAnalysis.js` with a call to an Edmunds, KBB, or NADA API for production-grade accuracy.

---

## Scraper Notes

- Facebook Marketplace requires authentication. Provide credentials via `FB_EMAIL`/`FB_PASSWORD` **or** a pre-saved cookie JSON via `FB_COOKIES`.
- The scraper polls automatically on the interval set by `SCRAPER_POLL_INTERVAL_MS`.
- Manual scrapes are triggered via `POST /api/listings/scrape`.
- Facebook's Terms of Service restrict automated scraping. Use responsibly and only for personal, research, or explicitly permitted purposes.

---

## Logging

Logs are written to:

- **Console** (colourised, suppressed in `test` mode)
- **`logs/combined.log`** – All log levels
- **`logs/error.log`** – Errors only

Files rotate at 5 MB with up to 5 archived files.

Set `LOG_LEVEL` in `.env` to control verbosity (`error`, `warn`, `info`, `debug`).

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

Tests are located in `tests/` and cover:

- Price analysis service (unit)
- Scraper title parser (unit)
- Alert service (unit, mocked DB)
- API routes (integration, mocked DB)

---

## Project Structure

```
Flipper-AI-API/
├── src/
│   ├── app.js               # Express app (middleware, routes)
│   ├── server.js            # HTTP + Socket.io server startup
│   ├── config/
│   │   ├── index.js         # Centralised configuration
│   │   └── database.js      # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── listingController.js
│   │   └── alertController.js
│   ├── middleware/
│   │   ├── auth.js          # JWT authentication + authorisation
│   │   ├── errorHandler.js  # Central error handler
│   │   └── validate.js      # Joi validation middleware & schemas
│   ├── models/
│   │   ├── User.js
│   │   ├── Listing.js
│   │   └── Alert.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── listings.js
│   │   └── alerts.js
│   ├── services/
│   │   ├── alertService.js  # Alert creation + Socket.io emission
│   │   ├── priceAnalysis.js # Market value & profit margin engine
│   │   ├── scheduler.js     # Periodic scrape & alert cycle
│   │   └── scraper.js       # Puppeteer Facebook Marketplace scraper
│   └── utils/
│       ├── logger.js        # Winston logger
│       └── response.js      # API response helpers
├── tests/
│   ├── alertService.test.js
│   ├── priceAnalysis.test.js
│   ├── routes.test.js
│   └── scraper.test.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Extending the API

| Goal | Where to change |
|---|---|
| Integrate a real valuation API | `src/services/priceAnalysis.js` → `estimateMarketValue()` |
| Add email deal notifications | `src/services/alertService.js` → `createDealAlerts()` |
| Add additional listing sources | Create `src/services/scraperXxx.js` mirroring `scraper.js` |
| Add admin dashboard routes | `src/routes/admin.js` + `authorise('admin')` middleware |
| Switch to PostgreSQL | Replace Mongoose models with Sequelize / Prisma equivalents |
| Add OAuth login | Extend `src/routes/auth.js` and `src/controllers/authController.js` |
