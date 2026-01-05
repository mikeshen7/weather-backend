# snow-forecast-backend

Express + MongoDB backend for weather by location (resorts, ZIP centroids, any coordinates). Locations are stored in Mongo; hourly weather is fetched from Open-Meteo, persisted, and served via HTTP endpoints.

## Setup

1) Update .env based on the sample.

(Open-Meteo needs no API key.)

Admin is disabled by default; to use admin routes/UI locally set `ADMIN_ENABLED=true` and configure magic-link auth + SMTP (see Admin section).

2) Install deps:
npm install


3) Run:
- Dev (auto-reload): `npm run dev`
- Prod: `npm start`

### API access & rate limiting

- Every client must include an API key in the `x-api-key` header (configurable via `CLIENT_API_KEY_HEADER`).
- Admin-only endpoints under `/admin/api-clients` let you list clients, mint new keys (the raw key is returned once), and toggle active/revoked status. They only mount when `ADMIN_ENABLED=true` and you’re signed in via an admin session.
- The Admin UI (`/admin.html`) is served only when `ADMIN_ENABLED=true`; it includes an “API Keys” tab for issuing keys, viewing usage stats (including today’s call count), editing rate limits, copying the current key, revoking/reactivating clients, and deleting keys without touching curl. Admin auth uses email-based magic links and sets a short-lived HttpOnly session cookie (no tokens in localStorage).
- Default per-minute and daily quotas for new API clients are editable in the Config tab via `CLIENT_RATE_LIMIT_DEFAULT` and `CLIENT_DAILY_QUOTA_DEFAULT`, so you can raise/lower plan defaults without touching env vars.
- Requests are rate limited with a token bucket backed by Mongo (`CLIENT_API_RATE_WINDOW_MIN`, `CLIENT_API_RATE_LIMIT_DEFAULT`, `CLIENT_API_DAILY_QUOTA_DEFAULT` control defaults). per-client overrides live on the client document.
- Usage stats (`totalUsage`, `lastUsedAt`) are updated on each request. Counters reset automatically as the TTL’d usage windows expire.
- Admin Users tab lets you list admins, create new ones (email/name/roles), and suspend/reactivate accounts.

### Admin auth (magic links)

- Set `ADMIN_ENABLED=true` plus:
  - `ADMIN_MAGIC_LINK_BASE_URL` (e.g. `http://localhost:3001` for dev),
  - `ADMIN_SESSION_SECRET` (strong random string),
  - `ADMIN_COOKIE_SECURE` (`false` for local HTTP, `true` for HTTPS),
  - `ADMIN_BOOTSTRAP_EMAIL` to allow creating the first admin when they request a link.
- SMTP (Gmail example): `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=<gmail address>`, `SMTP_PASS=<app password>`, `SMTP_FROM=<from address>`. Gmail requires an App Password.
- Flow: enter admin email on `/admin.html` → backend emails a one-time link → clicking it sets an HttpOnly admin session cookie and redirects back. Logout clears the cookie. Admin requests rely on the session, not bearer tokens.
- Roles: bootstrap email gets `owner` + `admin`; new users can be `admin` (full) or `read-only`. Read-only users can view Locations/Hourly/Daily but cannot modify locations or access API Keys/Config/Admins tabs.
- Admin rate limit (requests per minute) is configurable via Config UI (`ADMIN_RATE_LIMIT_MAX` key).
  - Session/magic token lifetimes are configurable via Config UI (`ADMIN_SESSION_TTL_MINUTES`, `ADMIN_MAGIC_TOKEN_TTL_MINUTES`).

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
  - `GET /admin/config` lists config entries, `PUT /admin/config/:key` updates a value (requires admin session cookie)
  - Minimal UI served at `/admin.html` to view/edit config values (radius now uses miles); admin auth is magic-link based

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
