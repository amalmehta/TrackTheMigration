// The globe: base map, terrain, night shading, NASA overlays, the animated
// tracks and the camera. Everything drawn on the map lives here.

import { positionAt, trailAt } from './tracks.js';
import { SPECIES_COLORS, colorFor } from './palette.js';
import { settings, isDark } from './settings.js';
import { subsolarPoint, paintNight } from './solar.js';
import { ENV_LAYERS, overlayDate, tileUrl } from './environment.js';
import {
  state, emit, visibleSpecies, keyOf, instanceTime, currentHours, isPhone, isVisible, animalColor, viewData,
  reducedMotion, dur,
} from './store.js';

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
const GIBS_ATTR = 'Overlays: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a>';
const SPECIES = Object.keys(SPECIES_COLORS);
const EMPTY = { type: 'FeatureCollection', features: [] };

// Track colours follow the map underneath: bright shades on imagery or dark maps.
export const colorMode = () => (settings.basemap === 'satellite' || isDark() ? 'dark' : 'light');

// ---------- map ----------

// Start empty and load the real base map through switchBasemap(), so the globe
// projection is part of the style before terrain is switched on (setting both
// after a style URL loads trips a MapLibre shader error).
export const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [] },
  center: [25, 12],
  zoom: isPhone() ? 0.9 : 1.6,
  attributionControl: { compact: true },
  maxPitch: 78,
  fadeDuration: 200,
  // Keep the last frame readable so "Record video" can copy it.
  canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
});
map.on('styledata', () => {
  if (isPhone()) {
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
        { id: 'ocean', type: 'background', paint: { 'background-color': '#061224' } },
        { id: 's2', type: 'raster', source: 's2', paint: { 'raster-saturation': 0.05, 'raster-contrast': 0.08 } },
      ],
    };
  }
  return isDark() ? STREET.dark : STREET.light;
}

// Swap the base map. Terrain must be off while the style is replaced
// (MapLibre can't carry a terrain mesh across styles); style.load restores it.
export function switchBasemap() {
  if (map.isStyleLoaded() && map.getTerrain()) map.setTerrain(null);
  map.setStyle(baseStyle(), {
    diff: false,
    transformStyle: (_prev, next) => ({ ...next, projection: { type: 'globe' } }),
  });
}

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
const trailGradient = (hex, peak) => [
  'interpolate', ['linear'], ['line-progress'],
  0, rgba(hex, 0), 0.55, rgba(hex, peak * 0.45), 1, rgba(hex, peak),
];

