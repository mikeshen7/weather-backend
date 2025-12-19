'use strict';

const apiClientDb = require('../models/apiClientDb');
const { hashKey } = require('./apiClients');
const { hasValidAdminToken } = require('./auth');

const HEADER_NAME = process.env.CLIENT_API_KEY_HEADER || 'x-api-key';

async function requireClientApiKey(request, response, next) {
  try {
    if (hasValidAdminToken(request)) {
      request.skipUsageTracking = true;
      return next();
    }

    const providedKey = request.header(HEADER_NAME);
    if (!providedKey) {
      return response.status(401).send('API key required');
    }

    const keyHash = hashKey(providedKey);
    const client = await apiClientDb.findOne({ keyHash, status: 'active' }).lean();
    if (!client) {
      return response.status(401).send('Invalid API key');
    }

    request.client = client;
    return next();
  } catch (error) {
    console.error('*** clientAuth error:', error.message);
    return next(error);
  }
}

module.exports = { requireClientApiKey };
