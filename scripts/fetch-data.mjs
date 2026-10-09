#!/usr/bin/env node
// Fetch tracking data from the Movebank Data Repository and turn it into the
// small JSON files the site loads from site/data/.
//
//   node scripts/fetch-data.mjs               fetch what's missing, rebuild all
//   node scripts/fetch-data.mjs --refresh     re-download everything
//   node scripts/fetch-data.mjs zebra osprey  rebuild only these
//
// Raw downloads are cached in data/raw/ (not committed).

import { createReadStream, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS, GROUPS } from './datasets.mjs';
import {
  speedFilter, thinByTime, capPoints, unwrapLongitudes, trackLengthKm,
} from '../site/js/tracks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'site', 'data');
const API = 'https://datarepository.movebank.org/server/api/core';

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const only = args.filter((a) => !a.startsWith('--'));

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const tmp = dest + '.part';
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, dest);
}

async function packageMeta(ds) {
  const cache = join(RAW, `${ds.id}.meta.json`);
  if (!refresh && existsSync(cache)) return JSON.parse(await readFile(cache, 'utf8'));
  const res = await fetch(`${API}/items/${ds.package}`);
  if (!res.ok) throw new Error(`metadata ${res.status} for ${ds.id}`);
  const item = await res.json();
  const md = (k) => item.metadata[k]?.map((v) => v.value) ?? [];
  const doi = (md('dc.identifier.doi')[0] || md('dc.relation.ispartof')[0] || '').replace(/^doi:/, '');
  const meta = {
    title: item.name,
    paperCitation: md('dc.identifier.citation')[0] || '',
    authors: md('dc.contributor.author'),
    issued: md('dc.date.issued')[0] || '',
    doi,
    doiUrl: doi ? `https://doi.org/${doi}` : '',
    license: md('dc.rights')[0] || '',
    licenseUrl: md('dc.rights.uri')[0] || '',
    repositoryUrl: md('dc.identifier.uri')[0] || '',
    abstract: md('dc.description.abstract')[0] || '',
    papers: md('dc.relation.isreferencedby'),
  };
  const year = meta.issued.slice(0, 4);
  meta.dataCitation =
    `${meta.authors.join('; ')} (${year}) ${meta.title}. Movebank Data Repository.`;
  await writeFile(cache, JSON.stringify(meta, null, 2));
  return meta;
}

// Minimal RFC 4180 line splitter (Movebank never puts newlines in fields).
function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function readFixes(file, ds) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let col = null;
  const animals = new Map();
  let rows = 0;
  let kept = 0;
  for await (const line of rl) {
    if (!line) continue;
    const f = splitCsv(line);
    if (!col) {
      col = Object.fromEntries(f.map((name, i) => [name, i]));
      continue;
    }
    rows++;
    const get = (k) => (col[k] === undefined ? '' : f[col[k]]);
    if (get('visible') === 'false') continue;
    if (get('manually-marked-outlier') === 'true' || get('algorithm-marked-outlier') === 'true') continue;
    if (ds.argosClasses && !ds.argosClasses.includes(get('argos:lc'))) continue;
    const lon = parseFloat(get('location-long'));
    const lat = parseFloat(get('location-lat'));
    const ts = Date.parse(get('timestamp').replace(' ', 'T') + 'Z');
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(ts)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) continue;
    const id = get('individual-local-identifier') || get('tag-local-identifier');
    if (!animals.has(id)) animals.set(id, []);
    animals.get(id).push([lon, lat, ts / 3.6e6]);
    if (ds.stopovers) {
      const te = Date.parse(get('end-timestamp').replace(' ', 'T') + 'Z');
      if (Number.isFinite(te) && te > ts) animals.get(id).push([lon, lat, te / 3.6e6]);
    }
    kept++;
  }
  return { animals, rows, kept };
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

