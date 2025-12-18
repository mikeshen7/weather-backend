'use strict';

const mongoose = require('mongoose');
require('dotenv').config();
const Location = require('./locationsDb');

const databaseName = process.env.DB_NAME || 'weather';

// Seed data: ski resorts flagged for filtering, plus example postal centroids
const seedLocations = [
  { name: 'Palisades Tahoe', country: 'US', region: 'CA', lat: 39.191, lon: -120.24853, tz_iana: 'America/Los_Angeles', isSkiResort: true },
  { name: 'Mammoth Mountain', country: 'US', region: 'CA', lat: 37.65132, lon: -119.0268, tz_iana: 'America/Los_Angeles', isSkiResort: true },
  { name: 'Crystal Mountain Resort', country: 'US', region: 'WA', lat: 46.93542814527114, lon: -121.47471038682461, tz_iana: 'America/Los_Angeles', isSkiResort: true },
  { name: 'Mt. Bachelor', country: 'US', region: 'OR', lat: 44.00314, lon: -121.67806, tz_iana: 'America/Los_Angeles', isSkiResort: true },
  { name: 'Summit at Snoqualmie', country: 'US', region: 'WA', lat: 47.42471625304692, lon: -121.41642693098201, tz_iana: 'America/Los_Angeles', isSkiResort: true },
  { name: '80202 (Denver, CO)', country: 'US', region: 'CO', lat: 39.7509, lon: -104.9965, tz_iana: 'America/Denver', isSkiResort: false },
  { name: '81657 (Vail, CO)', country: 'US', region: 'CO', lat: 39.6416, lon: -106.3742, tz_iana: 'America/Denver', isSkiResort: false },
];

async function seed() {
  try {
    await mongoose.connect(`${process.env.DB_URL}${databaseName}?retryWrites=true&w=majority`);
    console.log('Connected');

    const ops = seedLocations.map((loc) => ({
      updateOne: {
        filter: { name: loc.name, country: loc.country, region: loc.region },
        update: { $setOnInsert: loc },
        upsert: true,
      },
    }));

    const result = await Location.bulkWrite(ops, { ordered: false });
    console.log(`Upserted ${result.upsertedCount || 0} locations.`);
  } catch (err) {
    console.error('Seed error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
