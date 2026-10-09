// Track the Migration — the globe, the species list and the playback loop.

import { positionAt, trailAt, splitByYear, seasonToHours } from './tracks.js';
import { colorFor } from './palette.js';
import {
  settings, onSettingsChange, updateSettings, applyTheme, isDark, bindSettingsDialog,
} from './settings.js';

const REPO = 'amalmehta/TrackTheMigration';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SATELLITE = {
  tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'],
  attribution:
    '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)',
};
const STREET = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const DEM = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 14,
  attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a>',
};

const $ = (s) => document.querySelector(s);
const state = {
  index: null,
  data: new Map(),      // species id → { animals, maxGapHours }
  selected: 'all',
  mode: settings.mode,  // 'season' | 'dates'
  frac: 0.2,            // season mode: fraction of the year
  t: 0,                 // dates mode: hours since epoch
  range: [0, 1],        // dates mode: [start, end] hours
  playing: false,
  picked: null,         // { species, animal }
  instances: [],        // what's animated right now
};

// ---------- helpers ----------

const fmtDate = (h) => {
  const d = new Date(h * 3.6e6);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const fmtSeason = (f) => {
  const d = new Date(seasonToHours(2001, f) * 3.6e6); // a non-leap year
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const fmtDist = (km) => {
  const v = settings.units === 'mi' ? km * 0.621371 : km;
  return `${Math.round(v).toLocaleString()} ${settings.units}`;
};
const year = (iso) => iso.slice(0, 4);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const speciesById = (id) => state.index.species.find((s) => s.id === id);
const visibleSpecies = () => (state.selected === 'all' ? state.index.species : [speciesById(state.selected)]);

// Track colours follow the map underneath: bright shades on imagery or dark maps.
const colorMode = () => (settings.basemap === 'satellite' || isDark() ? 'dark' : 'light');

// ---------- data ----------

async function loadSpecies(id) {
  if (state.data.has(id)) return state.data.get(id);
  const res = await fetch(`data/${id}.json`);
  if (!res.ok) throw new Error(`Couldn't load ${id}`);
  const json = await res.json();
  for (const a of json.animals) a.years = splitByYear(a.pts);
  state.data.set(id, json);
  return json;
}

function buildInstances() {
  state.instances = [];
  for (const sp of visibleSpecies()) {
    const d = state.data.get(sp.id);
    if (!d) continue;
    for (const a of d.animals) {
      if (state.mode === 'dates') {
        state.instances.push({ species: sp.id, animal: a, pts: a.pts, gap: d.maxGapHours });
      } else {
        for (const seg of a.years) {
          state.instances.push({ species: sp.id, animal: a, pts: seg.pts, year: seg.year, gap: d.maxGapHours });
        }
      }
    }
  }
  const sps = visibleSpecies();
  const starts = sps.map((s) => Date.parse(s.stats.start) / 3.6e6);
  const ends = sps.map((s) => Date.parse(s.stats.end) / 3.6e6);
  state.range = [Math.min(...starts), Math.max(...ends)];
  if (state.t < state.range[0] || state.t > state.range[1]) state.t = state.range[0];
}

// ---------- map ----------

// Start empty and load the real base map through switchBasemap(), so the globe
// projection is part of the style before terrain is switched on (setting both
// after a style URL loads trips a MapLibre shader error).
const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [] },
  center: [25, 12],
  zoom: window.innerWidth < 720 ? 0.9 : 1.6,
  attributionControl: { compact: true },
  maxPitch: 75,
});
// Keep the attribution folded on small screens (MapLibre opens it on every style load).
map.on('styledata', () => {
  if (window.innerWidth < 720) {
    setTimeout(() => document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'), 0);
  }
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: settings.units === 'mi' ? 'imperial' : 'metric' }), 'bottom-right');

function baseStyle() {
  if (settings.basemap === 'satellite') {
    return {
      version: 8,
      projection: { type: 'globe' },
      sources: { s2: { type: 'raster', tileSize: 256, maxzoom: 15, ...SATELLITE } },
      layers: [
        { id: 'space', type: 'background', paint: { 'background-color': '#05070a' } },
        { id: 's2', type: 'raster', source: 's2' },
      ],
    };
  }
  return isDark() ? STREET.dark : STREET.light;
}

