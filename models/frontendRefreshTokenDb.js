'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const collectionName = 'frontendRefreshTokens';

const frontendRefreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'adminUsers', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
    replacedByTokenHash: { type: String, default: '' },
    createdFromIp: { type: String, default: '' },
    createdFromUserAgent: { type: String, default: '' },
  },
  {
    collection: collectionName,
    timestamps: true,
  }
);

frontendRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const frontendRefreshTokenDb = mongoose.model(collectionName, frontendRefreshTokenSchema);

module.exports = frontendRefreshTokenDb;
