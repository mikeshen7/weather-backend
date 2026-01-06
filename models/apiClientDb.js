'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const collectionName = 'apiClients';

const apiClientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    contactEmail: { type: String, default: '', trim: true },
    keyHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    plan: { type: String, default: 'default', trim: true },
    rateLimitPerMin: { type: Number, default: Number(process.env.CLIENT_API_RATE_LIMIT_DEFAULT) || 60 },
    dailyQuota: { type: Number, default: Number(process.env.CLIENT_API_DAILY_QUOTA_DEFAULT) || 5000 },
    totalUsage: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
    latestPlainApiKey: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed },
    lastAccessAlertAt: { type: Date },
  },
  {
    collection: collectionName,
    timestamps: true,
  }
);

const apiClientDb = mongoose.model(collectionName, apiClientSchema);

module.exports = apiClientDb;
