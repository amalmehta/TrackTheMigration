import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleTrack, findCrossings } from '../scripts/barriers.mjs';
import { inPolygon } from '../scripts/places.mjs';

// A square "sea" from 0° to 4° east, between 10°S and 10°N.
const SEA = [[[0, -10], [4, -10], [4, 10], [0, 10], [0, -10]]];
const barrierAt = (lon, lat) => (inPolygon([lon, lat], SEA) ? { en: 'Test Sea', es: 'Mar', fr: 'Mer', kind: 'sea' } : null);

test('point in polygon with a hole', () => {
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
  assert.equal(inPolygon([2, 2], [ring, hole]), true);
  assert.equal(inPolygon([5, 5], [ring, hole]), false);
  assert.equal(inPolygon([12, 5], [ring]), false);
});

test('samples along straight lines, not across gaps', () => {
  const s = sampleTrack([[0, 0, 0], [1, 0, 10], [9, 0, 1000]], { stepKm: 20, maxGapHours: 100 });
  assert.ok(s.length >= 6 && s.length <= 8); // ~111 km in 20 km steps, then a gap
  assert.equal(s.at(-1).gapBefore, true);
});

test('a flight straight across the sea is one crossing', () => {
  const c = findCrossings([[-2, 0, 0], [6, 0, 20]], barrierAt, { trustKm: 300 });
  assert.equal(c.length, 1);
  assert.equal(c[0].name.en, 'Test Sea');
  assert.ok(c[0].km > 400 && c[0].km < 460);
  assert.ok(c[0].t1 - c[0].t0 > 9 && c[0].t1 - c[0].t0 < 11);
});

test('going in and coming back out the same side, or living there, is not a crossing', () => {
  assert.equal(findCrossings([[-2, 0, 0], [1, 0, 10], [-2, 0, 20]], barrierAt).length, 0);
  assert.equal(findCrossings([[-2, 0, 0], [2, 0, 10], [2, 0, 24 * 100], [6, 0, 24 * 101]], barrierAt).length, 0);
});

test('a short straight line clipping the sea between distant fixes is not trusted', () => {
  // No fix inside, only ~440 km of line: probably flew round the coast.
  assert.equal(findCrossings([[-2, 0, 0], [6, 0, 20]], barrierAt, { trustKm: 600 }).length, 0);
  // A fix inside the sea makes it real.
  assert.equal(findCrossings([[-2, 0, 0], [2, 0, 10], [6, 0, 20]], barrierAt).length, 1);
});
