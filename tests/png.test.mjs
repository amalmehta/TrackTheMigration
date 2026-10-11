import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng } from '../scripts/png.mjs';

// Build a PNG in memory (CRCs are not checked by the decoder, so zeros are fine).
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
}
function png(w, h, color, rows, palette) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = color;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(palette ? [chunk('PLTE', Buffer.from(palette))] : []),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('decodes a paletted PNG with mixed row filters', () => {
  // 3×2 indices: row 0 [1,2,3] with filter 0; row 1 [1,2,3] written with filter 2 (up) as zeros.
  const buf = png(3, 2, 3, [0, 1, 2, 3, 2, 0, 0, 0], [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  const img = decodePng(buf);
  assert.equal(img.channels, 1);
  assert.deepEqual([...img.pixels], [1, 2, 3, 1, 2, 3]);
  assert.deepEqual([...img.palette.subarray(3, 6)], [255, 0, 0]);
});

test('decodes RGB with sub and Paeth filters', () => {
  // 2×2 RGB. Row 0 filter 1 (sub): [10,20,30, +5,+5,+5] → [10,20,30,15,25,35].
  // Row 1 filter 4 (Paeth): first pixel predicts from up, second from left/up/up-left.
  const rows = [1, 10, 20, 30, 5, 5, 5, 4, 1, 1, 1, 0, 0, 0];
  const img = decodePng(png(2, 2, 2, rows));
  assert.deepEqual([...img.pixels.subarray(0, 6)], [10, 20, 30, 15, 25, 35]);
  assert.deepEqual([...img.pixels.subarray(6, 9)], [11, 21, 31]);
});

test('rejects what it cannot read', () => {
  assert.throws(() => decodePng(Buffer.from('not a png at all')), /not a PNG/);
});

test('footprint pixel maths and summary', async () => {
  const { lonLatToPixel, footprintSummary } = await import('../scripts/footprint.mjs');
  assert.deepEqual(lonLatToPixel(-180, 0), [0, 16384]);
  assert.deepEqual(lonLatToPixel(0, 0), [16384, 16384]);
  const [, yNorth] = lonLatToPixel(0, 60);
  assert.ok(yNorth < 16384);
  const s = footprintSummary([-1, 0, 5, 12, 30, 60, -1]);
  assert.equal(s.n, 5);
  assert.equal(s.median, 12);
  assert.deepEqual(s.bands, [40, 20, 20, 20]);
  assert.equal(footprintSummary([-1, -1]), null);
});