function installLayers() {
  if (map.getProjection()?.type !== 'globe') map.setProjection({ type: 'globe' });
  map.setSky({
    'sky-color': '#071426',
    'horizon-color': '#4d7bb5',
    'fog-color': '#a9c8ec',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.85,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
  });
  if (!map.getSource('dem')) map.addSource('dem', DEM);
  applyTerrain();

  // Night shading: a Web-Mercator canvas repainted as the season and view change.
  map.addSource('night', {
    type: 'canvas', canvas: nightCanvas, animate: true,
    coordinates: [[-180, 85.0511], [180, 85.0511], [180, -85.0511], [-180, -85.0511]],
  });
  map.addLayer({
    id: 'night', type: 'raster', source: 'night',
    layout: { visibility: settings.nightShade ? 'visible' : 'none' },
    paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 2, 1, 4.5, 0.55, 6.5, 0], 'raster-fade-duration': 0 },
  });

  for (const id of ['routes', 'sites', 'trails', 'heads', 'focus', 'guess']) map.addSource(id, { type: 'geojson', data: EMPTY, lineMetrics: id === 'trails' });

  map.addLayer({
    id: 'routes', type: 'line', source: 'routes',
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: settings.showRoutes ? 'visible' : 'none' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 6, 1.4],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, ['case', ['get', 'dim'], 0.06, 0.24], 9, ['case', ['get', 'dim'], 0.04, 0.14]],
    },
  });
  map.addLayer({
    id: 'route-focus', type: 'line', source: 'routes',
    filter: ['==', ['get', 'key'], ''],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2.6, 'line-opacity': 0.9 },
  });
  // Stopover sites: rings sized by total animal-days, brighter when in use at this time of year.
  const vis = settings.showStops ? 'visible' : 'none';
  map.addLayer({
    id: 'site-glow', type: 'circle', source: 'sites', layout: { visibility: settings.effects ? vis : 'none' },
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['*', ['get', 'r'], 1.2], 7, ['*', ['get', 'r'], 2.6]],
      'circle-blur': 1,
      'circle-opacity': ['*', ['get', 'now'], 0.55],
      'circle-pitch-alignment': 'map',
    },
  });
  map.addLayer({
    id: 'sites', type: 'circle', source: 'sites', layout: { visibility: vis },
    paint: {
      'circle-color': ['get', 'color'],
      'circle-opacity': ['+', 0.06, ['*', ['get', 'now'], 0.22]],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['*', ['get', 'r'], 0.7], 7, ['*', ['get', 'r'], 1.6]],
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1.4,
      'circle-stroke-opacity': ['+', 0.35, ['*', ['get', 'now'], 0.65]],
      'circle-pitch-alignment': 'map',
    },
  });
  for (const sp of SPECIES) {
    map.addLayer({
      id: `glow-${sp}`, type: 'line', source: 'trails', filter: ['all', ['==', ['get', 'species'], sp], ['!', ['get', 'cb']]],
      layout: { 'line-join': 'round', 'line-cap': 'round', visibility: settings.effects ? 'visible' : 'none' },
      paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 9, 6, 7, 10, 5], 'line-blur': ['interpolate', ['linear'], ['zoom'], 1, 7, 10, 4], 'line-gradient': trailGradient(colorFor(sp, colorMode()), 0.5), 'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, ['case', ['get', 'dim'], 0, 1], 9, ['case', ['get', 'dim'], 0, 0.55]] },
    });
  }
  for (const sp of SPECIES) {
    map.addLayer({
      id: `trail-${sp}`, type: 'line', source: 'trails', filter: ['all', ['==', ['get', 'species'], sp], ['!', ['get', 'cb']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-width': 2.2, 'line-gradient': trailGradient(colorFor(sp, colorMode()), 1), 'line-opacity': ['case', ['get', 'dim'], 0.3, 1] },
    });
  }
  // Trails coloured by a "who" facet: one colour per feature, so no gradient.
  map.addLayer({
    id: 'trail-cb', type: 'line', source: 'trails', filter: ['==', ['get', 'cb'], true],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2.2, 'line-opacity': ['case', ['get', 'dim'], 0.25, 0.85] },
  });
  map.addLayer({
    id: 'halo', type: 'circle', source: 'heads',
    layout: { visibility: settings.effects ? 'visible' : 'none' },
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 6, 13],
      'circle-blur': 1,
      'circle-opacity': ['case', ['get', 'dim'], 0, 0.45],
      'circle-pitch-alignment': 'map',
    },
  });
  map.addLayer({
    id: 'heads', type: 'circle', source: 'heads',
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 6, 5.5],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 6, 1.4],
      'circle-opacity': ['case', ['get', 'dim'], 0.35, 1],
      'circle-stroke-opacity': ['case', ['get', 'dim'], 0.3, 1],
      'circle-pitch-alignment': 'map',
    },
  });
  map.addLayer({
    id: 'focus-ring', type: 'circle', source: 'focus',
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': 14,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-stroke-opacity': 0.9,
      'circle-pitch-alignment': 'map',
    },
  });
  // The guessing game: your guess, the real spot, and the miss between them.
  map.addLayer({
    id: 'guess-line', type: 'line', source: 'guess', filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: 'guess-pts', type: 'circle', source: 'guess', filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 8,
      'circle-color': ['match', ['get', 'kind'], 'guess', '#ffffff', ['get', 'color']],
      'circle-stroke-color': ['match', ['get', 'kind'], 'guess', '#0b1220', '#ffffff'],
      'circle-stroke-width': 3,
      'circle-pitch-alignment': 'map',
    },
  });
  overlayKey = null;
  applyOverlay();
  nightStamp = '';
  refreshRoutes();
  refreshSites();
  renderFrame();
  emit('style-ready');
}

