// A journey diary for one animal, computed at build time from its track:
// dated entries the site turns into sentences in any language.
//
//   ['start', t, place]                first recorded
//   ['stay', t, days, place]           stayed put (a stopover)
//   ['cross', t, nameIdx, hours, km]   crossed a barrier (sea, desert, mountains)
//   ['fast', t, kmPerDay]              its fastest day
//   ['north' | 'south', t, lat, place] farthest north / south (if it ranged widely)
//   ['km', t, km]                      passed a distance milestone
//   ['end', t, place]                  last recorded
//
// Places are label tuples from places.mjs (indexes into the species' names table).

import { cumulativeKm, haversineKm } from '../site/js/tracks.js';

const MAX_STAYS = 24;

// The fastest stretch of about a day: km covered between fixes 20–48 h apart, per day.
export function fastestDay(pts, cum = cumulativeKm(pts)) {
  let best = null;
  let j = 0;
  for (let i = 0; i < pts.length; i++) {
    if (j < i) j = i;
    while (j < pts.length - 1 && pts[j][2] - pts[i][2] < 20) j++;
    const dt = pts[j][2] - pts[i][2];
    if (dt < 20 || dt > 48) continue;
    const kmDay = ((cum[j] - cum[i]) / dt) * 24;
    if (!best || kmDay > best.kmDay) best = { t: pts[i][2], kmDay };
  }
  return best;
}

// A round milestone step giving a handful of entries: 1,000 / 5,000 / 10,000 km…
export function milestoneStep(totalKm) {
  for (const step of [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000]) if (totalKm / step <= 6) return step;
  return 100000;
}

export function buildDiary(animal, { stops = [], crossings = [], label, nameIdx }) {
  const pts = animal.pts;
  if (pts.length < 2) return [];
  const cum = cumulativeKm(pts);
  const out = [];
  const at = (p) => label(p[0], p[1]);
  out.push(['start', pts[0][2], at(pts[0])]);
  // Stays in time order; back-to-back stays at the same spot (same place name, within
  // 50 km and a month of each other) become one.
  const merged = [];
  for (const [lon, lat, a, b] of [...stops].sort((x, y) => x[2] - y[2])) {
    const place = label(lon, lat);
    const last = merged.at(-1);
    if (last && JSON.stringify(last.place) === JSON.stringify(place) && a - last.end < 24 * 30 && haversineKm(last.at, [lon, lat]) < 50) {
      last.end = b;
      last.days += (b - a) / 24;
      continue;
    }
    merged.push({ start: a, end: b, days: (b - a) / 24, place, at: [lon, lat] });
  }
  const stays = merged.sort((x, y) => y.days - x.days).slice(0, MAX_STAYS);
  for (const st of stays) out.push(['stay', st.start, Math.max(1, Math.round(st.days)), st.place]);
  for (const c of crossings) out.push(['cross', c.t0, nameIdx(c.name), Math.round(c.t1 - c.t0), Math.round(c.km)]);
  const fast = fastestDay(pts, cum);
  if (fast && fast.kmDay >= 50) out.push(['fast', fast.t, Math.round(fast.kmDay)]);
  const lats = pts.map((p) => p[1]);
  const max = Math.max(...lats);
  const min = Math.min(...lats);
  if (max - min >= 5) {
    const n = pts[lats.indexOf(max)];
    const s = pts[lats.indexOf(min)];
    out.push(['north', n[2], Math.round(max * 10) / 10, at(n)]);
    out.push(['south', s[2], Math.round(min * 10) / 10, at(s)]);
  }
  const step = milestoneStep(cum.at(-1));
  for (let m = step, i = 0; m < cum.at(-1); m += step) {
    while (cum[i + 1] < m) i++;
    const u = (m - cum[i]) / (cum[i + 1] - cum[i] || 1);
    out.push(['km', pts[i][2] + u * (pts[i + 1][2] - pts[i][2]), m]);
  }
  out.push(['end', pts.at(-1)[2], at(pts.at(-1))]);
  return out
    .map((e) => [e[0], Math.round(e[1] * 10) / 10, ...e.slice(2)])
    .sort((a, b) => a[1] - b[1]);
}
