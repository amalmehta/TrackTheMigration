import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fastestDay, milestoneStep, buildDiary } from '../scripts/diary.mjs';

test('fastest day uses fixes about a day apart', () => {
  const pts = [[0, 0, 0], [0, 1, 24], [0, 4, 48], [0, 4.5, 72]];
  const f = fastestDay(pts);
  assert.equal(f.t, 24);
  assert.ok(f.kmDay > 320 && f.kmDay < 340); // 3° of latitude in a day
});

test('milestones come in round steps, a handful per journey', () => {
  assert.equal(milestoneStep(800), 250);
  assert.equal(milestoneStep(47000), 10000);
  assert.equal(milestoneStep(180000), 50000);
});

test('a diary runs from first to last fix, in time order', () => {
  const pts = [[0, 50, 0], [0, 40, 24], [0, 30, 48], [0, 30, 24 * 20], [0, 10, 24 * 22]];
  const d = buildDiary({ pts }, {
    stops: [[0, 30, 48, 24 * 20]],
    crossings: [{ name: { en: 'Sahara' }, t0: 24 * 20, t1: 24 * 22, km: 2200 }],
    label: (lon, lat) => ['country', Math.round(lat)],
    nameIdx: () => 7,
  });
  assert.equal(d[0][0], 'start');
  assert.equal(d.at(-1)[0], 'end');
  assert.deepEqual(d.find((e) => e[0] === 'stay'), ['stay', 48, 18, ['country', 30]]);
  assert.deepEqual(d.find((e) => e[0] === 'cross'), ['cross', 480, 7, 48, 2200]);
  assert.ok(d.some((e) => e[0] === 'north') && d.some((e) => e[0] === 'south'));
  for (let i = 1; i < d.length; i++) assert.ok(d[i][1] >= d[i - 1][1]);
});
