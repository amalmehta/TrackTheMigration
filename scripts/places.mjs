// Place names at build time, offline, from Natural Earth (public domain):
// for any point, the nearest town (within 60 km), the state or province
// (larger countries), the country, the sea (or the coastal town it's off), or
// lake, and any desert, mountain range or similar region it lies in. Names
// come in English, Spanish and French where Natural Earth has them.
// Files are cached in data/raw/ne/.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { haversineKm } from '../site/js/tracks.js';

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const FILES = {
  countries: 'ne_50m_admin_0_countries',
  marine: 'ne_10m_geography_marine_polys',
  regions: 'ne_50m_geography_regions_polys',
  towns: 'ne_10m_populated_places_simple',
  lakes: 'ne_50m_lakes',
  states: 'ne_50m_admin_1_states_provinces', // the larger countries only
};
// Region classes worth naming (not continents, islands or vague "geoareas").
const REGION_CLASSES = new Set(['Desert', 'Range/mtn', 'Plateau', 'Tundra', 'Wetlands', 'Delta', 'Basin']);
// Seas that are parts of a bigger, better-known one.
export const SEA_GROUPS = {
  'Mediterranean Sea': ['Mediterranean Sea', 'Tyrrhenian Sea', 'Adriatic Sea', 'Ionian Sea', 'Balearic Sea', 'Aegean Sea', 'Ligurian Sea', 'Alboran Sea', 'Strait of Gibraltar', 'Sea of Crete', 'Levantine Sea', 'Gulf of Sidra', 'Gulf of Gabès'],
  'Pacific Ocean': ['North Pacific Ocean', 'South Pacific Ocean'],
  'Atlantic Ocean': ['North Atlantic Ocean', 'South Atlantic Ocean'],
};
const SEA_PARENT = new Map(Object.entries(SEA_GROUPS).flatMap(([parent, kids]) => kids.map((k) => [k, parent])));

const TOWN_KM = 60;
const OFFSHORE_KM = 150;
const MIN_TOWN_POP = 10000;

const title = (s) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\bMts\./, 'Mountains').replace(/\bRa\./, 'Range') : s);
const names = (p, en, es, fr) => {
  const e = title(p[en] ?? p.name ?? p.NAME);
  return { en: e, es: title(p[es]) || e, fr: title(p[fr]) || e };
};

async function load(rawDir, key) {
  const dir = join(rawDir, 'ne');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${FILES[key]}.geojson`);
  if (!existsSync(file)) {
    const res = await fetch(`${BASE}/${FILES[key]}.geojson`);
    if (!res.ok) throw new Error(`Natural Earth ${key}: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, 'utf8')).features;
}

