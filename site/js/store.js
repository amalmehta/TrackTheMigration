// Shared state, a tiny event bus and formatting helpers used by every module.

import { seasonToHours, splitByYear, cumulativeKm } from './tracks.js';
import { settings } from './settings.js';
import { colorFor } from './palette.js';

export const state = {
  index: null,          // site/data/index.json
  assets: null,         // site/data/assets.json (icons + overlay legends)
  data: new Map(),      // species id → full data { animals, maxGapHours, facets, sites }
  overview: null,       // species id → light data for the All migrations view
  selected: 'all',
  mode: settings.mode,  // 'season' | 'dates'
  frac: 0.2,            // season mode: fraction of the year
  t: 0,                 // dates mode: hours since epoch
  range: [0, 1],        // dates mode: [start, end] hours
  playing: false,
  instances: [],        // what's animated right now
  highlight: null,      // Set of "species/animal" keys picked in a chart, or null
  follow: null,         // { species, animal } while following an animal
  story: null,          // { species, index } while a story is playing
  hidden: new Set(),    // "facet=value" groups switched off in the Who filter
  colorBy: null,        // facet key the selected species is coloured by, or null
  compare: [],          // [{ species, animal }] picked for a race (up to 4)
  race: null,           // { racers, day, maxDay, split } while racing
  only: null,           // "species/animal" key: show just this animal (the guessing game)
  tour: false,          // true during A year on Earth
};

export const MAX_RACERS = 4;

// ---------- who-is-this-animal filters ----------

export const isVisible = (animal) => {
  if (!state.hidden.size || !animal.attrs) return true;
  for (const [k, v] of Object.entries(animal.attrs)) if (state.hidden.has(`${k}=${v}`)) return false;
  return true;
};

export const facetsOf = (speciesId) => state.data.get(speciesId)?.facets || [];

// Shades of the species colour for the values of the colour-by facet:
// dark → light steps of one hue, grey for "unknown".
export function facetShades(speciesId, facetKey, mode) {
  const facet = facetsOf(speciesId).find((f) => f.key === facetKey);
  if (!facet) return new Map();
  const base = d3.hcl(colorFor(speciesId, mode));
  const known = facet.values.filter((v) => v.value !== 'unknown');
  const n = known.length;
  const out = new Map();
  known.forEach((v, i) => {
    const t = n === 1 ? 0 : i / (n - 1);                     // 0 … 1
    const c = d3.hcl(base.h, base.c * (1.05 - 0.25 * t), mode === 'dark' ? 45 + 45 * t : 30 + 40 * t);
    out.set(v.value, c.formatHex());
  });
  out.set('unknown', mode === 'dark' ? '#9ca3af' : '#6b7280');
  return out;
}

export function animalColor(speciesId, animal, mode) {
  if (state.colorBy && state.selected === speciesId && animal.attrs?.[state.colorBy]) {
    return facetShades(speciesId, state.colorBy, mode).get(animal.attrs[state.colorBy]) || colorFor(speciesId, mode);
  }
  return colorFor(speciesId, mode);
}

const handlers = new Map();
export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event).push(fn);
}
export function emit(event, data) {
  for (const fn of handlers.get(event) || []) fn(data);
}

// ---------- lookups ----------

export const speciesById = (id) => state.index.species.find((s) => s.id === id);
export const visibleSpecies = () => (state.selected === 'all' ? state.index.species : [speciesById(state.selected)]);
export const keyOf = (species, animal) => `${species}/${animal.id ?? animal}`;

// The light all-species file for the All migrations view (loaded once).
export async function loadOverview() {
  if (state.overview) return state.overview;
  const res = await fetch('data/overview.json');
  if (!res.ok) throw new Error("Couldn't load the overview");
  const json = await res.json();
  state.overview = new Map(Object.entries(json).map(([id, d]) => {
    for (const a of d.animals) {
      a.years = splitByYear(a.pts);
      a.cum = cumulativeKm(a.pts);
    }
    return [id, d];
  }));
  return state.overview;
}

