import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeView } from '../site/js/share.js';

test('empty hash means no shared view', () => {
  assert.equal(decodeView(''), null);
  assert.equal(decodeView('#'), null);
});

test('a dates-mode link with a followed animal and overlay', () => {
  const v = decodeView('#s=white-stork&t=2003-09-12&f=Prinzesschen&ov=vegetation');
  assert.equal(v.species, 'white-stork');
  assert.equal(v.mode, 'dates');
  assert.equal(new Date(v.t * 3.6e6).toISOString().slice(0, 10), '2003-09-12');
  assert.equal(v.follow, 'Prinzesschen');
  assert.equal(v.overlay, 'vegetation');
});

test('a season-mode link with camera, colour-by and filters', () => {
  const v = decodeView('#s=osprey&d=10-01&c=-80.5,20.25,3.1,20,0&cb=site&hide=sex%3Dmale,site%3DWest');
  assert.equal(v.mode, 'season');
  assert.ok(Math.abs(v.frac - 273.5 / 365) < 0.003);
  assert.deepEqual(v.camera, { center: [-80.5, 20.25], zoom: 3.1, pitch: 20, bearing: 0 });
  assert.equal(v.colorBy, 'site');
  assert.deepEqual(v.hidden, ['sex=male', 'site=West']);
});

test('bad values are ignored, not trusted', () => {
  const v = decodeView('#s=zebra&t=yesterday&d=13&c=1,2,3');
  assert.equal(v.mode, null);
  assert.equal(v.camera, null);
  assert.equal(decodeView('#st=3').story, 2);
});

test('busiest months read as ranges, wrapping the new year', async () => {
  const { busiestMonths } = await import('../site/js/store.js');
  assert.equal(busiestMonths([9, 9, 9, 0, 0, 0, 0, 0, 0, 9, 9, 9]), 'Oct–Mar');
  assert.equal(busiestMonths([0, 0, 5, 10, 0, 0, 0, 0, 9, 0, 0, 0]), 'Apr, Sep');
  assert.equal(busiestMonths([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), '—');
});