// Swap the base map. Terrain must be off while the style is replaced
// (MapLibre can't carry a terrain mesh across styles); style.load restores it.
function switchBasemap() {
  if (map.isStyleLoaded() && map.getTerrain()) map.setTerrain(null);
  map.setStyle(baseStyle(), {
    diff: false,
    transformStyle: (_prev, next) => ({ ...next, projection: { type: 'globe' } }),
  });
}

function installLayers() {
  if (map.getProjection()?.type !== 'globe') map.setProjection({ type: 'globe' });
  map.setSky({
    'sky-color': '#0b1d33',
    'horizon-color': '#6b8fb8',
    'fog-color': '#cfe0f2',
    'sky-horizon-blend': 0.5,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
  });
  if (!map.getSource('dem')) map.addSource('dem', DEM);
  applyTerrain();

  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource('routes', { type: 'geojson', data: empty });
  map.addSource('trails', { type: 'geojson', data: empty });
  map.addSource('heads', { type: 'geojson', data: empty });

  map.addLayer({
    id: 'routes', type: 'line', source: 'routes',
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: settings.showRoutes ? 'visible' : 'none' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.3, 'line-opacity': 0.4 },
  });
  map.addLayer({
    id: 'route-picked', type: 'line', source: 'routes',
    filter: ['==', ['get', 'key'], ''],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.95 },
  });
  map.addLayer({
    id: 'trails', type: 'line', source: 'trails',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2.4, 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: 'heads', type: 'circle', source: 'heads',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3.5, 6, 6],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.2,
      'circle-pitch-alignment': 'map',
    },
  });
  refreshRoutes();
  renderFrame();
}

function applyTerrain() {
  if (!map.getSource('dem')) return;
  map.setTerrain(settings.terrain ? { source: 'dem', exaggeration: settings.exaggeration } : null);
}

map.on('style.load', () => {
  if (map.getStyle().layers.length) installLayers();
});
switchBasemap();

function refreshRoutes() {
  const src = map.getSource('routes');
  if (!src || !state.index) return;
  const mode = colorMode();
  const features = [];
  for (const sp of visibleSpecies()) {
    const d = state.data.get(sp.id);
    if (!d) continue;
    const color = colorFor(sp.id, mode);
    for (const a of d.animals) {
      features.push({
        type: 'Feature',
        properties: { color, species: sp.id, animal: a.id, key: `${sp.id}/${a.id}` },
        geometry: { type: 'LineString', coordinates: a.pts.map((p) => [p[0], p[1]]) },
      });
    }
  }
  src.setData({ type: 'FeatureCollection', features });
  map.setFilter('route-picked', ['==', ['get', 'key'], state.picked ? `${state.picked.species}/${state.picked.animal.id}` : '']);
}

// ---------- the frame ----------

function renderFrame() {
  const heads = map.getSource('heads');
  const trails = map.getSource('trails');
  if (!heads || !trails) return;
  const mode = colorMode();
  const trailHours = settings.trailDays * 24;
  const headF = [];
  const trailF = [];
  let moving = 0;
  const speciesMoving = new Set();
  for (const inst of state.instances) {
    const t = state.mode === 'dates' ? state.t : seasonToHours(inst.year, state.frac);
    const head = positionAt(inst.pts, t, inst.gap);
    if (!head) continue;
    moving++;
    speciesMoving.add(inst.species);
    const color = colorFor(inst.species, mode);
    const props = { color, species: inst.species, animal: inst.animal.id, year: inst.year ?? '' };
    headF.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: head } });
    const trail = trailAt(inst.pts, t, trailHours, inst.gap);
    if (trail && trail.length > 1) {
      trailF.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: trail } });
    }
  }
  heads.setData({ type: 'FeatureCollection', features: headF });
  trails.setData({ type: 'FeatureCollection', features: trailF });

  // Labels and slider
  if (state.mode === 'season') {
    $('#time-label').textContent = fmtSeason(state.frac);
    $('#time-slider').value = Math.round(state.frac * 1000);
  } else {
    $('#time-label').textContent = fmtDate(state.t);
    const [a, b] = state.range;
    $('#time-slider').value = Math.round(((state.t - a) / (b - a || 1)) * 1000);
  }
  const what = state.mode === 'season' ? 'animal-years' : 'animals';
  $('#time-active').textContent =
    `${moving} ${moving === 1 ? what.replace(/s$/, '') : what} tracked` +
    (state.selected === 'all' ? ` · ${speciesMoving.size} species` : '');
}

