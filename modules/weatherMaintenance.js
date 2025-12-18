'use strict';

const cache = require('./cache');
const hourlyWeatherDb = require('../models/hourlyWeatherDb');
const weatherApi = require('./weatherApi');
const {
  MS_PER_DAY,
  DEFAULT_BACKFILL_DAYS,
  FETCH_INTERVAL_MS,
  CLEAN_INTERVAL_MS,
  BACKFILL_INTERVAL_MS,
  DAYS_TO_KEEP,
} = require('./weatherConfig');

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// fetchAllWeather iterates every cached location and fetches weather data.
async function fetchAllWeather(options = {}) {
  const context = options.context || 'forecast';
  const requestOptions = { ...options, context };
  if (!cache['locations'] || cache['locations'].length === 0) {
    await cache.refreshLocationsCache();
  }
  const locations = cache['locations'] || [];
  for (const location of locations) {
    try {
      await weatherApi.fetchLocation(location, requestOptions);
    } catch (err) {
      console.log(JSON.stringify({
        event: 'weather_fetch_error',
        locationId: String(location._id),
        name: location.name,
        context,
        error: err.message,
      }));
    }
  }
  cache['hourlyWeather'] = await hourlyWeatherDb.find({});
}

// backfillAllWeather fetches historical windows (and optionally future data).
async function backfillAllWeather(daysBack = DEFAULT_BACKFILL_DAYS, { includeFuture = false } = {}) {
  try {
    const endDate = formatDate(new Date());
    const startDate = formatDate(new Date(Date.now() - daysBack * MS_PER_DAY));
    await fetchAllWeather({ startDate, endDate, context: 'backfill' });
    if (includeFuture) {
      await fetchAllWeather({ context: 'forecast' });
    }
  } catch (error) {
    console.log('backfillAllWeather error:', error.message);
  }
}

// removeOrphanHourlyWeather deletes hourly docs for deleted locations.
async function removeOrphanHourlyWeather() {
  try {
    if (!cache['locations'] || cache['locations'].length === 0) {
      await cache.refreshLocationsCache();
    }
    const locationIds = (cache['locations'] || []).map((r) => String(r._id));
    if (locationIds.length === 0) return;

    const result = await hourlyWeatherDb.deleteMany({
      locationId: { $exists: true, $nin: locationIds },
    });
    console.log(`Removed ${result.deletedCount || 0} orphan hourly weather docs`);
  } catch (err) {
    console.log('removeOrphanHourlyWeather error:', err.message);
  }
}

// removeOldHourlyWeather purges hourly docs older than retention window.
async function removeOldHourlyWeather() {
  try {
    const cutoff = Date.now() - DAYS_TO_KEEP * MS_PER_DAY;
    const result = await hourlyWeatherDb.deleteMany({ dateTimeEpoch: { $lt: cutoff } });
    console.log(`Removed ${result.deletedCount || 0} old hourly weather docs`);
  } catch (err) {
    console.log('removeOldHourlyWeather error:', err.message);
  }
}

// startMaintenance kicks off cleanup, fetch, and backfill schedules.
function startMaintenance() {
  removeOrphanHourlyWeather();
  removeOldHourlyWeather();
  backfillAllWeather(DEFAULT_BACKFILL_DAYS, { includeFuture: true });

  setInterval(removeOrphanHourlyWeather, CLEAN_INTERVAL_MS);
  setInterval(removeOldHourlyWeather, CLEAN_INTERVAL_MS);
  setInterval(fetchAllWeather, FETCH_INTERVAL_MS);
  setInterval(() => backfillAllWeather(DEFAULT_BACKFILL_DAYS), BACKFILL_INTERVAL_MS);
}

module.exports = {
  fetchAllWeather,
  backfillAllWeather,
  removeOrphanHourlyWeather,
  removeOldHourlyWeather,
  startMaintenance,
};
