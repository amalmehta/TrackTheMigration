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
  speedFilter, thinByTime, capPoints, flightFixes, unwrapLongitudes, trackLengthKm, findStops, clusterStops,
} from '../site/js/tracks.js';
import { buildFacets } from './reference.mjs';
import { footprintSampler, footprintSummary } from './footprint.mjs';
import { conditionsSampler } from './conditions.mjs';
import { groundSampler } from './elevation.mjs';
import { windSampler, windAlong } from './wind.mjs';

let sampleFootprint = null; // created on first use (fetches NASA's palette)
let groundAt = null;        // ground-height sampler, created on first use
let windAt = null;          // wind sampler, created on first use

// Where an animal counts as having "stopped": within km for at least days.
const STOP_DEFAULTS = { land: { km: 6, days: 10 }, marine: { km: 40, days: 7 }, birds: { km: 30, days: 3 } };

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

async function readCsvRows(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let col = null;
  const rows = [];
  for await (const line of rl) {
    if (!line) continue;
    const f = splitCsv(line);
    if (!col) { col = f; continue; }
    rows.push(Object.fromEntries(col.map((k, i) => [k, f[i] ?? ''])));
  }
  return rows;
}

async function readFixes(file, ds, animals = new Map(), heights = new Map()) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let col = null;
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
    // Flight height (birds only: collars on land animals record the ground).
    if (ds.group === 'birds') {
      const h = parseFloat(get('height-raw') || get('height-above-msl'));
      if (Number.isFinite(h) && h > -500 && h < 9000) {
        if (!heights.has(id)) heights.set(id, []);
        heights.get(id).push([ts / 3.6e6, lon, lat, h]);
      }
    }
    if (ds.stopovers) {
      const te = Date.parse(get('end-timestamp').replace(' ', 'T') + 'Z');
      if (Number.isFinite(te) && te > ts) animals.get(id).push([lon, lat, te / 3.6e6]);
    }
    kept++;
  }
  return { animals, rows, kept };
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

// Clean, then find stops on the full-resolution track, then thin for display.
function processAnimal(raw, ds) {
  raw.sort((a, b) => a[2] - b[2]);
  const clean = unwrapLongitudes(speedFilter(raw, ds.maxKmh));
  const stop = ds.stop || STOP_DEFAULTS[ds.group];
  const stops = findStops(clean, stop.km, stop.days * 24, ds.maxGapHours);
  let pts = thinByTime(clean, ds.thinHours);
  pts = capPoints(pts, ds.maxPoints);
  pts = pts.map(([lon, lat, t]) => [round(lon, 4), round(lat, 4), round(t, 1)]);
  return { pts, stops };
}

// The source CSVs for a dataset: one file, or several (e.g. GPS + Argos).
const sourceFiles = (ds) => (ds.files || [['', ds.file]]).map(([suffix, uuid]) => ({ uuid, path: join(RAW, `${ds.id}${suffix}.csv`) }));