export function applyTerrain() {
  if (!map.getSource('dem')) return;
  map.setTerrain(settings.terrain ? { source: 'dem', exaggeration: settings.exaggeration } : null);
}

map.on('style.load', () => {
  if (map.getStyle().layers.length) installLayers();
});
switchBasemap();

// Re-colour everything after a theme or base map change.
export function recolor() {
  if (!map.getLayer('heads')) return;
  for (const sp of SPECIES) {
    const c = colorFor(sp, colorMode());
    map.setPaintProperty(`glow-${sp}`, 'line-gradient', trailGradient(c, 0.5));
    map.setPaintProperty(`trail-${sp}`, 'line-gradient', trailGradient(c, 1));
  }
  refreshRoutes();
  refreshSites();
  renderFrame();
}

export function setEffects() {
  if (!map.getLayer('halo')) return;
  const v = settings.effects ? 'visible' : 'none';
  map.setLayoutProperty('halo', 'visibility', v);
  map.setLayoutProperty('site-glow', 'visibility', settings.effects && settings.showStops ? 'visible' : 'none');
  for (const sp of SPECIES) map.setLayoutProperty(`glow-${sp}`, 'visibility', v);
  document.body.classList.toggle('no-effects', !settings.effects);
}

export function setStopsVisible() {
  if (!map.getLayer('sites')) return;
  map.setLayoutProperty('sites', 'visibility', settings.showStops ? 'visible' : 'none');
  map.setLayoutProperty('site-glow', 'visibility', settings.showStops && settings.effects ? 'visible' : 'none');
}

export function setRoutesVisible() {
  if (map.getLayer('routes')) map.setLayoutProperty('routes', 'visibility', settings.showRoutes ? 'visible' : 'none');
}

// ---------- routes and the animated frame ----------

// Chart selections dim everything else; so does following one animal.
const isDim = (key) => {
  if (state.highlight) return !state.highlight.has(key);
  if (state.follow) return key !== keyOf(state.follow.species, state.follow.animal);
  return false;
};

export function refreshRoutes() {
  const src = map.getSource('routes');
  if (!src || !state.index) return;
  const mode = colorMode();
  const features = [];
  if (state.race) {
    for (const r of state.race.racers) {
      features.push({
        type: 'Feature',
        properties: { color: r.color, species: r.species, animal: r.animal.id, key: keyOf(r.species, r.animal), dim: false },
        geometry: { type: 'LineString', coordinates: r.animal.pts.map((p) => [p[0], p[1]]) },
      });
    }
    src.setData({ type: 'FeatureCollection', features });
    return;
  }
  for (const sp of visibleSpecies()) {
    const d = viewData(sp.id);
    if (!d) continue;
    for (const a of d.animals) {
      if (!isVisible(a)) continue;
      if (state.only) continue; // the guessing game: a full route would give the answer away
      const key = keyOf(sp.id, a);
      features.push({
        type: 'Feature',
        properties: { color: animalColor(sp.id, a, mode), species: sp.id, animal: a.id, key, dim: isDim(key) },
        geometry: { type: 'LineString', coordinates: a.pts.map((p) => [p[0], p[1]]) },
      });
    }
  }
  src.setData({ type: 'FeatureCollection', features });
  map.setFilter('route-focus', ['==', ['get', 'key'], state.follow ? keyOf(state.follow.species, state.follow.animal) : '']);
}

