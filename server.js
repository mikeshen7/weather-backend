'use strict';
// *** REQUIRES
require('dotenv').config();                      // *** allows use of .env file
const express = require('express');              // *** Backend server
const cors = require('cors');                    // *** Middleware 
const mongoose = require('mongoose');            // *** Database
const weatherApi = require('./modules/weatherApi');
const locations = require('./modules/locations');


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
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`server listening on ${PORT}`));

// *** Location Endpoints
app.post('/locations', (request, response, next) => locations.endpointCreateLocation(request, response, next));
app.get('/locations', (request, response, next) => locations.endpointSearchLocations(request, response, next));
app.get('/locations/nearest', (request, response, next) => locations.endpointNearestLocation(request, response, next));
app.delete('/locations/:id', (request, response, next) => locations.endpointDeleteLocation(request, response, next));

// *** Weather Endpoints
// app.get('/hourlyWeather/:resortName', (request, response, next) => hourlyWeather.endPointReadHourlyWeather(request, response, next));
// app.get('/dailyWeather/:resortName', (request, response, next) => dailyWeather.endPointReadDailyWeather(request, response, next));


// *** Misc ENDPOINTS
app.get('/', (request, response) => response.status(200).send('Welcome'));
app.get('/health', (request, response) => response.status(200).send('Health OK'));

app.get('*', (request, response) => response.status(404).send('Not available'));
app.use((error, request, response, next) => response.status(500).send(error.message));

// *** Main
async function start() {
  await locations.startLocationMaintenance();

  setTimeout(async () => {
    await weatherApi.weatherApiScheduler();
  }, 1000);
}

// *** Main
start();