function processAnimal(raw, ds) {
  raw.sort((a, b) => a[2] - b[2]);
  let pts = speedFilter(raw, ds.maxKmh);
  pts = thinByTime(pts, ds.thinHours);
  pts = capPoints(pts, ds.maxPoints);
  pts = unwrapLongitudes(pts).map(([lon, lat, t]) => [round(lon, 4), round(lat, 4), round(t, 1)]);
  return pts;
}

async function build(ds) {
  mkdirSync(RAW, { recursive: true });
  const csv = join(RAW, `${ds.id}.csv`);
  if (refresh || !existsSync(csv)) {
    console.log(`  downloading ${ds.id}…`);
    await download(`${API}/bitstreams/${ds.file}/content`, csv);
  }
  const meta = await packageMeta(ds);
  const { animals, rows, kept } = await readFixes(csv, ds);

  const tracks = [];
  for (const [id, raw] of animals) {
    const pts = processAnimal(raw, ds);
    if (pts.length < (ds.minPoints ?? 10)) continue;
    const days = (pts[pts.length - 1][2] - pts[0][2]) / 24;
    if (days < 3) continue;
    tracks.push({ id, km: Math.round(trackLengthKm(pts)), days: Math.round(days), pts });
  }
  tracks.sort((a, b) => b.km - a.km);
  const chosen = tracks.slice(0, ds.maxAnimals);
  if (chosen.length === 0) throw new Error(`no usable tracks for ${ds.id}`);

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  let start = Infinity, end = -Infinity, points = 0;
  for (const t of chosen) {
    for (const [lon, lat, h] of t.pts) {
      if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      if (h < start) start = h; if (h > end) end = h;
    }
    points += t.pts.length;
  }
  const kms = chosen.map((t) => t.km).sort((a, b) => a - b);

  await writeFile(
    join(OUT, `${ds.id}.json`),
    JSON.stringify({ id: ds.id, maxGapHours: ds.maxGapHours, animals: chosen }),
  );

  const { package: _p, file: _f, argosClasses: _a, stopovers: _s, minPoints: _m, maxKmh, thinHours, maxGapHours, maxAnimals, maxPoints, ...info } = ds;
  return {
    ...info,
    groupName: GROUPS[ds.group],
    source: { ...meta, abstract: undefined, papers: undefined, fileUrl: `${API}/bitstreams/${ds.file}/content` },
    stats: {
      rawFixes: rows,
      usableFixes: kept,
      animalsInStudy: animals.size,
      animalsShown: chosen.length,
      pointsShown: points,
      start: new Date(start * 3.6e6).toISOString(),
      end: new Date(end * 3.6e6).toISOString(),
      medianKm: kms[Math.floor(kms.length / 2)],
      longestKm: kms[kms.length - 1],
      bbox: [minLon, minLat, maxLon, maxLat].map((v) => round(v, 3)),
    },
    processing: { maxKmh, thinHours, maxGapHours, maxAnimals, maxPoints },
    _abstract: meta.abstract,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const indexPath = join(OUT, 'index.json');
  const previous = existsSync(indexPath) ? JSON.parse(await readFile(indexPath, 'utf8')).species : [];
  const species = [];
  for (const ds of DATASETS) {
    if (only.length && !only.includes(ds.id)) {
      const old = previous.find((s) => s.id === ds.id);
      if (old) species.push(old);
      continue;
    }
    console.log(`▸ ${ds.name}`);
    const entry = await build(ds);
    const { _abstract, ...clean } = entry;
    const s = clean.stats;
    console.log(
      `  ${s.animalsShown}/${s.animalsInStudy} animals, ${s.pointsShown} points, ` +
      `${s.start.slice(0, 10)} → ${s.end.slice(0, 10)}, median ${s.medianKm} km, longest ${s.longestKm} km`,
    );
    if (process.env.SHOW_ABSTRACTS) console.log(`  abstract: ${_abstract}\n`);
    species.push(clean);
  }
  const index = { generated: new Date().toISOString(), groups: GROUPS, species };
  await writeFile(indexPath, JSON.stringify(index, null, 2));
  console.log(`✓ wrote ${species.length} species to site/data/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