export function renderFrame() {
  const heads = map.getSource('heads');
  if (!heads || !state.index) return { moving: 0, species: 0 };
  const mode = colorMode();
  const trailHours = settings.trailDays * 24;
  const headF = [];
  const trailF = [];
  const speciesMoving = new Set();
  // The ring marks the followed animal, or the one picked with the keyboard (n / p).
  const focusKey = state.follow ? keyOf(state.follow.species, state.follow.animal)
    : state.kbdFocus ? keyOf(state.kbdFocus.species, state.kbdFocus.animal) : null;
  let focus = null;
  for (const inst of state.instances) {
    const t = instanceTime(inst);
    const head = positionAt(inst.pts, t, inst.gap);
    if (!head) continue;
    speciesMoving.add(inst.species);
    const key = keyOf(inst.species, inst.animal);
    const cb = !!inst.color || (!!state.colorBy && state.selected === inst.species);
    const props = { color: inst.color || animalColor(inst.species, inst.animal, mode), cb, species: inst.species, animal: inst.animal.id, key, year: inst.year ?? '', dim: isDim(key) };
    headF.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: head } });
    if (key === focusKey) focus = head;
    const trail = trailAt(inst.pts, t, trailHours, inst.gap);
    if (trail && trail.length > 1) {
      trailF.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: trail } });
    }
  }
  heads.setData({ type: 'FeatureCollection', features: headF });
  map.getSource('trails').setData({ type: 'FeatureCollection', features: trailF });
  map.getSource('focus').setData(focus ? { type: 'Point', coordinates: focus } : EMPTY);
  updateNight();
  updateOverlayDate();
  const month = new Date(currentHours() * 3.6e6).getUTCMonth();
  if (month !== siteMonth && !state.race) refreshSites(month);
  return { moving: headF.length, species: speciesMoving.size, focus };
}

// ---------- stopover sites ----------

let siteMonth = -1;

// Sites from the visible species, hiding any used only by filtered-out animals.
export function refreshSites(month = new Date(currentHours() * 3.6e6).getUTCMonth()) {
  const src = map.getSource('sites');
  if (!src || !state.index) return;
  if (state.race || state.only) { src.setData(EMPTY); return; }
  siteMonth = month;
  const mode = colorMode();
  const features = [];
  for (const sp of visibleSpecies()) {
    const d = viewData(sp.id);
    if (!d?.sites?.length) continue;
    const ids = new Set(d.animals.filter(isVisible).map((a) => String(a.id)));
    const maxDays = d.sites[0].days || 1;
    d.sites.forEach((site, idx) => {
      if (!site.animals.some((id) => ids.has(String(id)))) return;
      const peak = Math.max(...site.months) || 1;
      features.push({
        type: 'Feature',
        properties: {
          species: sp.id, idx, color: colorFor(sp.id, mode),
          r: (state.selected === 'all' ? 2.5 : 4) + (state.selected === 'all' ? 6 : 12) * Math.sqrt(site.days / maxDays),
          now: site.months[month] / peak,
        },
        geometry: { type: 'Point', coordinates: [site.lon, site.lat] },
      });
    });
  }
  src.setData({ type: 'FeatureCollection', features });
}

// Gentle pulse on the heads' halos.
export function pulse(now) {
  if (!settings.effects || reducedMotion() || !map.getLayer('halo')) return;
  const k = 1 + 0.28 * Math.sin(now / 420);
  map.setPaintProperty('halo', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 1, 7 * k, 6, 13 * k]);
}

// ---------- night shading ----------

const nightCanvas = document.createElement('canvas');
nightCanvas.width = 256;
nightCanvas.height = 256;
const nightCtx = nightCanvas.getContext('2d');
let nightStamp = '';

// The sun's latitude comes from the playback date (so polar day and night are
// real); its longitude is placed 40° east of the view so the visible face is
// lit, with night curving round the far western limb.
function updateNight() {
  if (!settings.nightShade || !map.getSource('night')) return;
  const date = new Date(currentHours() * 3.6e6);
  const sun = subsolarPoint(date);
  sun.lon = ((map.getCenter().lng + 40 + 540) % 360) - 180;
  const stamp = `${Math.round(sun.lat)}|${Math.round(sun.lon / 6)}`;
  if (stamp === nightStamp) return;
  nightStamp = stamp;
  paintNight(nightCtx, sun); // the canvas source re-reads the canvas every frame…
  // …but 3D terrain caches draped layers, so nudge a paint property to redraw.
  nightFlip = !nightFlip;
  map.setPaintProperty('night', 'raster-brightness-max', nightFlip ? 1 : 0.999);
}
let nightFlip = false;
map.on('moveend', updateNight);

export function setNightVisible() {
  if (!map.getLayer('night')) return;
  map.setLayoutProperty('night', 'visibility', settings.nightShade ? 'visible' : 'none');
  nightStamp = '';
  updateNight();
}

// ---------- NASA GIBS overlays ----------

