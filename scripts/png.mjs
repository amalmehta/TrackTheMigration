// A small PNG decoder for 8-bit, non-interlaced images (palette, grey, RGB, RGBA),
// enough to read NASA GIBS tiles without adding a dependency.
// Returns { width, height, channels, pixels, palette } where pixels holds one
// byte per channel (palette index for colour type 3).

import { inflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let ihdr = null;
  let palette = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        depth: data[8], color: data[9], interlace: data[12],
      };
    } else if (type === 'PLTE') palette = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('PNG without IHDR');
  if (ihdr.depth !== 8 || ihdr.interlace !== 0 || !CHANNELS[ihdr.color]) {
    throw new Error(`unsupported PNG (depth ${ihdr.depth}, colour ${ihdr.color}, interlace ${ihdr.interlace})`);
  }
  const ch = CHANNELS[ihdr.color];
  const { width: w, height: h } = ihdr;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[dst + x - ch] : 0;          // left
      const b = y > 0 ? out[dst - stride + x] : 0;         // up
      const c = x >= ch && y > 0 ? out[dst - stride + x - ch] : 0; // up-left
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[dst + x] = v & 255;
    }
  }
  return { width: w, height: h, channels: ch, pixels: out, palette };
}
