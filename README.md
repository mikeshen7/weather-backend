# snow-forecast-backend

Express + MongoDB backend for weather by location (resorts, ZIP centroids, any coordinates). Locations are stored in Mongo; hourly weather is fetched from Open-Meteo, persisted, and served via HTTP endpoints.

## Setup

1) Update .env based on the sample.

(Open-Meteo needs no API key.)

2) Install deps:
npm install


3) Run:
- Dev (auto-reload): `npm run dev`
- Prod: `npm start`

## Endpoints (key ones)

- Locations:
  - Create: POST /locations
    ```json
    {
      "name": "San Francisco",
      "country": "US",
      "region": "CA",
      "lat": 37.77,
      "lon": -122.42,
      "tz_iana": "America/Los_Angeles",
      "isSkiResort": false
    }
    ```
  - Get all locations: GET /locations
  - Nearest: GET /locations/nearest?lat=39.6&lon=-106.4&maxDistanceKm=30
  - Delete: DELETE /locations/64b1c0f2e6c8f9d3a1b2c3d4
 

- Weather (from Open-Meteo, stored hourly):
  - `GET /weather/hourly?locationId=<mongoId>&daysBack=3&daysForward=14&sort=asc` (requires `locationId`, optional `daysBack`, `daysForward`, `sort`; defaults to 3 days back / 14 days forward)
  - `GET /weather/hourly/by-coords?lat=39.6&lon=-106.4&daysBack=3` resolves the nearest stored location in one call (optional `maxDistanceKm`, `daysForward`)
  - `GET /weather/daily/overview?locationId=<mongoId>&daysForward=10` aggregates hourly data (in the location’s timezone) into per-day entries exposing: min/max temps, precip/snow totals, avg windspeed/precip prob/cloud cover/visibility, and a representative hour near local noon (defaults 3 days back / 14 days forward)
  - `GET /weather/daily/overview/by-coords?lat=39.6&lon=-106.4&daysForward=10` provides the same aggregation but resolves the nearest stored location by coordinates (optional `maxDistanceKm`)
  - `GET /weather/daily/segments?locationId=<mongoId>&daysForward=10` groups each day into four dayparts (overnight/morning/afternoon/evening) with min/max temps, precip/snow totals, averages, and representative hours
  - `GET /weather/daily/segments/by-coords?lat=39.6&lon=-106.4&daysForward=10` returns the same daypart data after resolving a location from coordinates
  - `startSchedule` fetches hourly weather for all locations; endpoints query Mongo-backed data.
- Admin:
  - `GET /admin/config` lists config entries, `PUT /admin/config/:key` updates a value (requires `x-admin-token`)
  - Minimal UI served at `/admin.html` to view/edit config values (radius now uses miles)

- Health:
  - `GET /health`

## Maintenance & Schedules

- Locations: cache refresh runs on startup and every 2 hours.
- Weather: Open-Meteo fetch runs on startup (or delayed) and every 2 hours. Old hourly data (>60 days) and orphaned hourly records (for deleted locations) are cleaned.
- Backfill: A 14-day historical backfill runs on startup and once per day to keep recent history populated.

## Data & Timezones

- Store/process in UTC. Include location timezone (tz_iana) and convert for display on the frontend.
- Hourly weather is the source of truth.

## Seeding

Seed locations with:
`node models/seedLocations.js`

## Deployment

Deployed on Render
