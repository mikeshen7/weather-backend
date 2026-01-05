'use strict';

const appConfigDb = require('../models/appConfigDb');

const rateLimitDefault = Number(process.env.CLIENT_API_RATE_LIMIT_DEFAULT);
const dailyQuotaDefault = Number(process.env.CLIENT_API_DAILY_QUOTA_DEFAULT);
const adminRateLimitMaxDefault = Number(process.env.ADMIN_RATE_LIMIT_MAX);
const adminRateLimitWindowDefault = Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS);

const defaults = {
  MS_PER_DAY: 24 * 60 * 60 * 1000,
  DEFAULT_DAYS_BACK: 3,
  DEFAULT_DAYS_FORWARD: 14,
  MAX_DAYS_BACK: 60,
  MAX_DAYS_FORWARD: 14,
  SEGMENT_MAX_DAYS_BACK: 7,
  SEGMENT_MAX_DAYS_FORWARD: 14,
  BACKFILL_DAYS: 14,
  FETCH_INTERVAL_HOURS: 2,
  CLEAN_INTERVAL_HOURS: 24,
  BACKFILL_INTERVAL_HOURS: 24,
  DAYS_TO_KEEP: 60,
  FETCH_RADIUS_MI: 30,
  CONFIG_REFRESH_INTERVAL_HOURS: 24,
  LOCATION_RADIUS_MI: 5,
  CLIENT_RATE_LIMIT_DEFAULT: Number.isFinite(rateLimitDefault) ? rateLimitDefault : 60,
  CLIENT_DAILY_QUOTA_DEFAULT: Number.isFinite(dailyQuotaDefault) ? dailyQuotaDefault : 5000,
  ADMIN_RATE_LIMIT_MAX: Number.isFinite(adminRateLimitMaxDefault) ? adminRateLimitMaxDefault : 60,
  ADMIN_RATE_LIMIT_WINDOW_MS: Number.isFinite(adminRateLimitWindowDefault) ? adminRateLimitWindowDefault : 60 * 1000,
};

const DEFAULT_CONFIG = {
  DEFAULT_DAYS_BACK: {
    value: defaults.DEFAULT_DAYS_BACK,
    description: 'Default lookback (days) for hourly queries.'
  },
  DEFAULT_DAYS_FORWARD: {
    value: defaults.DEFAULT_DAYS_FORWARD,
    description: 'Default look-forward (days) for hourly queries.'
  },
  MAX_DAYS_BACK: {
    value: defaults.MAX_DAYS_BACK,
    description: 'Maximum historical days allowed for queries.'
  },
  MAX_DAYS_FORWARD: {
    value: defaults.MAX_DAYS_FORWARD,
    description: 'Maximum future days allowed from provider.'
  },
  SEGMENT_MAX_DAYS_BACK: {
    value: defaults.SEGMENT_MAX_DAYS_BACK,
    description: 'Max historical days for daily segments.'
  },
  SEGMENT_MAX_DAYS_FORWARD: {
    value: defaults.SEGMENT_MAX_DAYS_FORWARD,
    description: 'Max future days for daily segments.'
  },
  BACKFILL_DAYS: {
    value: defaults.BACKFILL_DAYS,
    description: 'Days of history to backfill on startup.'
  },
  FETCH_INTERVAL_HOURS: {
    value: defaults.FETCH_INTERVAL_HOURS,
    description: 'Interval for forecast fetch jobs (hours).'
  },
  CLEAN_INTERVAL_HOURS: {
    value: defaults.CLEAN_INTERVAL_HOURS,
    description: 'Interval for cleanup jobs (hours).'
  },
  BACKFILL_INTERVAL_HOURS: {
    value: defaults.BACKFILL_INTERVAL_HOURS,
    description: 'Interval between automatic backfills (hours).'
  },
  DAYS_TO_KEEP: {
    value: defaults.DAYS_TO_KEEP,
    description: 'Number of days of hourly data to retain.'
  },
  FETCH_RADIUS_MI: {
    value: defaults.FETCH_RADIUS_MI,
    description: 'Max distance (miles) when searching nearest location.'
  },
  CONFIG_REFRESH_INTERVAL_HOURS: {
    value: defaults.CONFIG_REFRESH_INTERVAL_HOURS,
    description: 'Interval between automatic config cache refreshes (hours).'
  },
  LOCATION_RADIUS_MI: {
    value: defaults.LOCATION_RADIUS_MI,
    description: 'Minimum allowed distance (miles) between stored locations.'
  },
  CLIENT_RATE_LIMIT_DEFAULT: {
    value: defaults.CLIENT_RATE_LIMIT_DEFAULT,
    description: 'Default per-minute request limit for new API clients (set <=0 for unlimited).'
  },
  CLIENT_DAILY_QUOTA_DEFAULT: {
    value: defaults.CLIENT_DAILY_QUOTA_DEFAULT,
    description: 'Default daily request quota for new API clients (set <=0 for unlimited).'
  },
  ADMIN_RATE_LIMIT_MAX: {
    value: defaults.ADMIN_RATE_LIMIT_MAX,
    description: 'Max admin requests per window (0 or negative = unlimited).'
  },
  ADMIN_RATE_LIMIT_WINDOW_MS: {
    value: defaults.ADMIN_RATE_LIMIT_WINDOW_MS,
    description: 'Admin rate limit window in milliseconds.'
  },
};

