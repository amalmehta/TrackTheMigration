// Barrier crossings at build time: where a route crosses a sea, desert or
// mountain range, how long it took and how far it went. Each track is sampled
// every few kilometres along its straight lines between fixes (not across
// tracking gaps); a crossing is a run of samples inside one barrier that
// enters from outside, leaves again, covers at least `minKm` and takes no more
// than `maxDays` (longer, and the animal is living there, not crossing).
// Because lines between fixes are straight, a line can clip a sea the animal
// really flew around; so a crossing needs a real fix inside the barrier, or a
// leg of at least `trustKm` (a genuine non-stop flight over open water).

import { haversineKm } from '../site/js/tracks.js';

export function sampleTrack(pts, { stepKm = 15, maxGapHours = Infinity } = {}) {
  const out = [];
  let cum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    out.push({ lon: a[0], lat: a[1], t: a[2], km: cum, fix: true, gapBefore: i > 0 && a[2] - pts[i - 1][2] > maxGapHours });
    const b = pts[i + 1];
    if (!b || b[2] - a[2] > maxGapHours) continue;
    const d = haversineKm(a, b);
    const n = Math.floor(d / stepKm);
    for (let k = 1; k <= n; k++) {
      const u = k / (n + 1);
      out.push({ lon: a[0] + (b[0] - a[0]) * u, lat: a[1] + (b[1] - a[1]) * u, t: a[2] + (b[2] - a[2]) * u, km: cum + d * u, fix: false, gapBefore: false });
    }
    cum += d;
  }
  return out;
}

// barrierAt(lon, lat) → { en, es, fr, kind } | null
export function findCrossings(pts, barrierAt, { stepKm = 15, maxGapHours = Infinity, maxDays = 45, minKm = 150, trustKm = 600, kinds = null } = {}) {
  const s = sampleTrack(pts, { stepKm, maxGapHours });
  const at = s.map((p) => {
    const b = barrierAt(p.lon, p.lat);
    return b && (!kinds || kinds.includes(b.kind)) ? b : null;
  });
  const out = [];
  let i = 0;
  while (i < s.length) {
    const b = at[i];
    if (!b) { i++; continue; }
    let j = i;
    while (j + 1 < s.length && !s[j + 1].gapBefore && at[j + 1]?.en === b.en) j++;
    // Entered from outside, left to outside, no tracking gap at either end.
    const entered = i > 0 && !s[i].gapBefore && at[i - 1]?.en !== b.en;
    const left = j + 1 < s.length && !s[j + 1].gapBefore && at[j + 1]?.en !== b.en;
    const hours = s[j].t - s[i].t;
    const km = s[j].km - s[i].km;
    let fixInside = false;
    for (let k = i; k <= j && !fixInside; k++) fixInside = s[k].fix;
    if (entered && left && hours <= maxDays * 24 && km >= minKm && (fixInside || km >= trustKm)
      && haversineKm([s[i].lon, s[i].lat], [s[j].lon, s[j].lat]) >= minKm * 0.6) {
      out.push({ name: { en: b.en, es: b.es, fr: b.fr }, kind: b.kind, t0: s[i].t, t1: s[j].t, km, from: [s[i].lon, s[i].lat], to: [s[j].lon, s[j].lat] });
    }
    i = j + 1;
  }
  return out;
}
