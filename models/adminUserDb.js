'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const collectionName = 'adminUsers';
const allowedRoles = ['owner', 'admin', 'read-only'];
const allowedLocationAccess = ['all', 'resort-only', 'non-resort-only'];

const adminUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, trim: true, default: '' },
    roles: {
      type: [String],
      enum: allowedRoles,
      default: ['admin'],
      set: (values) => {
        const arr = Array.isArray(values) ? values : [values];
        const filtered = arr
          .map((v) => String(v || '').trim())
          .filter((v) => allowedRoles.includes(v));
        return [...new Set(filtered)];
      },
    },
    locationAccess: {
      type: String,
      enum: allowedLocationAccess,
      default: 'all',
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String, default: '' },
    lastLoginUserAgent: { type: String, default: '' },
  },
  {
    collection: collectionName,
    timestamps: true,
  }
);

const adminUserDb = mongoose.model(collectionName, adminUserSchema);

module.exports = adminUserDb;
