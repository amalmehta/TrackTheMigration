#!/usr/bin/env node
// Fetch the small assets the site needs besides tracks:
//   • species silhouettes from PhyloPic (https://www.phylopic.org), with credits
//   • colour legends for the NASA GIBS overlays, from NASA Worldview's palettes
// Writes site/icons/<species>.svg and site/data/assets.json.
//
//   node scripts/fetch-assets.mjs

import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_LAYERS } from '../site/js/environment.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'site', 'icons');
const OUT = join(ROOT, 'site', 'data', 'assets.json');

// Chosen by eye from PhyloPic search results; all CC0, public-domain mark or CC BY.
const SILHOUETTES = {
  wildebeest: '10e283ad-5f6b-4e14-8e1a-a3476b992474',
  zebra: '22f808e2-da14-4bfe-9672-0e5422d27212',
  'mule-deer': 'f889b336-9e67-4154-bc96-db4095a55be2',
  'blue-whale': '6ca9f0b7-cacb-45cc-9229-1b672d55b15b',
  'humpback-whale': '012afb33-55c3-4fc6-9ae3-3a91fda32fd5',
  'loggerhead-turtle': '3eb3d3d1-4db5-458a-ab03-c1092fbff140',
  'white-stork': '6846ae3b-0fdb-4cee-8d83-1f3c47e68fbc',
  osprey: 'd25f13d6-722e-4da3-8073-0a86b8a15976',
  'bar-tailed-godwit': 'a6a38d55-71be-43f2-b781-9a845662de20',
  pronghorn: '26f9f4f5-135c-42e2-959a-9d27848b33d7',
  elk: 'b156cc5b-3c1b-4c10-9de8-dfa9b6840f1a', // a cow: every elk in the study is female
  'white-fronted-goose': '6647bf96-4733-4bc4-91d8-d52d6f1e4ee0',
  'hudsonian-godwit': '91973860-8980-4c6f-a146-58ff0cf33cf7',
};

const LICENSE_NAMES = {
  'https://creativecommons.org/publicdomain/zero/1.0/': 'CC0 1.0',
  'https://creativecommons.org/publicdomain/mark/1.0/': 'Public Domain Mark 1.0',
  'https://creativecommons.org/licenses/by/3.0/': 'CC BY 3.0',
  'https://creativecommons.org/licenses/by/4.0/': 'CC BY 4.0',
};

async function json(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function silhouettes() {
  mkdirSync(ICONS, { recursive: true });
  const H = { Accept: 'application/vnd.phylopic.v2+json' };
  const { build } = await json('https://api.phylopic.org/', H);
  const out = {};
  for (const [species, uuid] of Object.entries(SILHOUETTES)) {
    const img = await json(`https://api.phylopic.org/images/${uuid}?build=${build}`, H);
    const license = img._links.license.href;
    if (!LICENSE_NAMES[license]) throw new Error(`${species}: unexpected licence ${license}`);
    const svg = await (await fetch(img._links.vectorFile.href)).text();
    await writeFile(join(ICONS, `${species}.svg`), svg);
    out[species] = {
      file: `icons/${species}.svg`,
      attribution: img.attribution || 'Unknown author',
      license: LICENSE_NAMES[license],
      licenseUrl: license,
      sourceUrl: `https://www.phylopic.org/images/${uuid}`,
    };
    console.log(`  ${species}: ${out[species].attribution} (${out[species].license})`);
  }
  return out;
}

// Worldview palettes hold hundreds of colours; keep ~24 evenly spaced stops.
async function legends() {
  const out = {};
  for (const [key, layer] of Object.entries(ENV_LAYERS)) {
    const p = await json(`https://worldview.earthdata.nasa.gov/config/palettes/${layer.palette}.json`);
    const legend = p.maps[0].legend;
    const colors = legend.colors.filter((c) => !c.endsWith('00')); // drop fully transparent
    const n = Math.min(24, colors.length);
    const stops = Array.from({ length: n }, (_, i) => '#' + colors[Math.round((i * (colors.length - 1)) / (n - 1))].slice(0, 6));
    out[key] = { stops, min: layer.legendMin ?? legend.minLabel, max: layer.legendMax ?? legend.maxLabel, units: layer.units ?? legend.units ?? '' };
    console.log(`  ${key}: ${stops.length} stops, ${out[key].min} – ${out[key].max} ${out[key].units}`);
  }
  return out;
}

console.log('▸ Silhouettes (PhyloPic)');
const icons = await silhouettes();
console.log('▸ Overlay legends (NASA Worldview)');
const layers = await legends();
await writeFile(OUT, JSON.stringify({ generated: new Date().toISOString(), icons, layers }, null, 2));
console.log('✓ wrote site/data/assets.json');