async function build(ds) {
  mkdirSync(RAW, { recursive: true });
  const files = sourceFiles(ds);
  const refPath = join(RAW, `${ds.id}.ref.csv`);
  for (const { uuid, path } of [...files, ...(ds.ref ? [{ uuid: ds.ref, path: refPath }] : [])]) {
    if (refresh || !existsSync(path)) {
      console.log(`  downloading ${path.split('/').pop()}…`);
      await download(`${API}/bitstreams/${uuid}/content`, path);
    }
  }
  const meta = await packageMeta(ds);
  const animals = new Map();
  const heights = new Map();
  let rows = 0;
  let kept = 0;
  for (const { path } of files) {
    const r = await readFixes(path, ds, animals, heights);
    rows += r.rows;
    kept += r.kept;
  }

  const tracks = [];
  for (const [id, raw] of animals) {
    const { pts, stops } = processAnimal(raw, ds);
    if (pts.length < (ds.minPoints ?? 10)) continue;
    const days = (pts[pts.length - 1][2] - pts[0][2]) / 24;
    if (days < 3) continue;
    tracks.push({ id, km: Math.round(trackLengthKm(pts)), days: Math.round(days), pts, stops });
  }
  tracks.sort((a, b) => b.km - a.km);
  const chosen = tracks.slice(0, ds.maxAnimals);
  // Make room for birds that recorded flight height, even if their tracks are shorter.
  // Height fixes as track points [lon, lat, hours, height], in time order.
  const heightPts = (id) => (heights.get(id) || []).map(([time, lon, lat, alt]) => [lon, lat, time, alt]).sort((a, b) => a[2] - b[2]);
  if (ds.altAnimals) {
    const extra = tracks.slice(ds.maxAnimals)
      .map((t) => ({ t, n: flightFixes(heightPts(t.id)).length }))
      .filter(({ n }) => n >= 50)
      .sort((a, b) => b.n - a.n)
      .map(({ t }) => t)
      .slice(0, ds.altAnimals);
    chosen.push(...extra);
  }
  if (chosen.length === 0) throw new Error(`no usable tracks for ${ds.id}`);

  // Who each animal is (from the study's reference data), and the groupings worth filtering by.
  const { attrs, facets } = ds.ref
    ? buildFacets(await readCsvRows(refPath), chosen.map((t) => t.id))
    : { attrs: new Map(), facets: [] };

  // Stopover sites shared across animals.
  const stop = ds.stop || STOP_DEFAULTS[ds.group];
  const sites = clusterStops(chosen.flatMap((t) => t.stops.map((st) => ({ ...st, animal: t.id }))), stop.km * 2.5)
    .slice(0, 40)
    .map((x) => ({
      lon: round(x.lon, 3), lat: round(x.lat, 3), days: Math.round(x.days), visits: x.visits,
      animals: x.animals, months: x.months.map((m) => Math.round(m)),
    }));
  // Human footprint under every displayed fix (land animals and birds; the sea has no data).
  let hfAll = [];
  const hfByAnimal = new Map();
  if (ds.group !== 'marine') {
    sampleFootprint ??= await footprintSampler(RAW);
    for (const t of chosen) {
      const v = await sampleFootprint(t.pts);
      hfByAnimal.set(t.id, v);
      hfAll = hfAll.concat(v);
    }
  }
  // Real conditions at each fix: greenness under land animals, sea temperature under marine ones.
  const condBy = new Map();
  let condKey = null;
  const cond = await conditionsSampler(RAW, ds.group);
  if (cond) {
    condKey = cond.key;
    for (const t of chosen) condBy.set(t.id, await cond.sample(t.pts));
  }

  // Flight height: GPS height minus the ground under it, for birds that recorded it.
  const altBy = new Map();
  for (const t of chosen) {
    // Only fixes taken in flight, kept as whole flights so the curtain is continuous.
    const pts = flightFixes(heightPts(t.id));
    if (pts.length < 20) continue;
    const ground = await (groundAt ??= groundSampler(RAW))(pts);
    altBy.set(t.id, pts.map((p, i) => [round(p[2], 1), round(p[0], 4), round(p[1], 4), Math.round(p[3]), ground[i] == null ? null : Math.round(p[3] - ground[i])]));
  }

  // Wind 100 m up along each bird's travelling steps (ERA5 via Open-Meteo).
  const windBy = new Map();
  if (ds.group === 'birds' && !process.env.NO_WIND) {
    for (const t of chosen) windBy.set(t.id, await windAlong(t.pts, (windAt ??= windSampler(RAW))));
  }

  const animalsOut = chosen.map(({ stops, ...t }) => ({
    ...t,
    attrs: attrs.get(t.id) || {},
    stops: stops.map((st) => [round(st.lon, 3), round(st.lat, 3), round(st.start, 1), round(st.end, 1)]),
    ...(hfByAnimal.has(t.id) ? { hf: hfByAnimal.get(t.id), hfSummary: footprintSummary(hfByAnimal.get(t.id)) } : {}),
    ...(condBy.has(t.id) ? { cond: condBy.get(t.id) } : {}),
    // [hours, lon, lat, height above sea (m), height above ground (m) or null]
    ...(altBy.has(t.id) ? { alt: altBy.get(t.id) } : {}),
    // [step start h, step end h, tailwind km/h (+ helps), crosswind km/h (+ from the left), ground speed km/day]
    ...(windBy.get(t.id)?.length ? { wind: windBy.get(t.id) } : {}),
  }));

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
    JSON.stringify({ id: ds.id, maxGapHours: ds.maxGapHours, facets, sites, condKey, animals: animalsOut }),
  );

  const {
    package: _p, file: _f, files: _fs, ref: _r, stop: _st, argosClasses: _a, stopovers: _s, minPoints: _m, altAnimals: _aa,
    maxKmh, thinHours, maxGapHours, maxAnimals, maxPoints, ...info
  } = ds;
  return {
    ...info,
    groupName: GROUPS[ds.group],
    source: { ...meta, abstract: undefined, papers: undefined, fileUrls: files.map((f) => `${API}/bitstreams/${f.uuid}/content`) },
    facets: facets.map((f) => ({ key: f.key, label: f.label })),
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
      sites: sites.length,
      footprint: ds.group === 'marine' ? null : footprintSummary(hfAll),
      condition: condKey,
      flyingAnimals: altBy.size,
      windSteps: [...windBy.values()].reduce((n, w) => n + w.length, 0),
    },
    processing: { maxKmh, thinHours, maxGapHours, maxAnimals, maxPoints, stop },
    _abstract: meta.abstract,
  };
}

// A light copy of every species for the All migrations view (≈ 0.3 MB gzipped
// instead of 1.6 MB): at most 180 points per animal and the 15 busiest sites.
// A species' full file loads only when it's opened.
const OVERVIEW_POINTS = 180;
async function writeOverview(ids) {
  const out = {};
  for (const id of ids) {
    const d = JSON.parse(await readFile(join(OUT, `${id}.json`), 'utf8'));
    out[id] = {
      maxGapHours: d.maxGapHours,
      sites: d.sites.slice(0, 15),
      animals: d.animals.map((a) => ({
        id: a.id, km: a.km, days: a.days,
        attrs: a.attrs, hfMedian: a.hfSummary?.median ?? null, flies: !!a.alt,
        pts: capPoints(a.pts, OVERVIEW_POINTS).map(([lon, lat, t]) => [round(lon, 3), round(lat, 3), Math.round(t)]),
      })),
    };
  }
  await writeFile(join(OUT, 'overview.json'), JSON.stringify(out));
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
    console.log(`  facets: ${clean.facets.map((f) => f.key).join(', ') || '—'} · stopover sites: ${clean.stats.sites}` +
      (s.footprint ? ` · footprint median ${s.footprint.median}, bands ${s.footprint.bands.join('/')}%` : ''));
    if (process.env.SHOW_ABSTRACTS) console.log(`  abstract: ${_abstract}\n`);
    species.push(clean);
  }
  const index = { generated: new Date().toISOString(), groups: GROUPS, species };
  await writeFile(indexPath, JSON.stringify(index, null, 2));
  await writeOverview(species.map((s) => s.id));
  console.log(`✓ wrote ${species.length} species to site/data/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
