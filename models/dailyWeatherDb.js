'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const collectionName = 'dailyWeatherDb';

// Create Schema
const dailyWeatherSchema = new Schema(
  {
    key: { type: String, required: true, unique: true},
    startEpoch: { type: Number },
    endEpoch: { type: Number },
    resort: { type: String, required: true },
    dateTimeEpoch: { type: Number, required: true }, // in milliseconds since 1970, of the start time (i.e. 6AM, 12PM, 6PM)
    time: { type: String }, // AM, PM, NT
    dayOfWeek: { type: Number }, // 1-7
    date: { type: Number }, // 1-31
    month: { type: Number }, // 1-12
    year: { type: Number }, // i.e. 2023
    precipProb: { type: Number }, // 0-100%, AVERAGE
    precipType: { type: Array }, // Array, with possible values rain, snow, freezingrain, ice
    precip: { type: Number }, // inches, including snow or ice, TOTAL
    snow: { type: Number }, // inches, TOTAL
    windspeed: { type: Number }, // average windspeed, mph, AVERAGE
    cloudCover: { type: Number }, // 0-100%, AVERAGE
    visibility: { type: Number }, // distance at which distant objects are visible, miles, AVERAGE
    conditions: { type: String }, // text description
    icon: { type: String }, // https://www.visualcrossing.com/resources/documentation/weather-api/defining-icon-set-in-the-weather-api/
    temp: { type: Number }, // °F, AVERAGE
    feelsLike: { type: Number }, // °F, AVERAGE
  },
  { collection: collectionName }
);

// Create Collection
const weatherDbCollection = mongoose.model(collectionName, dailyWeatherSchema);

module.exports = weatherDbCollection;
