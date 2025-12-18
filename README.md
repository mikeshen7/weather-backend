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
  - `startSchedule` fetches hourly weather for all locations; expose your own read endpoints as needed.

- Health:
  - `GET /health`

## Maintenance & Schedules

- Locations: cache refresh runs on startup and every 2 hours.
- Weather: Open-Meteo fetch runs on startup (or delayed) and every 2 hours. Old hourly data (>60 days) and orphaned hourly records (for deleted locations) are cleaned.

## Data & Timezones

- Store/process in UTC. Include location timezone (tz_iana) and convert for display on the frontend.
- Hourly weather is the source of truth.

## Seeding

Seed locations with:
`node models/seedLocations.js`
