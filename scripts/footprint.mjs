// Sample the Human Footprint index (0–100, SEDAC via NASA GIBS) under track
// points at build time, using the shared tile sampler. Tiles are cached in
// data/raw/hf/.

import { join } from 'node:path';
import { tileSampler, paletteLookup, paletteDecoder, lonLatToPixel as px } from './tiles.mjs';

const LAYER = 'Human_Footprint_1995-2004';
const Z = 7; // the layer's finest level (~1.2 km per pixel at the equator)

// Kept for tests and callers: Web-Mercator pixel coordinates at the footprint zoom.
export const lonLatToPixel = (lon, lat) => px(lon, lat, Z);

export async function footprintSampler(rawDir) {
  const pal = await (await fetch(`https://worldview.earthdata.nasa.gov/config/palettes/${LAYER}.json`)).json();
  const lookup = paletteLookup(pal);
  for (const [k, v] of lookup) lookup.set(k, Math.round(v));
  const sample = tileSampler({
    url: (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYER}/default/GoogleMapsCompatible_Level7/${z}/${y}/${x}.png`,
    z: Z,
    dir: join(rawDir, 'hf'),
    decoder: paletteDecoder(lookup),
  });
  return async (points) => (await sample(points)).map((v) => (v == null ? -1 : v));
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
