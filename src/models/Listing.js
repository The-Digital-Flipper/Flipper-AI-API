'use strict';

const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    externalId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      type: String,
      trim: true,
    },
    year: { type: Number },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    mileage: { type: Number, min: 0 },
    condition: { type: String, trim: true },
    description: { type: String },
    images: [{ type: String }],

    /** Price analysis fields populated by the analysis service */
    analysis: {
      estimatedMarketValue: { type: Number },
      estimatedRepairCost: { type: Number },
      potentialResalePrice: { type: Number },
      profitMarginPercent: { type: Number },
      profitAmount: { type: Number },
      isDeal: { type: Boolean, default: false },
      dealScore: { type: Number, min: 0, max: 100 },
      analysisNotes: { type: String },
    },

    /** When this listing was last fetched/refreshed from Marketplace */
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

listingSchema.index({ 'analysis.isDeal': 1, scrapedAt: -1 });
listingSchema.index({ make: 1, model: 1, year: 1 });
listingSchema.index({ price: 1 });

const Listing = mongoose.model('Listing', listingSchema);

module.exports = Listing;
