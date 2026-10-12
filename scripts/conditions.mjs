// The real conditions each animal met, sampled at build time from NASA GIBS
// for every displayed fix: vegetation greenness (NDVI, monthly) under land
// animals, sea surface temperature (daily, snapped to the 1st or 15th) under
// marine animals. Dates outside an archive use the same season in the
// nearest covered year (as the overlays do).

import { join } from 'node:path';
import { ENV_LAYERS, overlayDate } from '../site/js/environment.js';
import { tileSampler, paletteLookup, paletteDecoder } from './tiles.mjs';

// Which layer for which group, and at what zoom (coarser for the ocean-wide SST).
const PLAN = {
  land: { key: 'vegetation', z: 7, digits: 2 },
  marine: { key: 'sst', z: 4, digits: 1 },
};

export async function conditionsSampler(rawDir, group) {
  const plan = PLAN[group];
  if (!plan) return null;
  const L = ENV_LAYERS[plan.key];
  const pal = await (await fetch(`https://worldview.earthdata.nasa.gov/config/palettes/${L.palette}.json`)).json();
  const sample = tileSampler({
    url: (z, x, y, date) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${L.layer}/default/${date}/${L.matrix}/${z}/${y}/${x}.png`,
    z: plan.z,
    dir: join(rawDir, 'gibs', plan.key),
    decoder: paletteDecoder(paletteLookup(pal)),
  });
  // One tile date per fix; SST is coarsened to twice a month to keep the tile count sane.
  const dateFor = (p) => {
    const d = overlayDate(plan.key, p[2]).date;
    return plan.key === 'sst' ? `${d.slice(0, 8)}${Number(d.slice(8)) >= 15 ? '15' : '01'}` : d;
  };
  const f = 10 ** plan.digits;
  return {
    key: plan.key,
    async sample(points) {
      const v = await sample(points, (p) => dateFor(p));
      return v.map((x) => (x == null ? null : Math.round(x * f) / f));
    },
  };
}
