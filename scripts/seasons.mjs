// "This week in migration" at build time: for each half-month of the year,
// where a species' animals are, how many are tracked, how fast they move and
// which way most are heading, with a place name for the travellers' middle.
// Every year an animal was tracked counts once (as in Season view).

import { positionAt, recentHeading, seasonalMovement, seasonToHours, haversineKm } from '../site/js/tracks.js';

export const BINS = 24;
const COHERENT = 0.45; // share of movement in one direction to call it a heading
const MIN_KM_DAY = 15;  // slower than this, a heading means little

export function seasonSummary(animals, maxGapHours, label) {
  const mv = seasonalMovement(animals.map((a) => a.pts), BINS, maxGapHours);
  const out = [];
  for (let b = 0; b < BINS; b++) {
    const mid = (b + 0.5) / BINS;
    const here = [];
    for (const a of animals) {
      const y0 = new Date(a.pts[0][2] * 3.6e6).getUTCFullYear();
      const y1 = new Date(a.pts.at(-1)[2] * 3.6e6).getUTCFullYear();
      for (let y = y0; y <= y1; y++) {
        const t = seasonToHours(y, mid);
        const p = positionAt(a.pts, t, maxGapHours);
        if (!p) continue;
        const h = recentHeading(a.pts, t, 168, maxGapHours);
        here.push({ p, h: h && h.km > 1 ? h : null });
      }
    }
    if (!here.length) { out.push(null); continue; }
    let x = 0, y = 0, km = 0;
    for (const { h } of here) {
      if (!h) continue;
      x += Math.sin((h.bearing * Math.PI) / 180) * h.km;
      y += Math.cos((h.bearing * Math.PI) / 180) * h.km;
      km += h.km;
    }
    const moving = km / here.length / 7;
    const heading = km && moving >= MIN_KM_DAY && Math.hypot(x, y) / km > COHERENT ? Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360) : null;
    // Where the travellers are (else everyone): the medoid, a real animal's
    // position nearest the rest, so a species in two places isn't put between them.
    const travellers = here.filter((e) => e.h && e.h.km / 7 > 20);
    const group = (travellers.length >= 2 ? travellers : here).slice(0, 150);
    let best = null;
    for (const a of group) {
      let sum = 0;
      for (const o of group) sum += haversineKm(a.p, o.p);
      if (!best || sum < best.sum) best = { sum, p: a.p };
    }
    const [lon, lat] = best.p;
    out.push({
      n: here.length,
      kmDay: mv.kmPerDay[b] == null ? null : Math.round(mv.kmPerDay[b]),
      heading,
      at: [Math.round(lon * 10) / 10, Math.round(lat * 10) / 10],
      place: label(lon, lat),
    });
  }
  return out;
}
