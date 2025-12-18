'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS_BACK = Number(process.env.WEATHER_DEFAULT_DAYS_BACK) || 3;
const DEFAULT_DAYS_FORWARD = Number(process.env.WEATHER_DEFAULT_DAYS_FORWARD) || 14;
const MAX_DAYS_BACK = Number(process.env.WEATHER_MAX_DAYS_BACK) || 60; // matches retention
const MAX_DAYS_FORWARD = Number(process.env.WEATHER_MAX_DAYS_FORWARD) || 14; // API forecast horizon
const SEGMENT_MAX_DAYS_BACK = Number(process.env.WEATHER_SEGMENT_MAX_DAYS_BACK) || 7;
const SEGMENT_MAX_DAYS_FORWARD = Number(process.env.WEATHER_SEGMENT_MAX_DAYS_FORWARD) || 14;
const DEFAULT_BACKFILL_DAYS = Number(process.env.WEATHER_BACKFILL_DAYS) || 14;
const FETCH_INTERVAL_MS = Number(process.env.WEATHER_FETCH_INTERVAL_MS) || 2 * 60 * 60 * 1000; // 2 hours
const CLEAN_INTERVAL_MS = Number(process.env.WEATHER_CLEAN_INTERVAL_MS) || 2 * 60 * 60 * 1000; // aligns with fetch cadence
const BACKFILL_INTERVAL_MS = Number(process.env.WEATHER_BACKFILL_INTERVAL_MS) || 24 * 60 * 60 * 1000; // once daily backfill
const DAYS_TO_KEEP = Number(process.env.WEATHER_DAYS_TO_KEEP) || 60; // retain ~60 days of hourly history
const DEFAULT_MAX_DISTANCE_KM = Number(process.env.WEATHER_MAX_DISTANCE_KM) || 50;

module.exports = {
  MS_PER_DAY,
  DEFAULT_DAYS_BACK,
  DEFAULT_DAYS_FORWARD,
  MAX_DAYS_BACK,
  MAX_DAYS_FORWARD,
  SEGMENT_MAX_DAYS_BACK,
  SEGMENT_MAX_DAYS_FORWARD,
  DEFAULT_BACKFILL_DAYS,
  FETCH_INTERVAL_MS,
  CLEAN_INTERVAL_MS,
  BACKFILL_INTERVAL_MS,
  DAYS_TO_KEEP,
  DEFAULT_MAX_DISTANCE_KM,
};