let overlayKey = null;
let overlayShown = null;   // { date, shifted }
let overlayChanged = 0;

export function applyOverlay() {
  if (!map.getSource('heads')) return;
  const key = settings.overlay === 'none' ? null : settings.overlay;
  if (key === overlayKey) return;
  if (map.getLayer('overlay')) map.removeLayer('overlay');
  if (map.getSource('overlay')) map.removeSource('overlay');
  overlayKey = key;
  overlayShown = null;
  if (key) {
    const L = ENV_LAYERS[key];
    const when = overlayDate(key, currentHours());
    map.addSource('overlay', { type: 'raster', tiles: [tileUrl(key, when.date)], tileSize: 256, maxzoom: L.maxzoom, attribution: GIBS_ATTR });
    map.addLayer({ id: 'overlay', type: 'raster', source: 'overlay', paint: { 'raster-opacity': 0.78, 'raster-fade-duration': 350 } }, 'night');
    overlayShown = when;
  }
  emit('overlay', overlayShown);
}

// Swap tiles when the overlay's date changes — at most every 1.2 s while playing.
function updateOverlayDate() {
  if (!overlayKey || !map.getSource('overlay')) return;
  const when = overlayDate(overlayKey, currentHours());
  if (overlayShown && when.date === overlayShown.date) return;
  const now = performance.now();
  if (state.playing && now - overlayChanged < 1200) return;
  overlayChanged = now;
  overlayShown = when;
  map.getSource('overlay').setTiles([tileUrl(overlayKey, when.date)]);
  emit('overlay', overlayShown);
}

// ---------- camera ----------

export function setGuess(features) {
  map.getSource('guess')?.setData({ type: 'FeatureCollection', features });
}

export function viewPadding() {
  if (isPhone()) return { top: 150, bottom: Math.round(window.innerHeight * 0.46) + 10, left: 16, right: 16 };
  const chartsOpen = document.body.classList.contains('charts-open');
  const following = document.body.classList.contains('following');
  return {
    top: 50,
    bottom: chartsOpen ? 400 : 120,
    left: document.body.classList.contains('in-story') ? 200
      : document.body.classList.contains('panel-hidden') ? 60 : 370,
    right: following ? 420 : 60,
  };
}

// Keep the clear area right when the window changes size (rotating a phone,
// resizing a desktop window).
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => map.setPadding(viewPadding()), 200);
});

// Frame a bounding box [w, s, e, n]. `padding` on easeTo replaces the map's
// padding each time, so it never stacks; cameraForBounds ignores map padding,
// so it only supplies the zoom.
export function frameBounds([w, s, e, n], { pitch = 0, maxZoom = 8, duration = 2200, bearing = 0 } = {}) {
  const pad = viewPadding();
  if (e - w > 300) { w = -180; e = 180; }
  let cam = null;
  try {
    cam = map.cameraForBounds([[w, s], [e, n]], { padding: pad, maxZoom });
  } catch {
    // MapLibre throws when the padded area is too small for the bounds (phones).
  }
  const huge = e - w > 60 || n - s > 45; // ocean-basin scale: show the whole globe
  let zoom = cam ? cam.zoom : 2;
  if (huge) zoom = Math.min(zoom, isPhone() ? 0.6 : 1.7);
  map.easeTo({
    center: [(w + e) / 2, (s + n) / 2], zoom: Math.max(0.5, zoom),
    pitch: huge ? 0 : pitch, bearing, padding: pad, duration: dur(duration), essential: true,
  });
}

export function frameSpecies(species) {
  if (!species) {
    map.easeTo({ center: [20, 15], zoom: isPhone() ? 0.5 : 1.5, pitch: 0, bearing: 0, padding: viewPadding(), duration: dur(2000) });
    return;
  }
  frameBounds(species.stats.bbox, { pitch: species.group === 'land' ? 55 : 20 });
}

// Positions of every animal on screen right now (for "frame what's moving").
export function headBounds() {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const inst of state.instances) {
    const p = positionAt(inst.pts, instanceTime(inst), inst.gap);
    if (!p) continue;
    if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0];
    if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1];
  }
  return Number.isFinite(w) ? [w - 1, s - 1, e + 1, n + 1] : null;
}

