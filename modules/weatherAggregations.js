'use strict';

const dateTimeFormatterCache = new Map();
const weekdayFormatterCache = new Map();

// clampDays confines user-provided day counts to a safe positive range.
function clampDays(value, fallback, max) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const numeric = parseInt(value, 10);
  if (Number.isNaN(numeric) || numeric < 0) {
    return fallback;
  }
  return Math.min(numeric, max);
}

// pad2 ensures numbers render as two-digit strings (e.g., months/days).
function pad2(value) {
  return String(value).padStart(2, '0');
}

// getDateTimeFormatter reuses Intl formatters per timezone for date parts.
function getDateTimeFormatter(timeZone) {
  if (!dateTimeFormatterCache.has(timeZone)) {
    dateTimeFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    );
  }
  return dateTimeFormatterCache.get(timeZone);
}

// getWeekdayFormatter caches Intl weekday formatters per timezone.
function getWeekdayFormatter(timeZone) {
  if (!weekdayFormatterCache.has(timeZone)) {
    weekdayFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' })
    );
  }
  return weekdayFormatterCache.get(timeZone);
}

// getLocalDayInfo derives local day metadata (date key, weekday, hour).
function getLocalDayInfo(epoch, timeZone) {
  const tz = timeZone || 'UTC';
  const date = new Date(epoch);
  const formatter = getDateTimeFormatter(tz);
  const parts = formatter.formatToParts(date);
  const partValue = (type) => parts.find((p) => p.type === type)?.value;
  const year = Number(partValue('year'));
  const month = Number(partValue('month'));
  const day = Number(partValue('day'));
  const hour = Number(partValue('hour'));
  const minute = Number(partValue('minute')) || 0;
  const second = Number(partValue('second')) || 0;

  if ([year, month, day].some((v) => Number.isNaN(v))) {
    return null;
  }

  const localMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = localMs - epoch;
  const startOfDayEpoch = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs;
  const weekday = getWeekdayFormatter(tz).format(date);

  return {
    dateKey: `${year}-${pad2(month)}-${pad2(day)}`,
    startOfDayEpoch,
    weekday,
    localHour: Number.isNaN(hour) ? null : hour,
  };
}

