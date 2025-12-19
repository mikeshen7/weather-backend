'use strict';

const EXPLICIT_TZ_REGEX = /(Z|[+-]\d{2}:?\d{2})$/i;
const dateTimeFormatterCache = new Map();
const weekdayFormatterCache = new Map();
const WEEKDAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getDateTimeFormatter(timeZone = 'UTC') {
  if (dateTimeFormatterCache.has(timeZone)) {
    return dateTimeFormatterCache.get(timeZone);
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dateTimeFormatterCache.set(timeZone, formatter);
    return formatter;
  } catch (error) {
    return null;
  }
}

function getWeekdayFormatter(timeZone = 'UTC') {
  if (weekdayFormatterCache.has(timeZone)) {
    return weekdayFormatterCache.get(timeZone);
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
    });
    weekdayFormatterCache.set(timeZone, formatter);
    return formatter;
  } catch (error) {
    return null;
  }
}

function parseLocalIsoString(input) {
  if (!input) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || '0'),
  };
}

function getLocalPartsFromUtc(epochMs, timeZone = 'UTC') {
  if (!Number.isFinite(epochMs)) {
    return null;
  }
  const formatter = getDateTimeFormatter(timeZone);
  if (!formatter) {
    const fallback = new Date(epochMs);
    return {
      year: fallback.getUTCFullYear(),
      month: fallback.getUTCMonth() + 1,
      day: fallback.getUTCDate(),
      hour: fallback.getUTCHours(),
      minute: fallback.getUTCMinutes(),
      second: fallback.getUTCSeconds(),
      offsetMs: 0,
      weekdayIndex: fallback.getUTCDay(),
    };
  }

  const parts = formatter.formatToParts(new Date(epochMs));
  const findNumber = (type) => {
    const entry = parts.find((p) => p.type === type);
    return entry ? Number(entry.value) : null;
  };

  let year = findNumber('year');
  let month = findNumber('month');
  let day = findNumber('day');
  let hour = findNumber('hour');
  const minute = findNumber('minute');
  const second = findNumber('second') ?? 0;
  if ([year, month, day, hour, minute].some((value) => value == null || Number.isNaN(value))) {
    return null;
  }

  if (hour === 24) {
    hour = 0;
  }

  const localMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = localMs - epochMs;

  let weekdayIndex;
  const weekdayFormatter = getWeekdayFormatter(timeZone);
  if (weekdayFormatter) {
    const weekdayLabel = weekdayFormatter.format(new Date(epochMs));
    weekdayIndex = WEEKDAY_INDEX[weekdayLabel];
  }
  if (weekdayIndex == null) {
    weekdayIndex = new Date(epochMs).getUTCDay();
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    offsetMs,
    weekdayIndex,
  };
}

function localDateTimeToUtcEpoch(parts, timeZone = 'UTC', fallbackOffsetSeconds = 0) {
  if (!parts) return null;
  const { year, month, day, hour = 0, minute = 0, second = 0 } = parts;
  if ([year, month, day].some((value) => value == null || Number.isNaN(value))) {
    return null;
  }

  const baseMs = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0, 0);
  if (!timeZone) {
    return baseMs - (fallbackOffsetSeconds || 0) * 1000;
  }

  let epoch = baseMs;
  for (let i = 0; i < 3; i++) {
    const localInfo = getLocalPartsFromUtc(epoch, timeZone);
    if (!localInfo) {
      return baseMs - (fallbackOffsetSeconds || 0) * 1000;
    }
    const adjusted = baseMs - localInfo.offsetMs;
    if (Math.abs(adjusted - epoch) < 1) {
      epoch = adjusted;
      break;
    }
    epoch = adjusted;
  }
  return epoch;
}

function localDateTimeStringToUtcEpoch(isoString, timeZone = 'UTC', fallbackOffsetSeconds = 0) {
  if (!isoString) {
    return null;
  }
  if (EXPLICIT_TZ_REGEX.test(isoString)) {
    const parsed = Date.parse(isoString);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const parts = parseLocalIsoString(isoString);
  if (!parts) {
    const parsed = Date.parse(isoString);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return localDateTimeToUtcEpoch(parts, timeZone, fallbackOffsetSeconds);
}

function shiftLocalDate(parts, deltaDays) {
  if (!parts || !Number.isFinite(deltaDays)) {
    return null;
  }
  const { year, month, day } = parts;
  if ([year, month, day].some((value) => value == null || Number.isNaN(value))) {
    return null;
  }
  const base = Date.UTC(year, (month || 1) - 1, day || 1);
  if (!Number.isFinite(base)) {
    return null;
  }
  const shifted = new Date(base);
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

module.exports = {
  getLocalPartsFromUtc,
  localDateTimeToUtcEpoch,
  localDateTimeStringToUtcEpoch,
  shiftLocalDate,
};
