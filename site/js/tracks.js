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

// The fixes taken in flight: both ends of every step no more than
// `maxGapHours` apart and faster than `minKmh`. Over `max`, every k-th
// flight is kept whole rather than thinning all of them.
export function flightFixes(pts, { maxGapHours = 2, minKmh = 15, max = 2500 } = {}) {
  const runs = [];
  let last = -1; // index of the last fix added to the current run
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i][2] - pts[i - 1][2];
    if (dt <= 0 || dt > maxGapHours || haversineKm(pts[i - 1], pts[i]) / dt <= minKmh) continue;
    if (last !== i - 1) runs.push([pts[i - 1]]);
    runs[runs.length - 1].push(pts[i]);
    last = i;
  }
  const total = runs.reduce((n, r) => n + r.length, 0);
  const k = Math.max(1, Math.ceil(total / max));
  return runs.filter((_, r) => r % k === 0).flat();
}

// Every time a track came within `radiusKm` of a place: the closest approach
// along each straight line between fixes (skipping tracking gaps), merged
// into visits; a new visit starts after `revisitDays` out of range.
// Returns [{ t, km, lon, lat }] in time order, one per visit, at its closest.
export function passesNear(pts, [lon0, lat0], radiusKm, { maxGapHours = Infinity, revisitDays = 14 } = {}) {
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.57;
  const local = (p) => {
    let dLon = (p[0] - lon0) % 360;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    return [dLon * kx, (p[1] - lat0) * ky];
  };
  const visits = [];
  let lastIn = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const [ax, ay] = local(a);
    let [x, y, t] = [ax, ay, a[2]];
    if (b && b[2] - a[2] <= maxGapHours) { // closest point on the line to the next fix
      const [bx, by] = local(b);
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const u = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      [x, y, t] = [ax + u * dx, ay + u * dy, a[2] + u * (b[2] - a[2])];
    }
    const km = Math.hypot(x, y);
    if (km > radiusKm) continue;
    const here = { t, km, lon: lon0 + x / kx, lat: lat0 + y / ky };
    const v = visits[visits.length - 1];
    if (v && t - lastIn <= revisitDays * 24) { if (km < v.km) visits[visits.length - 1] = here; } else visits.push(here);
    lastIn = t;
  }
  return visits;
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

// --- Timing across years ---

// When an animal crosses the halfway line between the two ends of its range
// (10th and 90th percentile along `axis`), and stays across it for at least
// `minStayDays`. A robust "mid-migration date" that works for any species.
// Needs a range of at least `minSpan` degrees. Returns [{ t, dir: +1 | -1 }].
export function halfwayCrossings(pts, axis = 'lat', { minStayDays = 10, minSpan = 4, maxGapHours = Infinity } = {}) {
  const k = axis === 'lat' ? 1 : 0;
  const v = pts.map((p) => p[k]).sort((a, b) => a - b);
  if (v.length < 10) return [];
  const lo = v[Math.floor(v.length * 0.1)];
  const hi = v[Math.floor(v.length * 0.9)];
  if (hi - lo < minSpan) return [];
  const mid = (lo + hi) / 2;
  const out = [];
  let side = Math.sign(pts[0][k] - mid) || -1;
  for (let i = 1; i < pts.length; i++) {
    const s = Math.sign(pts[i][k] - mid) || side;
    if (s === side) continue;
    if (pts[i][2] - pts[i - 1][2] > maxGapHours) { side = s; continue; } // crossed during a gap: date unknown
    // Must stay on the new side for a while, or it's just wandering near the line.
    let j = i;
    while (j + 1 < pts.length && (Math.sign(pts[j + 1][k] - mid) || s) === s) j++;
    if (pts[j][2] - pts[i][2] >= minStayDays * 24 || j === pts.length - 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const u = (mid - a[k]) / (b[k] - a[k] || 1);
      out.push({ t: a[2] + u * (b[2] - a[2]), dir: s });
      side = s;
    }
  }
  return out;
}

// Least-squares slope of y on x, or null with fewer than `minPoints`.
export function slope(xs, ys, minPoints = 6) {
  if (xs.length < minPoints) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}

// --- Stopovers: places an animal stayed for a while ---

// Runs of consecutive fixes that stay within `radiusKm` of their running
// centroid for at least `minHours`, without a tracking gap longer than
// `maxGapHours`. Points should be unwrapped (see unwrapLongitudes).
// Returns [{ lon, lat, start, end }] in time order.
export function findStops(pts, radiusKm, minHours, maxGapHours = Infinity) {
  const stops = [];
  const n = pts.length;
  let i = 0;
  while (i < n) {
    let sumLon = pts[i][0];
    let sumLat = pts[i][1];
    let k = 1;
    let j = i;
    while (j + 1 < n) {
      if (pts[j + 1][2] - pts[j][2] > maxGapHours) break;
      if (haversineKm([sumLon / k, sumLat / k], pts[j + 1]) > radiusKm) break;
      j++;
      sumLon += pts[j][0];
      sumLat += pts[j][1];
      k++;
    }
    if (j > i && pts[j][2] - pts[i][2] >= minHours) {
      stops.push({ lon: sumLon / k, lat: sumLat / k, start: pts[i][2], end: pts[j][2] });
      i = j + 1;
    } else i++;
  }
  return stops;
}

const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

// Group stops from many animals into shared sites: each stop joins the
// nearest site within `mergeKm`, longest stops first. Sites carry total
// days, visits, the animals that used them and days per calendar month.
export function clusterStops(stops, mergeKm) {
  const sorted = [...stops].sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const sites = [];
  for (const s of sorted) {
    const p = [wrapLon(s.lon), s.lat];
    let best = null;
    let bestD = Infinity;
    for (const site of sites) {
      const d = haversineKm([site.lon, site.lat], p);
      if (d <= mergeKm && d < bestD) { best = site; bestD = d; }
    }
    const days = (s.end - s.start) / 24;
    if (!best) {
      best = { lon: p[0], lat: p[1], days: 0, visits: 0, animals: new Set(), months: new Array(12).fill(0), _w: 0 };
      sites.push(best);
    } else {
      // Weighted centre (shift longitude next to the site first).
      let lon = p[0];
      if (lon - best.lon > 180) lon -= 360;
      if (lon - best.lon < -180) lon += 360;
      const w = best._w + days;
      best.lon = wrapLon((best.lon * best._w + lon * days) / w);
      best.lat = (best.lat * best._w + p[1] * days) / w;
    }
    best._w += days;
    best.days += days;
    best.visits += 1;
    if (s.animal != null) best.animals.add(s.animal);
    for (let h = s.start; h < s.end; h += 24) {
      best.months[new Date(h * 3.6e6).getUTCMonth()] += Math.min(1, (s.end - h) / 24);
    }
  }
  return sites
    .map(({ _w, animals, ...site }) => ({ ...site, animals: [...animals] }))
    .sort((a, b) => b.days - a.days);
}

// --- Describing movement in words (screen readers) ---

// Initial bearing from a to b, degrees clockwise from north.
export function bearing([lon1, lat1], [lon2, lat2]) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compassWord = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// Where an animal has been heading over the last `hours` before t:
// { km, bearing } of the straight line from then to now, or null.
export function recentHeading(pts, t, hours = 168, maxGapHours = Infinity) {
  const now = positionAt(pts, t, maxGapHours);
  const then = positionAt(pts, t - hours, maxGapHours);
  if (!now || !then) return null;
  return { km: haversineKm(then, now), bearing: bearing(then, now) };
}
