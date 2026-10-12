import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lonLatToPixel, paletteLookup, paletteDecoder, terrariumDecoder } from '../scripts/tiles.mjs';

test('web-mercator pixels: corners and centre', () => {
  assert.deepEqual(lonLatToPixel(0, 0, 0), [128, 128]);
  assert.deepEqual(lonLatToPixel(-180, 85.05, 1), [0, 0]);
  assert.deepEqual(lonLatToPixel(179.9999, -85.05, 1), [511, 511]);
  // Longitudes wrap.
  assert.deepEqual(lonLatToPixel(190, 10, 3), lonLatToPixel(-170, 10, 3));
});

test('palette lookup takes range midpoints and skips entries without values', () => {
  const lookup = paletteLookup({ maps: [{ entries: { colors: ['ff000000', '00ff00ff', '0000ffff'], values: [null, [0, 0.2], [0.5]] } }] });
  assert.equal(lookup.has('ff0000'), false);
  assert.equal(lookup.get('00ff00'), 0.1);
  assert.equal(lookup.get('0000ff'), 0.5);
});

test('paletted tiles decode through the colour table', () => {
  const read = paletteDecoder(new Map([['00ff00', 0.1]]))({ palette: [0, 0, 0, 0, 255, 0], pixels: [1, 0] });
  assert.equal(read(0), 0.1);
  assert.equal(read(1), null);
});

test('terrarium elevation', () => {
  // 128·256 + 10 + 128/256 − 32768 = 10.5 m
  const read = terrariumDecoder({ channels: 3, pixels: [128, 10, 128] });
  assert.equal(read(0), 10.5);
});
