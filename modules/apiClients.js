'use strict';

const crypto = require('crypto');
const apiClientDb = require('../models/apiClientDb');
const appConfig = require('./appConfig');

const { CLIENT_API_KEY_HASH_SECRET } = process.env;

function hashKey(rawKey) {
  if (!CLIENT_API_KEY_HASH_SECRET) {
    throw new Error('CLIENT_API_KEY_HASH_SECRET is not configured');
  }
  return crypto
    .createHmac('sha256', CLIENT_API_KEY_HASH_SECRET)
    .update(String(rawKey).trim())
    .digest('hex');
}

function generateApiKey() {
  return crypto.randomBytes(24).toString('base64url');
}

async function createClient({ name, contactEmail, plan, rateLimitPerMin, dailyQuota, metadata }) {
  const defaults = appConfig.values();
  const rawKey = generateApiKey();
  const keyHash = hashKey(rawKey);
  const doc = await apiClientDb.create({
    name: String(name).trim(),
    contactEmail: contactEmail ? String(contactEmail).trim() : '',
    keyHash,
    plan: plan ? String(plan).trim() : undefined,
    rateLimitPerMin: rateLimitPerMin ?? defaults.CLIENT_RATE_LIMIT_DEFAULT,
    dailyQuota: dailyQuota ?? defaults.CLIENT_DAILY_QUOTA_DEFAULT,
    latestPlainApiKey: rawKey,
    metadata,
  });
  return { client: doc.toObject(), apiKey: rawKey };
}

async function revokeClient(clientId) {
  return apiClientDb.findByIdAndUpdate(clientId, { status: 'revoked' }, { new: true });
}

async function activateClient(clientId) {
  return apiClientDb.findByIdAndUpdate(clientId, { status: 'active' }, { new: true });
}

async function updateClientFields(clientId, updates = {}) {
  return apiClientDb.findByIdAndUpdate(clientId, updates, { new: true });
}

async function regenerateApiKey(clientId) {
  const rawKey = generateApiKey();
  const keyHash = hashKey(rawKey);
  const doc = await apiClientDb.findByIdAndUpdate(
    clientId,
    { keyHash, latestPlainApiKey: rawKey },
    { new: true }
  );
  return { client: doc, apiKey: rawKey };
}

async function deleteClient(clientId) {
  return apiClientDb.findByIdAndDelete(clientId);
}

async function findActiveClientByKey(rawKey) {
  const keyHash = hashKey(rawKey);
  return apiClientDb.findOne({ keyHash, status: 'active' });
}

module.exports = {
  hashKey,
  generateApiKey,
  createClient,
  revokeClient,
  activateClient,
  updateClientFields,
  regenerateApiKey,
  deleteClient,
  findActiveClientByKey,
};