let last = 0;
function tick(now) {
  if (!state.playing) return;
  const dt = Math.min(0.1, (now - (last || now)) / 1000);
  last = now;
  const days = Number($('#speed-select').value) * dt;
  if (state.mode === 'season') {
    state.frac = (state.frac + days / 365.2425) % 1;
  } else {
    state.t += days * 24;
    if (state.t > state.range[1]) state.t = state.range[0];
  }
  renderFrame();
  requestAnimationFrame(tick);
}

function setPlaying(on) {
  state.playing = on;
  $('#play-btn').classList.toggle('playing', on);
  $('#play-btn').setAttribute('aria-label', on ? 'Pause' : 'Play');
  if (on) { last = 0; requestAnimationFrame(tick); }
}

// ---------- UI ----------

function renderSpeciesList() {
  const list = $('#species-list');
  list.innerHTML = '';
  const mode = colorMode(); // swatches are the map legend, so match the map
  for (const [group, label] of Object.entries(state.index.groups)) {
    const members = state.index.species.filter((s) => s.group === group);
    const title = document.createElement('div');
    title.className = 'group-title';
    title.innerHTML = `<i style="background:linear-gradient(90deg,${members.map((m) => colorFor(m.id, mode)).join(',')})"></i>${esc(label)}`;
    list.append(title);
    for (const sp of members) {
      const b = document.createElement('button');
      b.className = 'species-row';
      b.dataset.id = sp.id;
      b.setAttribute('aria-pressed', String(state.selected === sp.id));
      b.style.setProperty('--sw', colorFor(sp.id, mode));
      b.innerHTML = `<span class="swatch" aria-hidden="true"></span>
        <span class="row-text"><strong>${esc(sp.name)}</strong><small>${esc(sp.region)}</small></span>`;
      b.addEventListener('click', () => select(sp.id));
      list.append(b);
    }
  }
  const all = $('#all-btn');
  all.setAttribute('aria-pressed', String(state.selected === 'all'));
  const firsts = Object.keys(state.index.groups).map((g) => state.index.species.find((s) => s.group === g));
  firsts.forEach((s, i) => all.style.setProperty(`--c${i + 1}`, colorFor(s.id, mode)));
}

function renderInfo() {
  const info = $('#info');
  info.hidden = false;
  if (state.selected === 'all') {
    const sp = state.index.species;
    const animals = sp.reduce((n, s) => n + s.stats.animalsShown, 0);
    info.innerHTML = `
      <h2>${sp.length} migrations, ${animals} animals</h2>
      <p class="muted" style="margin-top:4px">Each dot is one tagged animal; the tail behind it is where it went over the last ${settings.trailDays} days.
      In <b>Season</b> view every year an animal was tracked is laid over one calendar year, so you can see who moves when.
      Pick a species to fly there, or click a track for that animal.</p>
      <p class="source">All tracks are real GPS, Argos satellite or geolocator fixes from published, openly licensed data packages in the
      <a href="https://datarepository.movebank.org" target="_blank" rel="noopener">Movebank Data Repository</a>. Pick a species for its citation.</p>`;
    return;
  }
  const s = speciesById(state.selected);
  const st = s.stats;
  const src = s.source;
  const span = year(st.start) === year(st.end) ? year(st.start) : `${year(st.start)}–${year(st.end)}`;
  const thin = s.processing.thinHours ? `one position per ${s.processing.thinHours} h at most, ` : '';
  info.innerHTML = `
    <h2>${esc(s.name)}</h2>
    <p class="sci">${esc(s.scientific)} · ${esc(s.region)}</p>
    <p>${esc(s.blurb)}</p>
    <div class="stats">
      <div class="stat"><b>${st.animalsShown}${st.animalsShown < st.animalsInStudy ? ` <small class="muted">of ${st.animalsInStudy}</small>` : ''}</b><span>animals shown</span></div>
      <div class="stat"><b>${span}</b><span>tracked</span></div>
      <div class="stat"><b>${fmtDist(st.medianKm)}</b><span>typical distance per animal</span></div>
      <div class="stat"><b>${fmtDist(st.longestKm)}</b><span>longest track</span></div>
    </div>
    <div id="animal-pick"></div>
    <p class="source">
      <b>Data:</b> ${esc(src.dataCitation)}
      ${src.doiUrl ? `<br><a href="${esc(src.doiUrl)}" target="_blank" rel="noopener">${esc(src.doi)}</a>` : ''}
      <br><span class="license">${src.licenseUrl ? `<a href="${esc(src.licenseUrl)}" target="_blank" rel="noopener">${esc(src.license)}</a>` : esc(src.license)}</span>
      ${src.paperCitation ? `<br><br><b>Study:</b> ${esc(src.paperCitation)}` : ''}
      <br><br><span class="muted">Shown: the ${st.animalsShown} longest-tracked animals; ${thin}implausibly fast jumps removed; straight lines between fixes.</span>
    </p>`;
  renderPick();
}

