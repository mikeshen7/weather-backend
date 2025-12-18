'use strict';

const locationsDb = require('../models/locationsDb');

const locationCache = {
  locations: [],
};

function buildDisplayName(doc) {
  const parts = [doc.name];
  const locality = [doc.region, doc.country].filter(Boolean).join(', ');
  if (locality) parts.push(locality);
  return parts.join(' - ');
}

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function endpointCreateLocation(request, response, next) {
  try {
    const { name, country, region = '', lat, lon, tz_iana, isSkiResort } = request.body || {};
    if (!name || !country || lat === undefined || lon === undefined || !tz_iana) {
      return response.status(400).send('name, country, lat, lon, and tz_iana are required');
    }

    const doc = await locationsDb.create({
      name: String(name).trim(),
      country: String(country).trim(),
      region: String(region).trim(),
      lat: Number(lat),
      lon: Number(lon),
      tz_iana: String(tz_iana).trim(),
      isSkiResort: parseBoolean(isSkiResort) ?? false,
    });

    await refreshLocationsCache();

    console.log(JSON.stringify({
      event: 'location_created',
      locationId: String(doc._id),
      name: doc.name,
    }));

    return response.status(201).send({
      id: doc._id,
      name: doc.name,
      displayName: buildDisplayName(doc),
      country: doc.country,
      region: doc.region,
      lat: doc.lat,
      lon: doc.lon,
      tz_iana: doc.tz_iana,
      isSkiResort: doc.isSkiResort,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).send('Location already exists (name/country/region or lat/lon conflict)');
    }
    console.error('*** locations endpointCreateLocation error:', error.message);
    next(error);
  }
}

async function endpointSearchLocations(request, response, next) {
  try {
    const { q = '', isSkiResort } = request.query;
    const limit = Math.min(parseInt(request.query.limit, 10) || 20, 50);
    const filter = {};

    if (q) {
      filter.name = { $regex: q, $options: 'i' }; // case-insensitive partial match
    }

    const parsedFlag = parseBoolean(isSkiResort);
    if (parsedFlag !== undefined) {
      filter.isSkiResort = parsedFlag;
    }

    const docs = await locationsDb.find(filter).sort({ name: 1 }).limit(limit).lean();
    const results = docs.map((doc) => ({
      id: doc._id,
      name: doc.name,
      displayName: buildDisplayName(doc),
      country: doc.country,
      region: doc.region,
      lat: doc.lat,
      lon: doc.lon,
      tz_iana: doc.tz_iana,
      isSkiResort: doc.isSkiResort,
    }));

    return response.status(200).send(results);
  } catch (error) {
    console.error('*** locations endpointSearchLocations error:', error.message);
    next(error);
  }
}

async function endpointNearestLocation(request, response, next) {
  try {
    const lat = parseFloat(request.query.lat);
    const lon = parseFloat(request.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return response.status(400).send('lat and lon are required numeric query params');
    }

    const maxDistanceKm = parseFloat(request.query.maxDistanceKm) || 50; // default 50km
    const deltaLat = maxDistanceKm / 111; // approx degrees per km
    const deltaLon = deltaLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.1); // avoid divide-by-zero near poles

    const candidates = await locationsDb.find({
      lat: { $gte: lat - deltaLat, $lte: lat + deltaLat },
      lon: { $gte: lon - deltaLon, $lte: lon + deltaLon },
    }).lean();

    let nearest = null;
    let nearestDistance = Infinity;

    for (const doc of candidates) {
      const d = haversineKm(lat, lon, doc.lat, doc.lon);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = doc;
      }
    }

    if (!nearest || nearestDistance > maxDistanceKm) {
      return response.status(404).send('No location found within maxDistanceKm');
    }

    return response.status(200).send({
      id: nearest._id,
      name: nearest.name,
      displayName: buildDisplayName(nearest),
      country: nearest.country,
      region: nearest.region,
      lat: nearest.lat,
      lon: nearest.lon,
      tz_iana: nearest.tz_iana,
      isSkiResort: nearest.isSkiResort,
      distanceKm: nearestDistance,
    });
  } catch (error) {
    console.error('*** locations endpointNearestLocation error:', error.message);
    next(error);
  }
}

async function endpointDeleteLocation(request, response, next) {
  try {
    const { id } = request.params;
    if (!id) {
      return response.status(400).send('Location id is required');
    }

    const deleted = await locationsDb.findByIdAndDelete(id);
    if (!deleted) {
      return response.status(404).send('Location not found');
    }

    await refreshLocationsCache();

    console.log(JSON.stringify({
      event: 'location_deleted',
      locationId: String(deleted._id),
      name: deleted.name,
    }));

    return response.status(200).send('Location deleted');
  } catch (error) {
    console.error('*** locations endpointDeleteLocation error:', error.message);
    next(error);
  }
}

async function endpointUpdateLocation(request, response, next) {
  try {
    const { id } = request.params;
    if (!id) {
      return response.status(400).send('Location id is required');
    }

    const { name, country, region = '', lat, lon, tz_iana, isSkiResort } = request.body || {};
    if (!name || !country || lat === undefined || lon === undefined || !tz_iana) {
      return response.status(400).send('name, country, lat, lon, and tz_iana are required');
    }

    const updated = await locationsDb.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        country: String(country).trim(),
        region: String(region).trim(),
        lat: Number(lat),
        lon: Number(lon),
        tz_iana: String(tz_iana).trim(),
        isSkiResort: parseBoolean(isSkiResort) ?? false,
      },
      { new: true }
    );

    if (!updated) {
      return response.status(404).send('Location not found');
    }

    await refreshLocationsCache();

    console.log(JSON.stringify({
      event: 'location_updated',
      locationId: String(updated._id),
      name: updated.name,
    }));

    return response.status(200).send({
      id: updated._id,
      name: updated.name,
      displayName: buildDisplayName(updated),
      country: updated.country,
      region: updated.region,
      lat: updated.lat,
      lon: updated.lon,
      tz_iana: updated.tz_iana,
      isSkiResort: updated.isSkiResort,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).send('Location already exists (name/country/region or lat/lon conflict)');
    }
    console.error('*** locations endpointUpdateLocation error:', error.message);
    next(error);
  }
}

async function refreshLocationsCache() {
  locationCache.locations = await locationsDb.find({});
  console.log(JSON.stringify({
    event: 'locations_cache_refreshed',
    count: locationCache.locations.length,
  }));
  return locationCache.locations;
}

function getCachedLocations() {
  return locationCache.locations;
}

module.exports = {
  endpointSearchLocations,
  endpointNearestLocation,
  endpointCreateLocation,
  endpointDeleteLocation,
  endpointUpdateLocation,
  startLocationMaintenance: async function startLocationMaintenance() {
    await refreshLocationsCache();
    setInterval(refreshLocationsCache, 24 * 60 * 60 * 1000);
  },
  refreshLocationsCache,
  getCachedLocations,
};
