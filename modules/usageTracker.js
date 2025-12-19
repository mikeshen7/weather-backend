'use strict';

const apiUsageDb = require('../models/apiUsageDb');
const apiDailyUsageDb = require('../models/apiDailyUsageDb');
const apiClientDb = require('../models/apiClientDb');
const appConfig = require('./appConfig');

const WINDOW_MINUTES = Number(process.env.CLIENT_API_RATE_WINDOW_MIN) || 1;

function getWindowStart(date = new Date()) {
  const windowSizeMs = WINDOW_MINUTES * 60 * 1000;
  return new Date(Math.floor(date.getTime() / windowSizeMs) * windowSizeMs);
}

function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function resolveDefaultRateLimit() {
  const configValue = Number(appConfig.values().CLIENT_RATE_LIMIT_DEFAULT);
  if (Number.isFinite(configValue)) {
    return configValue;
  }
  const envValue = Number(process.env.CLIENT_API_RATE_LIMIT_DEFAULT);
  if (Number.isFinite(envValue)) {
    return envValue;
  }
  return 60;
}

function resolveDefaultDailyQuota() {
  const configValue = Number(appConfig.values().CLIENT_DAILY_QUOTA_DEFAULT);
  if (Number.isFinite(configValue)) {
    return configValue;
  }
  const envValue = Number(process.env.CLIENT_API_DAILY_QUOTA_DEFAULT);
  if (Number.isFinite(envValue)) {
    return envValue;
  }
  return 5000;
}

async function trackUsage(request, response, next) {
  try {
    if (request.skipUsageTracking) {
      return next();
    }

    const client = request.client;
    if (!client) {
      return response.status(500).send('Client context missing');
    }

    const now = new Date();
    const windowStart = getWindowStart(now);
    const updateResult = await apiUsageDb.findOneAndUpdate(
      { client: client._id, windowStart },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );

    const defaultRate = resolveDefaultRateLimit();
    const rateLimit = client.rateLimitPerMin ?? defaultRate;

    if (rateLimit > 0 && updateResult.count > rateLimit) {
      return response.status(429).send('Rate limit exceeded');
    }

    const dayKey = getDayKey(now);
    const dailyUsage = await apiDailyUsageDb.findOneAndUpdate(
      { client: client._id, dayKey },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );

    const defaultQuota = resolveDefaultDailyQuota();
    const dailyQuota = client.dailyQuota ?? defaultQuota;

    if (dailyQuota > 0 && dailyUsage.count > dailyQuota) {
      return response.status(429).send('Daily quota exceeded');
    }

    await apiClientDb.findByIdAndUpdate(client._id, {
      lastUsedAt: now,
      $inc: { totalUsage: 1 },
    }).lean();

    request.clientUsage = {
      minuteWindowStart: windowStart,
      minuteCount: updateResult.count,
      dayKey,
      dailyCount: dailyUsage.count,
    };
    return next();
  } catch (error) {
    console.error('*** usageTracker error:', error.message);
    return next(error);
  }
}

module.exports = { trackUsage };
