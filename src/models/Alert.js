'use strict';

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    type: {
      type: String,
      enum: ['deal_found', 'price_drop', 'new_listing'],
      default: 'deal_found',
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      profitMarginPercent: Number,
      profitAmount: Number,
      listingPrice: Number,
      estimatedResalePrice: Number,
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
