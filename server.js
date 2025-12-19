'use strict';
// *** REQUIRES
require('dotenv').config();                      // *** allows use of .env file
const express = require('express');              // *** Backend server
const cors = require('cors');                    // *** Middleware 
const mongoose = require('mongoose');            // *** Database
const weatherApi = require('./modules/weatherApi');
const appMaintenance = require('./modules/appMaintenance');
const locations = require('./modules/locations');
const weatherHourly = require('./modules/weatherHourly');
const weatherDaily = require('./modules/weatherDaily');
const appConfig = require('./modules/appConfig');
const adminConfig = require('./modules/adminConfig');
const { requireAdminToken } = require('./modules/auth');
const { requireClientApiKey } = require('./modules/clientAuth');
const { trackUsage } = require('./modules/usageTracker');
const adminApiClients = require('./modules/adminApiClients');

// *** Database connection and test
const databaseName = process.env.DB_NAME || 'weather';
mongoose.connect(`${process.env.DB_URL}${databaseName}?retryWrites=true&w=majority`);
const database = mongoose.connection;
database.on('error', console.error.bind(console, 'connection error:'));
database.once('open', function () {
  console.log('Mongoose is connected');
});
mongoose.set('strictQuery', false);


// *** Server and middleware connection
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`server listening on ${PORT}`));

// *** Location Endpoints
app.post('/locations', requireAdminToken, (request, response, next) => locations.endpointCreateLocation(request, response, next));
app.use(['/locations', '/weather'], requireClientApiKey, trackUsage);
app.get('/locations', (request, response, next) => locations.endpointSearchLocations(request, response, next));
app.get('/locations/nearest', (request, response, next) => locations.endpointNearestLocation(request, response, next));
app.get('/locations/lookup', (request, response, next) => locations.endpointLookupLocationMetadata(request, response, next));
app.delete('/locations/:id', requireAdminToken, (request, response, next) => locations.endpointDeleteLocation(request, response, next));
app.put('/locations/:id', requireAdminToken, (request, response, next) => locations.endpointUpdateLocation(request, response, next));

// *** Weather Endpoints
app.get('/weather/hourly', (request, response, next) => weatherHourly.endpointHourlyWeather(request, response, next));
app.get('/weather/hourly/by-coords', (request, response, next) => weatherHourly.endpointHourlyWeatherByCoords(request, response, next));
app.get('/weather/daily/overview', (request, response, next) => weatherDaily.endpointDailyOverview(request, response, next));
app.get('/weather/daily/overview/by-coords', (request, response, next) => weatherDaily.endpointDailyOverviewByCoords(request, response, next));
app.get('/weather/daily/segments', (request, response, next) => weatherDaily.endpointDailySegments(request, response, next));
app.get('/weather/daily/segments/by-coords', (request, response, next) => weatherDaily.endpointDailySegmentsByCoords(request, response, next));

// *** Admin Config Endpoints
app.get('/admin/config', requireAdminToken, (req, res, next) => adminConfig.endpointGetConfig(req, res, next));
app.put('/admin/config/:key', requireAdminToken, (req, res, next) => adminConfig.endpointUpdateConfig(req, res, next));
app.get('/admin/api-clients', requireAdminToken, (req, res, next) => adminApiClients.endpointListClients(req, res, next));
app.post('/admin/api-clients', requireAdminToken, (req, res, next) => adminApiClients.endpointCreateClient(req, res, next));
app.put('/admin/api-clients/:id', requireAdminToken, (req, res, next) => adminApiClients.endpointUpdateClient(req, res, next));
app.post('/admin/api-clients/:id/toggle', requireAdminToken, (req, res, next) => adminApiClients.endpointToggleClient(req, res, next));
app.delete('/admin/api-clients/:id', requireAdminToken, (req, res, next) => adminApiClients.endpointDeleteClient(req, res, next));

// *** Misc ENDPOINTS
app.get('/', (request, response) => response.status(200).send('Welcome'));
app.get('/health', (request, response) => response.status(200).send('Health OK'));

app.get('*', (request, response) => response.status(404).send('Not available'));
app.use((error, request, response, next) => {
  console.error('*** express error:', error.message);
  return response.status(500).send(error.message);
});

// *** Main
async function start() {
  await appConfig.ensureWeatherConfigDefaults();
  await locations.startLocationMaintenance();
  setTimeout(() => {
    appMaintenance.startMaintenance();
  }, 1000);
}

// *** Main
start();