// What the current view draws for a species: the overview in All migrations, else the full data.
export const viewData = (id) => (state.selected === 'all' ? state.overview?.get(id) : state.data.get(id));

// The full-resolution version of an animal (from an overview copy or an id).
export async function fullAnimal(species, animalOrId) {
  const d = await loadSpecies(species);
  const id = String(animalOrId?.id ?? animalOrId);
  return d.animals.find((a) => String(a.id) === id) || null;
}

export async function loadSpecies(id) {
  if (state.data.has(id)) return state.data.get(id);
  const res = await fetch(`data/${id}.json`);
  if (!res.ok) throw new Error(`Couldn't load ${id}`);
  const json = await res.json();
  for (const a of json.animals) {
    a.years = splitByYear(a.pts);
    a.cum = cumulativeKm(a.pts);
  }
  state.data.set(id, json);
  return json;
}

// Time for one animated instance: in Season view each animal-year runs on its own year.
export const instanceTime = (inst) => {
  if (state.race) return inst.start + state.race.day * 24; // every racer from its own start
  return state.mode === 'dates' ? state.t : seasonToHours(inst.year, state.frac);
};

// The calendar year the environment overlay shows in Season view.
export function referenceYear() {
  if (state.selected === 'all') return 2010;
  const s = speciesById(state.selected).stats;
  return Math.round((Number(s.start.slice(0, 4)) + Number(s.end.slice(0, 4))) / 2);
}
export const currentHours = () => {
  if (state.race) return state.race.racers[0].start + state.race.day * 24; // overlays follow the first racer
  return state.mode === 'dates' ? state.t : seasonToHours(referenceYear(), state.frac);
};

// ---------- formatting ----------

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "Mar–Apr" from days-per-month: the months at ≥ 60% of the peak, as ranges.
export function busiestMonths(months) {
  const peak = Math.max(...months);
  if (!peak) return '—';
  const on = months.map((m) => m >= 0.6 * peak);
  const ranges = [];
  for (let i = 0; i < 12; i++) {
    if (!on[i] || (i > 0 && on[i - 1])) continue;
    let j = i;
    while (j + 1 < 12 && on[j + 1]) j++;
    ranges.push([i, j]);
  }
  // A range running into December and one starting in January are one winter: "Oct–Mar".
  if (ranges.length > 1 && ranges[0][0] === 0 && ranges.at(-1)[1] === 11) {
    const first = ranges.shift();
    ranges[ranges.length - 1][1] = first[1];
  }
  return ranges.map(([a, b]) => (a === b ? MONTHS[a] : `${MONTHS[a]}–${MONTHS[b]}`)).join(', ');
}

export const fmtDate = (h) => {
  const d = new Date(h * 3.6e6);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const fmtSeason = (f) => {
  const d = new Date(seasonToHours(2001, f) * 3.6e6); // a non-leap year
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const fmtMonthYear = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
export const kmIn = (km) => (settings.units === 'mi' ? km * 0.621371 : km);
export const fmtDist = (km) => `${Math.round(kmIn(km)).toLocaleString()} ${settings.units}`;
export const fmtSpeed = (kmPerDay) => `${kmIn(kmPerDay) < 10 ? kmIn(kmPerDay).toFixed(1) : Math.round(kmIn(kmPerDay)).toLocaleString()} ${settings.units}/day`;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const year = (iso) => iso.slice(0, 4);

// A species silhouette as a coloured mask (inherits currentColor).
export function iconHtml(id, cls = 'sil') {
  return `<span class="${cls}" style="--icon:url('icons/${id}.svg')" aria-hidden="true"></span>`;
}

export const isPhone = () => window.innerWidth < 720;

// Reduced motion: the setting, or the system preference when set to "system".
export const reducedMotion = () => settings.motion === 'reduce' ||
  (settings.motion === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
// Camera move length, or 0 when motion is reduced.
export const dur = (ms) => (reducedMotion() ? 0 : ms);