// Polygons (with holes) and their bounding boxes, for fast point-in-polygon.
function shapes(features, nameOf, keep = () => true) {
  const out = [];
  for (const f of features) {
    if (!f.geometry || !keep(f.properties)) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    const name = nameOf(f.properties);
    for (const rings of polys) {
      let w = 180, s = 90, e = -180, n = -90;
      for (const [x, y] of rings[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
      out.push({ rings, bbox: [w, s, e, n], name, props: f.properties });
    }
  }
  return out;
}

export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export const inPolygon = (p, rings) => inRing(p, rings[0]) && !rings.slice(1).some((h) => inRing(p, h));

function finder(list) {
  return (p) => {
    for (const sh of list) {
      const [w, s, e, n] = sh.bbox;
      if (p[0] < w || p[0] > e || p[1] < s || p[1] > n) continue;
      if (inPolygon(p, sh.rings)) return sh;
    }
    return null;
  };
}

export async function gazetteer(rawDir) {
  const [countries, marine, regions, towns, lakes, states] = await Promise.all(Object.keys(FILES).map((k) => load(rawDir, k)));
  const stateAt = finder(shapes(states, (p) => names(p, 'name_en', 'name_es', 'name_fr')));
  const countryNames = (p) => ({ ...names(p, 'NAME_EN', 'NAME_ES', 'NAME_FR'), en: p.NAME_LONG || p.NAME });
  const countryAt = finder(shapes(countries, countryNames));
  const countryByName = new Map();
  for (const k of ['NAME', 'ADMIN', 'NAME_LONG', 'SOVEREIGNT']) { // exact names win over a territory's sovereign
    for (const f of countries) if (f.properties[k] && !countryByName.has(f.properties[k])) countryByName.set(f.properties[k], countryNames(f.properties));
  }
  // A sea that's part of a bigger one is named after the bigger one, in every language.
  const parentNames = new Map();
  for (const f of marine) {
    const parent = SEA_PARENT.get(f.properties.name);
    if (parent && (f.properties.name === parent || !parentNames.has(parent))) parentNames.set(parent, { ...names(f.properties, 'name_en', 'name_es', 'name_fr'), en: parent });
  }
  const seaShapes = shapes(marine, (p) => {
    const parent = SEA_PARENT.get(p.name);
    return parent ? parentNames.get(parent) : names(p, 'name_en', 'name_es', 'name_fr');
  });
  // Small seas first, so the Alboran Sea wins over the open Atlantic it borders.
  seaShapes.sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]));
  const seaAt = finder(seaShapes);
  const regionAt = finder(shapes(regions, (p) => ({ ...names(p, 'NAME_EN', 'NAME_ES', 'NAME_FR'), kind: p.FEATURECLA }), (p) => REGION_CLASSES.has(p.FEATURECLA)));
  const lakeAt = finder(shapes(lakes, (p) => {
    const n = names(p, 'name_en', 'name_es', 'name_fr');
    return { en: p.name, es: /lago|laguna/i.test(n.es) ? n.es : `lago ${n.es}`, fr: /lac\b/i.test(n.fr) ? n.fr : `lac ${n.fr}` };
  }));
  // Towns on a 1° grid for nearest-neighbour search.
  const grid = new Map();
  for (const f of towns) {
    const p = f.properties;
    if ((p.pop_max || 0) < MIN_TOWN_POP && p.scalerank > 6) continue;
    const [x, y] = f.geometry.coordinates;
    const k = `${Math.floor(x)},${Math.floor(y)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push({ x, y, name: p.name, country: p.adm0name });
  }
  const townNear = ([x, y], maxKm = TOWN_KM) => {
    let best = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const tw of grid.get(`${Math.floor(x) + dx},${Math.floor(y) + dy}`) || []) {
          const km = haversineKm([x, y], [tw.x, tw.y]);
          if (km <= maxKm && (!best || km < best.km)) best = { name: tw.name, km, country: tw.country };
        }
      }
    }
    return best;
  };

  // The barrier a point is in, if any: a sea or ocean, or a desert or mountain range.
  const BARRIER_KINDS = { Desert: 'desert', 'Range/mtn': 'mountains' };
  const barrierAt = (lon, lat) => {
    const p = [((((lon + 180) % 360) + 360) % 360) - 180, lat];
    const sea = seaAt(p);
    if (sea && !countryAt(p)) return { ...sea.name, kind: 'sea' };
    const region = regionAt(p);
    return region && BARRIER_KINDS[region.name.kind] ? { ...region.name, kind: BARRIER_KINDS[region.name.kind] } : null;
  };

  // Everything known about a point (lon is wrapped to −180…180).
  where.barrierAt = barrierAt;
  return where;
  function where(lon, lat) {
    const p = [((((lon + 180) % 360) + 360) % 360) - 180, lat];
    let country = countryAt(p)?.name || null;
    const state = country ? stateAt(p)?.name || null : null;
    const lake = country ? lakeAt(p)?.name || null : null;
    const region = country ? regionAt(p)?.name || null : null;
    let town = country ? townNear(p) : null;
    // Coastlines at this scale are coarse: a bird on a town's beach can land "at sea".
    if (!country && (town = townNear(p, 25))) country = countryByName.get(town.country) || (town.country ? { en: town.country, es: town.country, fr: town.country } : null);
    const sea = country || lake ? null : seaAt(p)?.name || null;
    // At sea, the coastal town it's off (if any is near), to tell one stretch of ocean from another.
    let off = null;
    if (sea && (off = townNear(p, OFFSHORE_KM))) off = { ...off, countryNames: countryByName.get(off.country) || null };
    return { country, state, sea, lake, region, town, off };
  }
}

// A compact, translatable label for a place: [kind, a, b] where a and b index
// into a names table of [en, es, fr]. Kinds: near (town, state or country),
// region (region, state or country), off (coastal town, country), lake,
// sea, country.
export function placeLabel(w, table) {
  const idx = (n) => {
    const key = typeof n === 'string' ? n : n.en;
    if (!table.index.has(key)) {
      table.index.set(key, table.list.length);
      table.list.push(typeof n === 'string' ? [n, n, n] : [n.en, n.es, n.fr]);
    }
    return table.index.get(key);
  };
  const area = w.state || w.country;
  if (w.lake) return ['lake', idx(w.lake)];
  if (w.town && area) return ['near', idx(w.town.name), idx(area)];
  if (w.region && area) return ['region', idx(w.region), idx(area)];
  if (w.state && w.country) return ['region', idx(w.state), idx(w.country)];
  if (w.country) return ['country', idx(w.country)];
  if (w.off && w.off.countryNames) return ['off', idx(w.off.name), idx(w.off.countryNames)];
  if (w.sea) return ['sea', idx(w.sea)];
  return null;
}

export const newNameTable = () => ({ index: new Map(), list: [] });
