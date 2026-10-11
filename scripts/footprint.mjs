// Sample the Human Footprint index (0–100, SEDAC via NASA GIBS) under track
// points at build time. Tiles are cached in data/raw/hf/. A pixel's palette
// colour is matched to NASA Worldview's colour map to recover its value.

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodePng } from './png.mjs';

const LAYER = 'Human_Footprint_1995-2004';
const Z = 7; // the layer's finest level (~1.2 km per pixel at the equator)
const TILE = (x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYER}/default/GoogleMapsCompatible_Level7/${Z}/${y}/${x}.png`;

// Web-Mercator pixel coordinates at zoom Z.
export function lonLatToPixel(lon, lat) {
  const n = 2 ** Z * 256;
  const w = ((((lon + 180) % 360) + 360) % 360) / 360;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  const yf = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return [Math.floor(w * n), Math.floor(yf * n)];
}

export async function footprintSampler(rawDir) {
  const dir = join(rawDir, 'hf');
  mkdirSync(dir, { recursive: true });
  // Colour → value, from NASA Worldview's palette for this layer.
  const pal = await (await fetch(`https://worldview.earthdata.nasa.gov/config/palettes/${LAYER}.json`)).json();
  const { colors, values } = pal.maps[0].entries;
  const byColor = new Map(colors.map((c, i) => [c.slice(0, 6), Math.round((values[i][0] + values[i][1]) / 2)]));

  const tiles = new Map(); // "x/y" → Int16Array of values (-1 = no data)
  async function tile(x, y) {
    const key = `${x}/${y}`;
    if (tiles.has(key)) return tiles.get(key);
    const file = join(dir, `${x}_${y}.png`);
    let buf;
    if (existsSync(file)) buf = await readFile(file);
    else {
      const res = await fetch(TILE(x, y));
      if (!res.ok) { tiles.set(key, null); return null; }
      buf = Buffer.from(await res.arrayBuffer());
      await writeFile(file, buf);
    }
    let img;
    try { img = decodePng(buf); } catch { tiles.set(key, null); return null; } // e.g. an XML error page
    const lut = new Int16Array(256).fill(-1);
    for (let i = 0; i < 256 && img.palette && i * 3 + 2 < img.palette.length; i++) {
      const hex = [0, 1, 2].map((k) => img.palette[i * 3 + k].toString(16).padStart(2, '0')).join('');
      if (byColor.has(hex)) lut[i] = byColor.get(hex);
    }
    const vals = new Int16Array(img.width * img.height);
    for (let p = 0; p < vals.length; p++) vals[p] = lut[img.pixels[p]];
    tiles.set(key, vals);
    return vals;
  }

  // Fetch every tile the points need, a few at a time, then read values.
  return async function sample(points) {
    const px = points.map(([lon, lat]) => lonLatToPixel(lon, lat));
    const need = [...new Set(px.map(([x, y]) => `${x >> 8}/${y >> 8}`))].filter((k) => !tiles.has(k));
    for (let i = 0; i < need.length; i += 8) {
      await Promise.all(need.slice(i, i + 8).map((k) => tile(...k.split('/').map(Number))));
    }
    return px.map(([x, y]) => {
      const t = tiles.get(`${x >> 8}/${y >> 8}`);
      return t ? t[(y & 255) * 256 + (x & 255)] : -1;
    });
  };
}

// Share of fixes in each footprint band, ignoring no-data (sea).
export const HF_BANDS = [[0, 9], [10, 24], [25, 49], [50, 100]];
export function footprintSummary(values) {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  if (!v.length) return null;
  return {
    median: v[Math.floor(v.length / 2)],
    bands: HF_BANDS.map(([a, b]) => Math.round((v.filter((x) => x >= a && x <= b).length / v.length) * 100)),
    n: v.length,
  };
}