// aggregateDailyOverview condenses hourly docs into per-day stats.
function aggregateDailyOverview(hours, timeZone) {
  const tz = timeZone || 'UTC';
  const buckets = new Map();

  for (const hour of hours) {
    if (hour.dateTimeEpoch == null) {
      continue;
    }
    const info = getLocalDayInfo(hour.dateTimeEpoch, tz);
    if (!info) continue;
    let bucket = buckets.get(info.dateKey);
    if (!bucket) {
      bucket = {
        date: info.dateKey,
        weekday: info.weekday,
        dayStartEpoch: info.startOfDayEpoch,
        minTemp: null,
        maxTemp: null,
        count: 0,
        precipTotal: 0,
        precipCount: 0,
        snowTotal: 0,
        snowCount: 0,
        windSpeedSum: 0,
        windCount: 0,
        precipProbSum: 0,
        precipProbCount: 0,
        cloudCoverSum: 0,
        cloudCoverCount: 0,
        visibilitySum: 0,
        visibilityCount: 0,
        representative: null,
      };
      buckets.set(info.dateKey, bucket);
    }

    bucket.count += 1;

    if (hour.temp != null) {
      bucket.minTemp = bucket.minTemp == null ? hour.temp : Math.min(bucket.minTemp, hour.temp);
      bucket.maxTemp = bucket.maxTemp == null ? hour.temp : Math.max(bucket.maxTemp, hour.temp);
    }

    if (hour.precip != null) {
      bucket.precipTotal += hour.precip;
      bucket.precipCount += 1;
    }

    if (hour.snow != null) {
      bucket.snowTotal += hour.snow;
      bucket.snowCount += 1;
    }

    if (hour.windspeed != null) {
      bucket.windSpeedSum += hour.windspeed;
      bucket.windCount += 1;
    }

    if (hour.precipProb != null) {
      bucket.precipProbSum += hour.precipProb;
      bucket.precipProbCount += 1;
    }

    if (hour.cloudCover != null) {
      bucket.cloudCoverSum += hour.cloudCover;
      bucket.cloudCoverCount += 1;
    }

    if (hour.visibility != null) {
      bucket.visibilitySum += hour.visibility;
      bucket.visibilityCount += 1;
    }

    if (info.localHour != null) {
      const score = Math.abs(info.localHour - 12);
      if (!bucket.representative || score < bucket.representative.score) {
        bucket.representative = {
          score,
          data: {
            dateTimeEpoch: hour.dateTimeEpoch,
            conditions: hour.conditions || null,
            icon: hour.icon || null,
            temp: hour.temp ?? null,
            feelsLike: hour.feelsLike ?? null,
            localHour: info.localHour,
          },
        };
      }
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.dayStartEpoch - b.dayStartEpoch)
    .map((bucket) => ({
      date: bucket.date,
      weekday: bucket.weekday,
      dayStartEpoch: bucket.dayStartEpoch,
      hours: bucket.count,
      minTemp: bucket.minTemp,
      maxTemp: bucket.maxTemp,
      precipTotal: bucket.precipCount ? bucket.precipTotal : null,
      snowTotal: bucket.snowCount ? bucket.snowTotal : null,
      avgWindspeed: bucket.windCount ? bucket.windSpeedSum / bucket.windCount : null,
      avgPrecipProb: bucket.precipProbCount ? bucket.precipProbSum / bucket.precipProbCount : null,
      avgCloudCover: bucket.cloudCoverCount ? bucket.cloudCoverSum / bucket.cloudCoverCount : null,
      avgVisibility: bucket.visibilityCount ? bucket.visibilitySum / bucket.visibilityCount : null,
      representativeHour: bucket.representative ? bucket.representative.data : null,
    }));
}

const SEGMENTS = [
  { id: 'overnight', label: 'Overnight', startHour: 0, endHour: 6 },
  { id: 'morning', label: 'Morning', startHour: 6, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 18 },
  { id: 'evening', label: 'Evening', startHour: 18, endHour: 24 },
];

// createSegmentBuckets initializes empty aggregation buckets per segment.
function createSegmentBuckets() {
  const segments = {};
  for (const segment of SEGMENTS) {
    segments[segment.id] = {
      id: segment.id,
      label: segment.label,
      startHour: segment.startHour,
      endHour: segment.endHour,
      hours: 0,
      minTemp: null,
      maxTemp: null,
      precipTotal: 0,
      precipCount: 0,
      snowTotal: 0,
      snowCount: 0,
      windSpeedSum: 0,
      windCount: 0,
      precipProbSum: 0,
      precipProbCount: 0,
      cloudCoverSum: 0,
      cloudCoverCount: 0,
      visibilitySum: 0,
      visibilityCount: 0,
      representative: null,
    };
  }
  return segments;
}

// aggregateDailySegments produces day-part summaries using SEGMENTS.
function aggregateDailySegments(hours, timeZone) {
  const tz = timeZone || 'UTC';
  const buckets = new Map();

  for (const hour of hours) {
    if (hour.dateTimeEpoch == null) continue;
    const info = getLocalDayInfo(hour.dateTimeEpoch, tz);
    if (!info || info.localHour == null) continue;

    let dayBucket = buckets.get(info.dateKey);
    if (!dayBucket) {
      dayBucket = {
        date: info.dateKey,
        weekday: info.weekday,
        dayStartEpoch: info.startOfDayEpoch,
        segments: createSegmentBuckets(),
      };
      buckets.set(info.dateKey, dayBucket);
    }

    const segment = SEGMENTS.find(
      (segmentDef) =>
        info.localHour >= segmentDef.startHour && info.localHour < segmentDef.endHour
    );
    if (!segment) {
      continue;
    }

    const segBucket = dayBucket.segments[segment.id];
    segBucket.hours += 1;

    if (hour.temp != null) {
      segBucket.minTemp = segBucket.minTemp == null ? hour.temp : Math.min(segBucket.minTemp, hour.temp);
      segBucket.maxTemp = segBucket.maxTemp == null ? hour.temp : Math.max(segBucket.maxTemp, hour.temp);
    }
    if (hour.precip != null) {
      segBucket.precipTotal += hour.precip;
      segBucket.precipCount += 1;
    }
    if (hour.snow != null) {
      segBucket.snowTotal += hour.snow;
      segBucket.snowCount += 1;
    }
    if (hour.windspeed != null) {
      segBucket.windSpeedSum += hour.windspeed;
      segBucket.windCount += 1;
    }
    if (hour.precipProb != null) {
      segBucket.precipProbSum += hour.precipProb;
      segBucket.precipProbCount += 1;
    }
    if (hour.cloudCover != null) {
      segBucket.cloudCoverSum += hour.cloudCover;
      segBucket.cloudCoverCount += 1;
    }
    if (hour.visibility != null) {
      segBucket.visibilitySum += hour.visibility;
      segBucket.visibilityCount += 1;
    }

    const targetHour = (segment.startHour + segment.endHour) / 2;
    const score = Math.abs(info.localHour - targetHour);
    if (!segBucket.representative || score < segBucket.representative.score) {
      segBucket.representative = {
        score,
        data: {
          dateTimeEpoch: hour.dateTimeEpoch,
          conditions: hour.conditions || null,
          icon: hour.icon || null,
          temp: hour.temp ?? null,
          feelsLike: hour.feelsLike ?? null,
          localHour: info.localHour,
        },
      };
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.dayStartEpoch - b.dayStartEpoch)
    .map((day) => ({
      date: day.date,
      weekday: day.weekday,
      dayStartEpoch: day.dayStartEpoch,
      segments: SEGMENTS.map((segmentDef) => {
        const segBucket = day.segments[segmentDef.id];
        return {
          id: segmentDef.id,
          label: segmentDef.label,
          startHour: segmentDef.startHour,
          endHour: segmentDef.endHour,
          hours: segBucket.hours,
          minTemp: segBucket.minTemp,
          maxTemp: segBucket.maxTemp,
          precipTotal: segBucket.precipCount ? segBucket.precipTotal : null,
          snowTotal: segBucket.snowCount ? segBucket.snowTotal : null,
          avgWindspeed: segBucket.windCount ? segBucket.windSpeedSum / segBucket.windCount : null,
          avgPrecipProb: segBucket.precipProbCount ? segBucket.precipProbSum / segBucket.precipProbCount : null,
          avgCloudCover: segBucket.cloudCoverCount ? segBucket.cloudCoverSum / segBucket.cloudCoverCount : null,
          avgVisibility: segBucket.visibilityCount ? segBucket.visibilitySum / segBucket.visibilityCount : null,
          representativeHour: segBucket.representative ? segBucket.representative.data : null,
        };
      }),
    }));
}

module.exports = {
  clampDays,
  getLocalDayInfo,
  aggregateDailyOverview,
  aggregateDailySegments,
  SEGMENTS,
};
