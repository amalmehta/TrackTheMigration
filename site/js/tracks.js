// Track maths shared by the browser app and the Node data pipeline.
// A point is [lon, lat, t] where t is hours since the Unix epoch.

const EARTH_RADIUS_KM = 6371.0088;
const HOURS_PER_YEAR = 365.2425 * 24;
const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function trackLengthKm(pts) {
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
  return km;
}

// Shift longitudes by ±360 so consecutive points never jump across the
// antimeridian; lines then draw the short way round.
export function unwrapLongitudes(pts) {
  const out = [];
  let offset = 0;
  for (let i = 0; i < pts.length; i++) {
    const [lon, lat, t] = pts[i];
    if (i > 0) {
      const prev = pts[i - 1][0];
      const d = lon - prev;
      if (d > 180) offset -= 360;
      else if (d < -180) offset += 360;
    }
    out.push([lon + offset, lat, t]);
  }
  return out;
}

// Drop fixes that imply an impossible speed from the last kept fix
// (Argos locations in particular carry occasional wild outliers).
export function speedFilter(pts, maxKmh) {
  if (pts.length === 0) return [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = out[out.length - 1];
    const hours = pts[i][2] - last[2];
    if (hours <= 0) continue;
    if (haversineKm(last, pts[i]) / hours <= maxKmh) out.push(pts[i]);
  }
  return out;
}

// Keep at most one fix per `minGapHours`, always keeping the last fix.
export function thinByTime(pts, minGapHours) {
  if (pts.length <= 2) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i][2] - out[out.length - 1][2] >= minGapHours) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Evenly sample down to at most `max` points, keeping both ends.
export function capPoints(pts, max) {
  if (pts.length <= max) return pts.slice();
  const out = [];
  const step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

// Index of the last point with time <= t (binary search), or -1.
export function indexAtOrBefore(pts, t) {
  let lo = 0;
  let hi = pts.length - 1;
  if (hi < 0 || t < pts[0][2]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid][2] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Linearly interpolated [lon, lat] at time t, or null outside the track
// or inside a gap longer than `maxGapHours` (the animal wasn't being tracked).
export function positionAt(pts, t, maxGapHours = Infinity) {
  const i = indexAtOrBefore(pts, t);
  if (i < 0 || t > pts[pts.length - 1][2]) return null;
  if (i === pts.length - 1) return [pts[i][0], pts[i][1]];
  const a = pts[i];
  const b = pts[i + 1];
  if (b[2] - a[2] > maxGapHours) return null;
  const f = (t - a[2]) / (b[2] - a[2] || 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// Points between t - trailHours and t, ending at the interpolated position.
export function trailAt(pts, t, trailHours, maxGapHours = Infinity) {
  const head = positionAt(pts, t, maxGapHours);
  if (!head) return null;
  const from = t - trailHours;
  const out = [];
  for (let i = indexAtOrBefore(pts, t); i >= 0 && pts[i][2] >= from; i--) {
    out.push([pts[i][0], pts[i][1]]);
    if (i > 0 && pts[i][2] - pts[i - 1][2] > maxGapHours) break;
  }
  out.reverse();
  out.push(head);
  return out;
}

// --- Season view: every tracked year of every animal laid over one year ---

export function yearStartHours(year) {
  return Date.UTC(year, 0, 1) / 3.6e6;
}

// Split a track into one segment per calendar year it touches. Each segment
// keeps a little of the neighbouring years so motion is continuous at New Year.
export function splitByYear(pts) {
  if (pts.length === 0) return [];
  const first = new Date(pts[0][2] * 3.6e6).getUTCFullYear();
  const last = new Date(pts[pts.length - 1][2] * 3.6e6).getUTCFullYear();
  const segs = [];
  for (let y = first; y <= last; y++) {
    const start = yearStartHours(y);
    const end = yearStartHours(y + 1);
    const lo = Math.max(0, indexAtOrBefore(pts, start));
    const hi = Math.min(pts.length - 1, indexAtOrBefore(pts, end) + 1);
    if (hi > lo) segs.push({ year: y, start, pts: pts.slice(lo, hi + 1) });
  }
  return segs;
}

// Fraction of the way through the year (0..1) → hours within a given year.
export function seasonToHours(year, fraction) {
  return yearStartHours(year) + fraction * (yearStartHours(year + 1) - yearStartHours(year));
}

export const HOURS = { year: HOURS_PER_YEAR, day: 24 };

// --- Analysis helpers (follow mode and charts) ---

// Running distance in km at each point.
export function cumulativeKm(pts) {
  const out = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) out[i] = out[i - 1] + haversineKm(pts[i - 1], pts[i]);
  return out;
}

// Distance travelled by time t, interpolating inside the current leg.
export function distanceAt(pts, cum, t) {
  const i = indexAtOrBefore(pts, t);
  if (i < 0) return 0;
  if (i >= pts.length - 1) return cum[pts.length - 1];
  const f = (t - pts[i][2]) / (pts[i + 1][2] - pts[i][2] || 1);
  return cum[i] + (cum[i + 1] - cum[i]) * f;
}

// Average speed (km/day) over the window [t - windowHours, t], or null
// when the window falls outside the track or across a tracking gap.
export function speedAt(pts, cum, t, windowHours = 24, maxGapHours = Infinity) {
  if (!positionAt(pts, t, maxGapHours)) return null;
  const t0 = Math.max(pts[0][2], t - windowHours);
  if (t - t0 <= 0) return null;
  if (!positionAt(pts, t0, maxGapHours)) return null;
  return ((distanceAt(pts, cum, t) - distanceAt(pts, cum, t0)) / (t - t0)) * 24;
}

// Day of year as a fraction 0..1 for a time in hours.
export function yearFraction(h) {
  const y = new Date(h * 3.6e6).getUTCFullYear();
  return (h - yearStartHours(y)) / (yearStartHours(y + 1) - yearStartHours(y));
}

// Mean km/day in each of `bins` equal slices of the year, pooled over all
// animals. Legs longer than maxGapHours are skipped (not tracked then).
// Returns { kmPerDay: number[]|null[], days: number[] } — days of tracking per bin.
export function seasonalMovement(tracks, bins = 12, maxGapHours = Infinity) {
  const km = new Float64Array(bins);
  const hours = new Float64Array(bins);
  for (const pts of tracks) {
    for (let i = 1; i < pts.length; i++) {
      const dt = pts[i][2] - pts[i - 1][2];
      if (dt <= 0 || dt > maxGapHours) continue;
      const mid = (pts[i][2] + pts[i - 1][2]) / 2;
      const b = Math.min(bins - 1, Math.floor(yearFraction(mid) * bins));
      km[b] += haversineKm(pts[i - 1], pts[i]);
      hours[b] += dt;
    }
  }
  return {
    kmPerDay: Array.from(km, (k, b) => (hours[b] > 0 ? (k / hours[b]) * 24 : null)),
    days: Array.from(hours, (h) => h / 24),
  };
}

// Is the movement mostly north–south or east–west? Sums each animal's own
// spans in degrees of arc, so a herd spread out sideways doesn't count.
export function mainAxis(tracks) {
  let lat = 0;
  let lon = 0;
  for (const pts of tracks) {
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const [x, y] of pts) {
      if (y < minLat) minLat = y; if (y > maxLat) maxLat = y;
      if (x < minLon) minLon = x; if (x > maxLon) maxLon = x;
    }
    lat += maxLat - minLat;
    lon += (maxLon - minLon) * Math.cos(toRad((minLat + maxLat) / 2));
  }
  return lon > lat ? 'lon' : 'lat';
}