function renderPick() {
  const el = document.getElementById('animal-pick');
  if (!el) return;
  const p = state.picked;
  if (!p || p.species !== state.selected) { el.innerHTML = ''; return; }
  const a = p.animal;
  el.innerHTML = `<div class="animal-pick"><b>Animal ${esc(a.id)}</b> — ${fmtDist(a.km)} over ${a.days.toLocaleString()} days
    (${fmtDate(a.pts[0][2])} to ${fmtDate(a.pts[a.pts.length - 1][2])}).
    <a href="#" id="unpick">Clear</a></div>`;
  el.querySelector('#unpick').addEventListener('click', (e) => { e.preventDefault(); pick(null); });
}

function pick(p) {
  state.picked = p;
  if (map.getLayer('route-picked')) {
    map.setFilter('route-picked', ['==', ['get', 'key'], p ? `${p.species}/${p.animal.id}` : '']);
  }
  renderPick();
}

function fitTo(species) {
  // Keep the animals in the clear part of the screen (not under the panel or
  // time bar). `padding` on easeTo replaces the map's padding each time, so it
  // never stacks; cameraForBounds ignores map padding, so it only gives zoom.
  const phone = window.innerWidth < 720;
  const pad = phone
    ? { top: 150, bottom: Math.round(window.innerHeight * 0.46) + 10, left: 16, right: 16 }
    : { top: 50, bottom: 120, left: 370, right: 60 };
  if (!species) {
    map.easeTo({ center: [20, 15], zoom: phone ? 0.5 : 1.5, pitch: 0, bearing: 0, padding: pad, duration: 2000 });
    return;
  }
  let [w, s, e, n] = species.stats.bbox;
  if (e - w > 300) { w = -180; e = 180; }
  let cam = null;
  try {
    cam = map.cameraForBounds([[w, s], [e, n]], { padding: pad, maxZoom: 8 });
  } catch {
    // MapLibre throws when the padded area is too small for the bounds (phones).
  }
  const huge = e - w > 60 || n - s > 45; // ocean-basin scale: show the whole globe
  const pitch = huge ? 0 : species.group === 'land' ? 55 : 20;
  let zoom = cam ? cam.zoom : 2;
  if (huge) zoom = Math.min(zoom, phone ? 0.6 : 1.7);
  map.easeTo({
    center: [(w + e) / 2, (s + n) / 2], zoom: Math.max(0.5, zoom),
    pitch, bearing: 0, padding: pad, duration: 2200,
  });
}

async function select(id) {
  state.selected = id;
  state.picked = null;
  renderSpeciesList();
  $('#loading').hidden = false;
  try {
    const ids = id === 'all' ? state.index.species.map((s) => s.id) : [id];
    await Promise.all(ids.map(loadSpecies));
  } catch (err) {
    $('#loading').textContent = `Couldn't load tracks: ${err.message}`;
    return;
  }
  $('#loading').hidden = true;
  buildInstances();
  refreshRoutes();
  renderInfo();
  $('.panel-body').scrollTo({ top: 0, behavior: 'smooth' });
  renderFrame();
  fitTo(id === 'all' ? null : speciesById(id));
}

function setMode(mode) {
  state.mode = mode;
  $('#mode-season').setAttribute('aria-checked', String(mode === 'season'));
  $('#mode-dates').setAttribute('aria-checked', String(mode === 'dates'));
  renderTicks();
  buildInstances();
  renderFrame();
}

