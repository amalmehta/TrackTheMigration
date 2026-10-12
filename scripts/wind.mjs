// Wind along bird routes, at build time: for every step a bird was on the
// move, the hourly wind 100 m above the ground (ERA5 reanalysis, via the
// key-free Open-Meteo archive) at the step's midpoint and time, split into
// tailwind and crosswind relative to the bird's heading.
//
// Requests are grouped by date (many places per call), cached in
// data/raw/wind/, and stop politely if the daily allowance runs out, so a
// later run picks up where this one left off.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineKm, bearing } from '../site/js/tracks.js';

const API = 'https://archive-api.open-meteo.com/v1/archive';
const GRID = 0.25;           // ERA5's grid: nearby places share a cell
const PER_CALL = 40;         // places per request
const MOVING_KMH = 4;        // slower than this over a step: resting, not travelling
const MAX_STEP_HOURS = 24 * 14;

const cell = (v) => Math.round(v / GRID) * GRID;
const day = (h) => new Date(h * 3.6e6).toISOString().slice(0, 10);
const keyOf = (lat, lon, d) => `${cell(lat).toFixed(2)},${cell(((lon + 540) % 360) - 180).toFixed(2)},${d}`;

// Tail and cross components (km/h) of a wind blowing FROM `windFrom`° for a
// bird heading `heading`°: positive tail = helping, positive cross = from the left.
export function windComponents(speed, windFrom, heading) {
  const to = ((windFrom + 180) * Math.PI) / 180;
  const h = (heading * Math.PI) / 180;
  return { tail: speed * Math.cos(to - h), cross: speed * Math.sin(to - h) };
}

// The steps worth a wind sample: moving faster than MOVING_KMH, no longer than
// two weeks. Long steps (geolocator flights) get one sample a day along the line.
export function travelSteps(pts) {
  const steps = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dt = b[2] - a[2];
    if (dt <= 0 || dt > MAX_STEP_HOURS) continue;
    const km = haversineKm(a, b);
    if (km / dt < MOVING_KMH) continue;
    const n = Math.max(1, Math.round(dt / 24));
    const samples = [];
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n;
      samples.push({ lon: a[0] + (b[0] - a[0]) * u, lat: a[1] + (b[1] - a[1]) * u, t: a[2] + dt * u });
    }
    steps.push({ i, t0: a[2], t1: b[2], kmh: km / dt, heading: bearing(a, b), samples });
  }
  return steps;
}

export function windSampler(rawDir) {
  const dir = join(rawDir, 'wind');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'cache.json');
  const cache = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  let exhausted = false;
  const save = () => writeFileSync(file, JSON.stringify(cache));

  async function fetchDay(d, places) {
    const url = `${API}?latitude=${places.map((p) => cell(p.lat).toFixed(2)).join(',')}`
      + `&longitude=${places.map((p) => cell(((p.lon + 540) % 360) - 180).toFixed(2)).join(',')}`
      + `&start_date=${d}&end_date=${d}&hourly=wind_speed_100m,wind_direction_100m&wind_speed_unit=kmh&timezone=GMT`;
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await fetch(url).catch(() => null);
      if (res?.ok) {
        const json = await res.json();
        (Array.isArray(json) ? json : [json]).forEach((r, k) => {
          const p = places[k];
          cache[keyOf(p.lat, p.lon, d)] = [r.hourly.wind_speed_100m.map((v) => (v == null ? null : Math.round(v))), r.hourly.wind_direction_100m];
        });
        return;
      }
      if (res?.status === 429) {
        // Over a limit: stop for the day, or wait out the hourly or per-minute one.
        const text = await res.text();
        if (/daily/i.test(text)) { exhausted = true; return; }
        const wait = /hour/i.test(text) ? 10 * 60000 : 65000;
        console.log(`  wind: rate-limited, waiting ${Math.round(wait / 60000)} min…`);
        await new Promise((r) => setTimeout(r, wait));
      } else if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      else return;
    }
  }

  // points: [{ lon, lat, t }] → [{ speed, from } | null]
  return async function sample(points) {
    const byDay = new Map();
    for (const p of points) {
      const d = day(p.t);
      if (cache[keyOf(p.lat, p.lon, d)]) continue;
      if (!byDay.has(d)) byDay.set(d, new Map());
      byDay.get(d).set(keyOf(p.lat, p.lon, d), p);
    }
    let calls = 0;
    for (const [d, m] of byDay) {
      const places = [...m.values()];
      for (let i = 0; i < places.length && !exhausted; i += PER_CALL) {
        await fetchDay(d, places.slice(i, i + PER_CALL));
        if (++calls % 25 === 0) save();
        await new Promise((r) => setTimeout(r, 120));
      }
      if (exhausted) break;
    }
    save();
    if (exhausted) console.warn('  wind: daily request allowance used up; run again tomorrow to fill the gaps');
    return points.map((p) => {
      const c = cache[keyOf(p.lat, p.lon, day(p.t))];
      if (!c) return null;
      const hour = Math.min(23, Math.floor((((p.t % 24) + 24) % 24)));
      const speed = c[0][hour];
      const from = c[1][hour];
      return speed == null || from == null ? null : { speed, from };
    });
  };
}

// For one animal's displayed track: [[t0, t1, tail, cross, groundKmh], …] per travel step.
export async function windAlong(pts, sample) {
  const steps = travelSteps(pts);
  const flat = steps.flatMap((s) => s.samples);
  const winds = await sample(flat);
  let k = 0;
  const out = [];
  for (const s of steps) {
    let tail = 0;
    let cross = 0;
    let n = 0;
    for (let j = 0; j < s.samples.length; j++, k++) {
      const w = winds[k];
      if (!w) continue;
      const c = windComponents(w.speed, w.from, s.heading);
      tail += c.tail;
      cross += c.cross;
      n++;
    }
    if (n) out.push([Math.round(s.t0 * 10) / 10, Math.round(s.t1 * 10) / 10, Math.round(tail / n), Math.round(cross / n), Math.round(s.kmh * 24)]);
  }
  return out;
}
