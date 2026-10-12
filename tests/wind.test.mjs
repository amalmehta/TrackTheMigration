import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windComponents, travelSteps } from '../scripts/wind.mjs';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('wind components: from behind is a tailwind, from ahead a headwind', () => {
  // Heading north; a wind FROM the south (180°) pushes it along.
  near(windComponents(20, 180, 0).tail, 20);
  near(windComponents(20, 0, 0).tail, -20);
  // A west wind (from 270°) on a northbound bird comes from its left.
  const c = windComponents(20, 270, 0);
  near(c.tail, 0, 1e-9);
  near(c.cross, 20);
});

test('travel steps skip resting and sample long flights daily', () => {
  const pts = [[0, 0, 0], [0, 0.01, 24], [0, 3, 48], [0, 30, 48 + 24 * 5]];
  const steps = travelSteps(pts);
  assert.deepEqual(steps.map((s) => s.i), [2, 3]);
  assert.equal(steps[1].samples.length, 5);
  near(steps[0].heading, 0, 1e-6);
});
