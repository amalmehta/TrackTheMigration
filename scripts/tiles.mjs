// Read values out of web-map tiles at build time: fetch (and cache) the
// 256-px Web-Mercator tiles covering a set of points, decode them, and turn
// each point's pixel into a number. Used for the human footprint, NASA
// conditions along each route, and ground height under flying birds.

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodePng } from './png.mjs';

// Web-Mercator global pixel coordinates at zoom z.
export function lonLatToPixel(lon, lat, z) {
  const n = 2 ** z * 256;
  const w = ((((lon + 180) % 360) + 360) % 360) / 360;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  const yf = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return [Math.min(n - 1, Math.floor(w * n)), Math.min(n - 1, Math.max(0, Math.floor(yf * n)))];
}

// A colour → value table from a NASA Worldview palette (entries.colors/values).
export function paletteLookup(palette) {
  const { colors, values } = palette.maps[0].entries;
  const map = new Map();
  colors.forEach((c, i) => {
    const v = values?.[i];
    if (!v) return;
    const [a, b] = v.length === 2 ? v : [v[0], v[0]];
    const lo = a ?? b;
    const hi = b ?? a;
    if (lo == null) return;
    map.set(c.slice(0, 6).toLowerCase(), (lo + hi) / 2);
  });
  return map;
}

// Turn a decoded paletted tile into values via a colour table (null = no data).
export function paletteDecoder(lookup) {
  return (img) => {
    const lut = new Array(256).fill(null);
    for (let i = 0; i < 256 && img.palette && i * 3 + 2 < img.palette.length; i++) {
      const hex = [0, 1, 2].map((k) => img.palette[i * 3 + k].toString(16).padStart(2, '0')).join('');
      if (lookup.has(hex)) lut[i] = lookup.get(hex);
    }
    return (p) => lut[img.pixels[p]];
  };
}

// Mapzen/AWS "terrarium" elevation: metres = R·256 + G + B/256 − 32768.
export const terrariumDecoder = (img) => (p) => {
  const c = img.channels;
  const [r, g, b] = [img.pixels[p * c], img.pixels[p * c + 1], img.pixels[p * c + 2]];
  return r * 256 + g + b / 256 - 32768;
};

// sampler({ url(z, x, y, key), z, dir, decoder }) → async sample(points, key?)
// `key` separates tiles that differ by something other than position (a date).
export function tileSampler({ url, z, dir, decoder, concurrency = 8 }) {
  mkdirSync(dir, { recursive: true });
  const tiles = new Map();
  async function load(x, y, key) {
    const id = `${key ?? ''}|${x}|${y}`;
    if (tiles.has(id)) return tiles.get(id);
    const file = join(dir, `${key ? `${key}_` : ''}${z}_${x}_${y}.png`);
    let buf = null;
    if (existsSync(file)) buf = await readFile(file);
    else {
      const res = await fetch(url(z, x, y, key)).catch(() => null);
      if (res?.ok) {
        buf = Buffer.from(await res.arrayBuffer());
        await writeFile(file, buf);
      }
    }
    let read = null;
    if (buf) {
      try { read = decoder(decodePng(buf)); } catch { read = null; } // e.g. an XML error page
    }
    tiles.set(id, read);
    return read;
  }
  return async function sample(points, keyOf = () => undefined) {
    const px = points.map((p, i) => ({ xy: lonLatToPixel(p[0], p[1], z), key: keyOf(p, i) }));
    const need = [...new Map(px.map(({ xy: [x, y], key }) => [`${key ?? ''}|${x >> 8}|${y >> 8}`, [x >> 8, y >> 8, key]])).values()]
      .filter(([x, y, key]) => !tiles.has(`${key ?? ''}|${x}|${y}`));
    for (let i = 0; i < need.length; i += concurrency) {
      await Promise.all(need.slice(i, i + concurrency).map(([x, y, key]) => load(x, y, key)));
    }
    return px.map(({ xy: [x, y], key }) => {
      const read = tiles.get(`${key ?? ''}|${x >> 8}|${y >> 8}`);
      if (!read) return null;
      const v = read((y & 255) * 256 + (x & 255));
      return v == null || Number.isNaN(v) ? null : v;
    });
  };
}