function renderTicks() {
  const ticks = $('#month-ticks');
  ticks.innerHTML = '';
  if (state.mode === 'season') {
    MONTHS.forEach((m, i) => {
      const s = document.createElement('span');
      s.style.left = `${((i + 0.5) / 12) * 100}%`;
      s.textContent = m;
      ticks.append(s);
    });
  }
}

function wireControls() {
  $('#play-btn').addEventListener('click', () => setPlaying(!state.playing));
  $('#time-slider').addEventListener('input', (e) => {
    const v = Number(e.target.value) / 1000;
    if (state.mode === 'season') state.frac = Math.min(v, 0.9999);
    else state.t = state.range[0] + v * (state.range[1] - state.range[0]);
    renderFrame();
  });
  $('#mode-season').addEventListener('click', () => setMode('season'));
  $('#mode-dates').addEventListener('click', () => setMode('dates'));
  $('#speed-select').value = String(settings.speed);
  $('#all-btn').addEventListener('click', () => select('all'));

  const panel = $('#panel');
  $('#collapse-btn').addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    $('#collapse-btn').setAttribute('aria-expanded', String(!collapsed));
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog')) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
  });

  // Pick an animal by clicking its dot or route.
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
  for (const layer of ['heads', 'routes']) {
    map.on('click', layer, (e) => {
      const f = e.features[0];
      const d = state.data.get(f.properties.species);
      const animal = d?.animals.find((a) => String(a.id) === String(f.properties.animal));
      if (!animal) return;
      if (state.selected !== 'all' && state.selected !== f.properties.species) return;
      if (state.selected === 'all') {
        select(f.properties.species).then(() => pick({ species: f.properties.species, animal }));
      } else pick({ species: f.properties.species, animal });
    });
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; popup.remove(); });
  }
  map.on('mousemove', 'heads', (e) => {
    const p = e.features[0].properties;
    const sp = speciesById(p.species);
    popup.setLngLat(e.lngLat)
      .setHTML(`<b>${esc(sp.name)}</b> · ${esc(p.animal)}${p.year ? ` <span class="muted">(${p.year})</span>` : ''}`)
      .addTo(map);
  });

  // Feedback
  const fb = $('#feedback-dialog');
  $('#feedback-tab').addEventListener('click', () => fb.showModal());
  $('#feedback-form').addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'send') return;
    const text = $('#fb-text').value.trim();
    if (!text) return;
    const view = state.selected === 'all' ? 'All migrations' : speciesById(state.selected).name;
    const body = `${text}\n\n---\nView: ${view} · ${state.mode} mode`;
    const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent('Feedback: ' + text.slice(0, 60))}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
    $('#fb-text').value = '';
  });
}

onSettingsChange((changed) => {
  if (changed.includes('theme')) {
    applyTheme();
    renderSpeciesList();
  }
  if (changed.includes('basemap') || (changed.includes('theme') && settings.basemap === 'theme')) {
    renderSpeciesList();
    switchBasemap();
    return; // style.load re-installs everything
  }
  if (changed.includes('terrain') || changed.includes('exaggeration')) applyTerrain();
  if (changed.includes('showRoutes') && map.getLayer('routes')) {
    map.setLayoutProperty('routes', 'visibility', settings.showRoutes ? 'visible' : 'none');
  }
  if (changed.includes('theme')) refreshRoutes();
  if (changed.includes('speed')) $('#speed-select').value = String(settings.speed);
  if (changed.includes('units') || changed.includes('trailDays')) renderInfo();
  if (changed.includes('mode')) setMode(settings.mode);
  renderFrame();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (settings.theme !== 'system') return;
  renderSpeciesList();
  if (settings.basemap === 'theme') switchBasemap();
  else { refreshRoutes(); renderFrame(); }
});

// ---------- start ----------

async function main() {
  applyTheme();
  bindSettingsDialog($('#settings-dialog'), $('#settings-btn'));
  const res = await fetch('data/index.json');
  state.index = await res.json();
  wireControls();
  setMode(settings.mode);
  renderSpeciesList();
  await select('all');
  if (settings.autoplay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true);
}

main().catch((err) => {
  console.error(err);
  $('#loading').hidden = false;
  $('#loading').textContent = `Something went wrong: ${err.message}`;
});

// For debugging in the console.
window.ttm = { state, map, updateSettings };