const cache = new Map();
let values = buildValuesFromCache();

async function ensureWeatherConfigDefaults() {
  for (const [key, meta] of Object.entries(DEFAULT_CONFIG)) {
    await appConfigDb.updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          value: meta.value,
          description: meta.description,
        },
      },
      { upsert: true }
    );
  }
  await refreshConfigCache();
}

async function refreshConfigCache() {
  const docs = await appConfigDb.find({}).lean();
  cache.clear();
  docs.forEach((doc) => {
    cache.set(doc.key, doc.value);
  });
  values = buildValuesFromCache();
  console.log(JSON.stringify({
    event: 'config_cache_refreshed',
    entries: cache.size,
  }));
  return getConfigMap();
}

function getConfigMap() {
  const map = {};
  for (const [key, value] of cache.entries()) {
    map[key] = value;
  }
  return map;
}

async function setConfigValue(key, value) {
  const meta = DEFAULT_CONFIG[key];
  await appConfigDb.updateOne(
    { key },
    {
      $set: {
        key,
        value,
        description: meta?.description || '',
      },
    },
    { upsert: true }
  );
  cache.set(key, value);
  values = buildValuesFromCache();
  return { key, value };
}

function buildValuesFromCache() {
  return {
    MS_PER_DAY: defaults.MS_PER_DAY,
    DEFAULT_DAYS_BACK: readValue('DEFAULT_DAYS_BACK', defaults.DEFAULT_DAYS_BACK),
    DEFAULT_DAYS_FORWARD: readValue('DEFAULT_DAYS_FORWARD', defaults.DEFAULT_DAYS_FORWARD),
    MAX_DAYS_BACK: readValue('MAX_DAYS_BACK', defaults.MAX_DAYS_BACK),
    MAX_DAYS_FORWARD: readValue('MAX_DAYS_FORWARD', defaults.MAX_DAYS_FORWARD),
    SEGMENT_MAX_DAYS_BACK: readValue('SEGMENT_MAX_DAYS_BACK', defaults.SEGMENT_MAX_DAYS_BACK),
    SEGMENT_MAX_DAYS_FORWARD: readValue('SEGMENT_MAX_DAYS_FORWARD', defaults.SEGMENT_MAX_DAYS_FORWARD),
    BACKFILL_DAYS: readValue('BACKFILL_DAYS', defaults.BACKFILL_DAYS),
    FETCH_INTERVAL_HOURS: readValue('FETCH_INTERVAL_HOURS', defaults.FETCH_INTERVAL_HOURS),
    CLEAN_INTERVAL_HOURS: readValue('CLEAN_INTERVAL_HOURS', defaults.CLEAN_INTERVAL_HOURS),
    BACKFILL_INTERVAL_HOURS: readValue('BACKFILL_INTERVAL_HOURS', defaults.BACKFILL_INTERVAL_HOURS),
    DAYS_TO_KEEP: readValue('DAYS_TO_KEEP', defaults.DAYS_TO_KEEP),
    FETCH_RADIUS_MI: readValue('FETCH_RADIUS_MI', defaults.FETCH_RADIUS_MI),
    CONFIG_REFRESH_INTERVAL_HOURS: readValue('CONFIG_REFRESH_INTERVAL_HOURS', defaults.CONFIG_REFRESH_INTERVAL_HOURS),
    LOCATION_RADIUS_MI: readValue('LOCATION_RADIUS_MI', defaults.LOCATION_RADIUS_MI),
    CLIENT_RATE_LIMIT_DEFAULT: readValue('CLIENT_RATE_LIMIT_DEFAULT', defaults.CLIENT_RATE_LIMIT_DEFAULT),
    CLIENT_DAILY_QUOTA_DEFAULT: readValue('CLIENT_DAILY_QUOTA_DEFAULT', defaults.CLIENT_DAILY_QUOTA_DEFAULT),
    ADMIN_RATE_LIMIT_MAX: readValue('ADMIN_RATE_LIMIT_MAX', defaults.ADMIN_RATE_LIMIT_MAX),
    ADMIN_RATE_LIMIT_WINDOW_MS: readValue('ADMIN_RATE_LIMIT_WINDOW_MS', defaults.ADMIN_RATE_LIMIT_WINDOW_MS),
  };
}

function readValue(key, fallback) {
  return cache.has(key) ? cache.get(key) : fallback;
}

module.exports = {
  ensureWeatherConfigDefaults,
  refreshConfigCache,
  getConfigMap,
  setConfigValue,
  DEFAULT_CONFIG,
  values: () => values,
};
