// Shared state, a tiny event bus and formatting helpers used by every module.

import { seasonToHours, splitByYear, cumulativeKm } from './tracks.js';
import { settings } from './settings.js';

export const state = {
  index: null,          // site/data/index.json
  assets: null,         // site/data/assets.json (icons + overlay legends)
  data: new Map(),      // species id → { animals, maxGapHours }
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
};

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
export const instanceTime = (inst) => (state.mode === 'dates' ? state.t : seasonToHours(inst.year, state.frac));

// The calendar year the environment overlay shows in Season view.
export function referenceYear() {
  if (state.selected === 'all') return 2010;
  const s = speciesById(state.selected).stats;
  return Math.round((Number(s.start.slice(0, 4)) + Number(s.end.slice(0, 4))) / 2);
}
export const currentHours = () => (state.mode === 'dates' ? state.t : seasonToHours(referenceYear(), state.frac));

// ---------- formatting ----------

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
