'use strict';

const axios = require('axios');
const cache = require('./cache');
const hourlyWeatherDb = require('../models/hourlyWeatherDb');

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'snowfall',
  'windspeed_10m',
  'cloudcover',
  'visibility',
  'weathercode'
].join(',');

// ******************* Constants *******************
// Simple weathercode → condition/icon mapping (extend as needed)
function mapWeatherCode(code) {
  const table = {
    0: { conditions: 'Clear', icon: 'clear-day' },
    1: { conditions: 'Mainly Clear', icon: 'clear-day' },
    2: { conditions: 'Partly Cloudy', icon: 'partly-cloudy-day' },
    3: { conditions: 'Cloudy', icon: 'cloudy' },
    45: { conditions: 'Fog', icon: 'fog' },
    48: { conditions: 'Depositing Rime Fog', icon: 'fog' },
    51: { conditions: 'Drizzle', icon: 'rain' },
    53: { conditions: 'Drizzle', icon: 'rain' },
    55: { conditions: 'Drizzle', icon: 'rain' },
    56: { conditions: 'Freezing Drizzle', icon: 'sleet' },
    57: { conditions: 'Freezing Drizzle', icon: 'sleet' },
    61: { conditions: 'Rain', icon: 'rain' },
    63: { conditions: 'Rain', icon: 'rain' },
    65: { conditions: 'Heavy Rain', icon: 'rain' },
    66: { conditions: 'Freezing Rain', icon: 'sleet' },
    67: { conditions: 'Freezing Rain', icon: 'sleet' },
    71: { conditions: 'Snow', icon: 'snow' },
    73: { conditions: 'Snow', icon: 'snow' },
    75: { conditions: 'Snow', icon: 'snow' },
    77: { conditions: 'Snow Grains', icon: 'snow' },
    80: { conditions: 'Rain Showers', icon: 'rain' },
    81: { conditions: 'Rain Showers', icon: 'rain' },
    82: { conditions: 'Rain Showers', icon: 'rain' },
    85: { conditions: 'Snow Showers', icon: 'snow' },
    86: { conditions: 'Snow Showers', icon: 'snow' },
    95: { conditions: 'Thunderstorm', icon: 'thunder' },
    96: { conditions: 'Thunderstorm with Hail', icon: 'thunder-rain' },
    99: { conditions: 'Thunderstorm with Hail', icon: 'thunder-rain' },
  };
  return table[code] || { conditions: 'Unknown', icon: 'cloudy' };
}

const toF = (c) => c == null ? null : (c * 9) / 5 + 32;
const mmToIn = (mm) => mm == null ? null : mm / 25.4;
const cmToIn = (cm) => cm == null ? null : cm / 2.54;

// ******************* Weather API fetch *******************
async function fetchLocation(location) {
  console.log(`Fetching Weather API data for: ${location.name} on ${Date()}`);

  const { lat, lon, name } = location;
  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_FIELDS}&timezone=auto`;
  const { data } = await axios.get(url);

  const times = data.hourly.time;
  const temps = data.hourly.temperature_2m;
  const feels = data.hourly.apparent_temperature;
  const precip = data.hourly.precipitation;
  const precipProb = data.hourly.precipitation_probability;
  const snowfall = data.hourly.snowfall;          // cm from Open-Meteo
  const wind = data.hourly.windspeed_10m;         // km/h
  const clouds = data.hourly.cloudcover;          // %
  const visibility = data.hourly.visibility;      // meters
  const weathercodes = data.hourly.weathercode;   // numeric codes

  const docs = [];
  for (let i = 0; i < times.length; i++) {
    const dt = new Date(times[i]);
    const epochMs = dt.getTime();
    const { conditions, icon } = mapWeatherCode(weathercodes[i]);

    docs.push({
      key: `${location._id}-${epochMs}`,
      resort: name,
      locationId: String(location._id),
      dateTimeEpoch: epochMs,
      dayOfWeek: dt.getUTCDay(),
      date: dt.getUTCDate(),
      month: dt.getUTCMonth() + 1,
      year: dt.getUTCFullYear(),
      dateTime: times[i],
      hour: dt.getUTCHours(),
      min: dt.getUTCMinutes(),
      precipProb: precipProb?.[i],
      precipType: [snowfall?.[i] > 0 ? 'snow' : 'rain'], // naive; adjust if needed
      precip: mmToIn(precip?.[i]),
      snow: cmToIn(snowfall?.[i]),
      windspeed: wind?.[i],          // in km/h; convert to mph if you prefer: *0.621371
      cloudCover: clouds?.[i],
      visibility: visibility?.[i] != null ? visibility[i] / 1609.34 : null, // m → miles
      conditions,
      icon,
      temp: toF(temps?.[i]),
      feelsLike: toF(feels?.[i]),
    });
  }

  // Upsert all docs
  if (docs.length) {
    const ops = docs.map((doc) => ({
      updateOne: { filter: { key: doc.key }, update: doc, upsert: true },
    }));
    await hourlyWeatherDb.bulkWrite(ops, { ordered: false });
  }
}

async function fetchAllLocations() {
  // ensure cache is populated
  if (!cache['locations'] || cache['locations'].length === 0) {
    await cache.refreshLocationsCache();
  }
  const locations = cache['locations'] || [];
  for (const location of locations) {
    try {
      await fetchLocation(location);
    } catch (err) {
      console.log(`Open-Meteo fetch failed for ${location.name}:`, err.message);
    }
  }
  // refresh cache of hourly weather if you keep one
  cache['hourlyWeather'] = await hourlyWeatherDb.find({});
}

// ******************* DB Maintenance *******************
async function removeOrphanHourlyWeather() {
  try {
    // ensure locations cache is current
    if (!cache['locations'] || cache['locations'].length === 0) {
      await cache.refreshLocationsCache();
    }
    const locationIds = (cache['locations'] || []).map((r) => String(r._id));
    if (locationIds.length === 0) return;

    // only delete if the record is tied to a locationId
    const result = await hourlyWeatherDb.deleteMany({
      locationId: { $exists: true, $nin: locationIds },
    });
    console.log(`Removed ${result.deletedCount || 0} orphan hourly weather docs`);
  } catch (err) {
    console.log('removeOrphanHourlyWeather error:', err.message);
  }
}

async function removeOldHourlyWeather() {
  try {
    const daysToKeep = 60
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000; // 7 days in ms
    const result = await hourlyWeatherDb.deleteMany({ dateTimeEpoch: { $lt: cutoff } });
    console.log(`Removed ${result.deletedCount || 0} old hourly weather docs`);
  } catch (err) {
    console.log('removeOldHourlyWeather error:', err.message);
  }
}

// ******************* Scheduler *******************
function weatherApiScheduler() {
  // initial run
  removeOrphanHourlyWeather()
  removeOldHourlyWeather()
  fetchAllLocations();

  // every 2 hours (7200000 ms)
  const interval = 7200000
  setInterval(removeOrphanHourlyWeather, interval);
  setInterval(removeOldHourlyWeather, interval);
  setInterval(fetchAllLocations, interval);
}

module.exports = { weatherApiScheduler, fetchAllLocations, fetchLocation };
