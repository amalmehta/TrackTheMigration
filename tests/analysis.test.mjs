import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cumulativeKm, distanceAt, speedAt, yearFraction, seasonalMovement, mainAxis, seasonToHours,
} from '../site/js/tracks.js';
import { subsolarPoint, sunAltitude, darkness } from '../site/js/solar.js';
import { overlayDate, tileUrl, ENV_LAYERS } from '../site/js/environment.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);
const H = (iso) => Date.parse(iso) / 3.6e6;

test('cumulative and interpolated distance', () => {
  const pts = [[0, 0, 0], [0, 1, 24], [0, 2, 48]];
  const cum = cumulativeKm(pts);
  near(cum[2], 222.4, 0.2);
  near(distanceAt(pts, cum, 12), 55.6, 0.1);
  near(distanceAt(pts, cum, 100), cum[2], 1e-9);
  assert.equal(distanceAt(pts, cum, -5), 0);
});

test('speed over the last day', () => {
  const pts = [[0, 0, 0], [0, 1, 24], [0, 2, 48]];
  const cum = cumulativeKm(pts);
  near(speedAt(pts, cum, 48), 111.2, 0.2);
  assert.equal(speedAt(pts, cum, 0), null);
  assert.equal(speedAt(pts, cum, 30, 24, 10), null); // inside a long gap
});

test('year fraction', () => {
  near(yearFraction(H('2021-01-01T00:00:00Z')), 0, 1e-9);
  near(yearFraction(H('2021-07-02T12:00:00Z')), 0.5, 0.002);
});

test('seasonal movement pools legs by time of year', () => {
  const jan = seasonToHours(2010, 0.02);
  const jul = seasonToHours(2010, 0.52);
  const tracks = [[[0, 0, jan], [0, 1, jan + 24], [0, 1, jul], [0, 1.5, jul + 24]]];
  const { kmPerDay, days } = seasonalMovement(tracks, 12, 48);
  near(kmPerDay[0], 111.2, 0.3);
  near(kmPerDay[6], 55.6, 0.3);
  assert.equal(kmPerDay[3], null); // the long Jan→Jul gap is not counted
  near(days[0], 1, 1e-9);
});

test('main axis of movement', () => {
  assert.equal(mainAxis([[[0, 0], [0, 20]]]), 'lat');
  assert.equal(mainAxis([[[0, 60], [30, 61]]]), 'lon');
});

test('subsolar point at a June solstice noon', () => {
  const s = subsolarPoint(new Date('2021-06-21T12:00:00Z'));
  near(s.lat, 23.44, 0.1);
  near(s.lon, 0, 1.5);
  const d = subsolarPoint(new Date('2021-12-21T12:00:00Z'));
  near(d.lat, -23.44, 0.1);
});

test('sun altitude and darkness', () => {
  const sun = { lat: 0, lon: 0 };
  near(sunAltitude(0, 0, sun), 90, 1e-6);
  near(sunAltitude(0, 180, sun), -90, 1e-6);
  near(sunAltitude(0, 90, sun), 0, 1e-6);
  assert.equal(darkness(30), 0);
  assert.equal(darkness(-20), 1);
  assert.ok(darkness(-5) > 0 && darkness(-5) < 1);
});

test('overlay dates snap to the layer period', () => {
  assert.deepEqual(overlayDate('vegetation', H('2010-03-17T00:00:00Z')), { date: '2010-03-01', shifted: false });
  assert.deepEqual(overlayDate('sst', H('1996-01-17T00:00:00Z')), { date: '1996-01-15', shifted: false });
  assert.deepEqual(overlayDate('sst', H('1996-01-03T00:00:00Z')), { date: '1996-01-01', shifted: false });
});

test('overlay dates outside the archive move to the nearest covered year', () => {
  assert.deepEqual(overlayDate('vegetation', H('1995-09-20T00:00:00Z')), { date: '2000-09-01', shifted: true });
  assert.deepEqual(overlayDate('sst', H('2021-01-10T00:00:00Z')), { date: '2020-01-08', shifted: true });
  assert.deepEqual(overlayDate('vegetation', H('1999-01-20T00:00:00Z')), { date: '2001-01-01', shifted: true });
});

test('tile URLs carry the layer, date and matrix set', () => {
  for (const key of Object.keys(ENV_LAYERS)) {
    const u = tileUrl(key, '2010-03-01');
    assert.match(u, /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\/.+\/default\/2010-03-01\/GoogleMapsCompatible_Level\d\/\{z\}\/\{y\}\/\{x\}\.png$/);
  }
});

test('night canvas: lit under the sun, dark opposite', async () => {
  const { paintNight } = await import('../site/js/solar.js');
  const w = 64, h = 64;
  let data = null;
  const ctx = {
    canvas: { width: w, height: h },
    createImageData: (W, H) => ({ data: new Uint8ClampedArray(W * H * 4) }),
    putImageData: (img) => { data = img.data; },
  };
  paintNight(ctx, { lat: 0, lon: 0 });
  const alphaAt = (x, y) => data[(y * w + x) * 4 + 3];
  assert.equal(alphaAt(32, 32), 0);           // under the sun
  assert.ok(alphaAt(1, 32) > 150);            // the antimeridian is in night
  assert.ok(alphaAt(15, 32) > 0 && alphaAt(15, 32) < alphaAt(1, 32)); // twilight just past −90°
});

test('findStops finds a long stay and ignores travel', async () => {
  const { findStops } = await import('../site/js/tracks.js');
  const pts = [];
  // travel east 1° per 12 h, then stay ~put for 5 days, then travel again
  for (let i = 0; i < 5; i++) pts.push([i, 0, i * 12]);
  for (let i = 0; i < 10; i++) pts.push([5 + (i % 2) * 0.01, 0.01 * (i % 3), 60 + i * 12]);
  for (let i = 1; i < 4; i++) pts.push([5 + i, 0, 168 + i * 12]);
  const stops = findStops(pts, 10, 72);
  assert.equal(stops.length, 1);
  near(stops[0].lon, 5.005, 0.01);
  assert.equal(stops[0].start, 60);
  assert.equal(stops[0].end, 168);
});

test('findStops does not bridge tracking gaps', async () => {
  const { findStops } = await import('../site/js/tracks.js');
  const pts = [[0, 0, 0], [0, 0, 24], [0, 0, 500], [0, 0, 524]];
  assert.equal(findStops(pts, 5, 30, 48).length, 0);
  assert.equal(findStops(pts, 5, 30).length, 1);
});

test('clusterStops merges nearby stops into sites with months', async () => {
  const { clusterStops } = await import('../site/js/tracks.js');
  const jan = Date.UTC(2010, 0, 10) / 3.6e6;
  const sites = clusterStops([
    { lon: 10, lat: 10, start: jan, end: jan + 24 * 4, animal: 'a' },
    { lon: 10.1, lat: 10, start: jan, end: jan + 24 * 2, animal: 'b' },
    { lon: 40, lat: 10, start: jan, end: jan + 24, animal: 'a' },
    { lon: 179.9, lat: 0, start: jan, end: jan + 48, animal: 'c' },
    { lon: 180.1, lat: 0, start: jan, end: jan + 24, animal: 'd' },
  ], 50);
  assert.equal(sites.length, 3);
  assert.equal(sites[0].days, 6);
  assert.deepEqual(sites[0].animals.sort(), ['a', 'b']);
  near(sites[0].months[0], 6, 1e-9);
  const dateline = sites.find((s) => Math.abs(Math.abs(s.lon) - 180) < 1);
  assert.equal(dateline.visits, 2);
});
