import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineKm, trackLengthKm, unwrapLongitudes, speedFilter, thinByTime, capPoints,
  indexAtOrBefore, positionAt, trailAt, splitByYear, yearStartHours, seasonToHours,
} from '../site/js/tracks.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('haversine: one degree of latitude ≈ 111 km', () => {
  near(haversineKm([0, 0], [0, 1]), 111.2, 0.1);
  near(haversineKm([10, 10], [10, 10]), 0);
});

test('track length sums legs', () => {
  near(trackLengthKm([[0, 0, 0], [0, 1, 1], [0, 2, 2]]), 222.4, 0.2);
});

test('unwrap keeps lines short across the antimeridian', () => {
  const out = unwrapLongitudes([[179, 0, 0], [-179, 0, 1], [-178, 0, 2], [179, 0, 3]]);
  assert.deepEqual(out.map((p) => p[0]), [179, 181, 182, 179]);
});

test('speed filter drops impossible jumps', () => {
  const pts = [[0, 0, 0], [0, 0.1, 1], [50, 50, 2], [0, 0.2, 3]];
  assert.deepEqual(speedFilter(pts, 20).map((p) => p[2]), [0, 1, 3]);
});

test('speed filter drops duplicate timestamps', () => {
  assert.equal(speedFilter([[0, 0, 0], [0, 0, 0], [0, 0.01, 1]], 20).length, 2);
});

test('thin by time keeps ends and spacing', () => {
  const pts = Array.from({ length: 25 }, (_, i) => [0, 0, i]);
  const out = thinByTime(pts, 6);
  assert.deepEqual(out.map((p) => p[2]), [0, 6, 12, 18, 24]);
});

test('cap points samples evenly and keeps both ends', () => {
  const pts = Array.from({ length: 101 }, (_, i) => [0, 0, i]);
  const out = capPoints(pts, 11);
  assert.equal(out.length, 11);
  assert.equal(out[0][2], 0);
  assert.equal(out[10][2], 100);
});

test('index at or before', () => {
  const pts = [[0, 0, 10], [0, 0, 20], [0, 0, 30]];
  assert.equal(indexAtOrBefore(pts, 5), -1);
  assert.equal(indexAtOrBefore(pts, 10), 0);
  assert.equal(indexAtOrBefore(pts, 25), 1);
  assert.equal(indexAtOrBefore(pts, 99), 2);
});

test('position interpolates and respects gaps', () => {
  const pts = [[0, 0, 0], [10, 20, 10], [10, 20, 1000]];
  assert.deepEqual(positionAt(pts, 5), [5, 10]);
  assert.equal(positionAt(pts, -1), null);
  assert.equal(positionAt(pts, 2000), null);
  assert.equal(positionAt(pts, 500, 100), null);
  assert.deepEqual(positionAt(pts, 500), [10, 20]);
});

test('trail covers the window and ends at the head', () => {
  const pts = Array.from({ length: 10 }, (_, i) => [i, 0, i * 10]);
  const trail = trailAt(pts, 45, 20);
  assert.deepEqual(trail, [[3, 0], [4, 0], [4.5, 0]]);
});

test('split by year covers each calendar year', () => {
  const y = (yr, frac) => seasonToHours(yr, frac);
  const pts = [[0, 0, y(2010, 0.5)], [1, 0, y(2010, 0.9)], [2, 0, y(2011, 0.2)], [3, 0, y(2011, 0.6)]];
  const segs = splitByYear(pts);
  assert.deepEqual(segs.map((s) => s.year), [2010, 2011]);
  assert.equal(segs[0].start, yearStartHours(2010));
  // 2011's segment starts with the last 2010 fix so motion is continuous.
  assert.equal(segs[1].pts[0][0], 1);
});

test('season fraction maps to the right calendar day', () => {
  const h = seasonToHours(2020, 0.5);
  const d = new Date(h * 3.6e6);
  assert.equal(d.getUTCMonth(), 6); // early July in a leap year
});
