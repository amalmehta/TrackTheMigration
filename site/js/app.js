// Track the Migration — wires the globe, panel, playback, follow mode,
// charts and stories together.

import { colorFor } from './palette.js';
import {
  settings, onSettingsChange, updateSettings, applyTheme, isDark, bindSettingsDialog,
} from './settings.js';
import { ENV_LAYERS } from './environment.js';
import {
  map, colorMode, switchBasemap, applyTerrain, recolor, setEffects, setRoutesVisible, setNightVisible,
  applyOverlay, refreshRoutes, refreshSites, setStopsVisible, renderFrame, pulse, frameSpecies, viewPadding,
} from './globe.js';
import { encodeView, decodeView, cameraString } from './share.js';
import { initRace, toggleCompare, inCompare, renderTray, startRace, stopRace, raceFrame, raceLabel } from './race.js';
import { initGame, startGame, stopGame, inGame } from './game.js';
import { record, canRecord } from './record.js';
import { initA11y, announce, describe, clearKbdFocus } from './a11y.js';
import { initTour, startTour, stopTour, tourFrame, inTour } from './tour.js';
import { setSound, setVolume } from './sound.js';
import { initFollow, startFollow, stopFollow, followFrame, recenterFollow } from './follow.js';
import { initCharts, renderCharts, chartsTime, setOpen as setChartsOpen } from './charts.js';
import { initStory, startStory, stopStory, hasStory } from './story.js';
import {
  state, on, emit, speciesById, visibleSpecies, loadSpecies, MONTHS, MONTHS_LONG, fmtDate, fmtSeason, fmtDist,
  fmtMonthYear, esc, iconHtml, year, isPhone, isVisible, facetsOf, facetShades, keyOf, busiestMonths,
  loadOverview, viewData, reducedMotion,
} from './store.js';

const REPO = 'amalmehta/TrackTheMigration';
const $ = (s) => document.querySelector(s);

// ---------- what's animated ----------

function buildInstances() {
  if (state.race) return; // racers are set up by the race
  state.instances = [];
  for (const sp of visibleSpecies()) {
    const d = viewData(sp.id);
    if (!d) continue;
    for (const a of d.animals) {
      if (!isVisible(a)) continue;
      if (state.only && state.only !== keyOf(sp.id, a)) continue;
      if (state.mode === 'dates') {
        state.instances.push({ species: sp.id, animal: a, pts: a.pts, gap: d.maxGapHours });
      } else {
        for (const seg of a.years) {
          state.instances.push({ species: sp.id, animal: a, pts: seg.pts, year: seg.year, gap: d.maxGapHours });
        }
      }
    }
  }
  if (state.follow) {
    const p = state.follow.animal.pts;
    state.range = [p[0][2], p[p.length - 1][2]];
  } else {
    const sps = visibleSpecies();
    state.range = [
      Math.min(...sps.map((s) => Date.parse(s.stats.start) / 3.6e6)),
      Math.max(...sps.map((s) => Date.parse(s.stats.end) / 3.6e6)),
    ];
  }
  if (state.t < state.range[0] || state.t > state.range[1]) state.t = state.range[0];
}

function setMode(mode) {
  state.mode = mode;
  $('#mode-season').setAttribute('aria-checked', String(mode === 'season'));
  $('#mode-dates').setAttribute('aria-checked', String(mode === 'dates'));
  renderTicks();
  buildInstances();
  frame();
  emit('mode', mode);
}

// ---------- the frame and the clock ----------

function frame() {
  const r = renderFrame();
  if (state.race) {
    const { label, sub } = raceLabel();
    $('#time-label').textContent = label;
    $('#time-year').textContent = sub;
    $('#time-slider').value = Math.round((state.race.day / (state.race.maxDay || 1)) * 1000);
    $('#time-active').textContent = `${r.moving} of ${state.race.racers.length} racers tracked`;
    raceFrame();
    return;
  }
  tourFrame();
  if (state.mode === 'season') {
    $('#time-label').textContent = fmtSeason(state.frac);
    $('#time-year').textContent = 'every year';
    $('#time-slider').value = Math.round(state.frac * 1000);
  } else {
    const label = fmtDate(state.t);
    $('#time-label').textContent = label.replace(/ \d{4}$/, '');
    $('#time-year').textContent = label.slice(-4);
    const [a, b] = state.range;
    $('#time-slider').value = Math.round(((state.t - a) / (b - a || 1)) * 1000);
  }
  const what = state.mode === 'season' ? 'animal-years' : 'animals';
  $('#time-active').textContent = `${r.moving} ${r.moving === 1 ? what.replace(/s$/, '') : what} on the move` +
    (state.selected === 'all' ? ` · ${r.species} species` : '');
  followFrame();
  chartsTime();
}

let last = 0;
let lastHashWrite = 0;
let lastDataFrame = 0;
function tick(now) {
  if (!state.playing) return;
  const dt = Math.min(0.1, (now - (last || now)) / 1000);
  last = now;
  const days = Number($('#speed-select').value) * dt;
  if (state.race) {
    state.race.day += days;
    if (state.race.day > state.race.maxDay) state.race.day = 0;
  } else if (state.mode === 'season') {
    state.frac = (state.frac + days / 365.2425) % 1;
  } else {
    state.t += days * 24;
    if (state.t > state.range[1]) state.t = state.range[0];
  }
  pulse(now);
  // Animal positions update at most 30 times a second; the camera still renders every frame.
  if (now - lastDataFrame >= 32) { lastDataFrame = now; frame(); }
  if (now - lastHashWrite > 2000) { lastHashWrite = now; writeHash(); }
  requestAnimationFrame(tick);
}

function setPlaying(on) {
  if (state.playing === on) return;
  state.playing = on;
  if (!on && state.index) announce(describe()); // say where things stand when the globe stops
  $('#play-btn').classList.toggle('playing', on);
  $('#play-btn').setAttribute('aria-label', on ? 'Pause' : 'Play');
  if (on) { last = 0; requestAnimationFrame(tick); }
}

function setSpeed(v) {
  $('#speed-select').value = String(v);
}

function setHighlight(keys) {
  state.highlight = keys && keys.size ? keys : null;
  refreshRoutes();
  frame();
  emit('highlight', state.highlight);
}

// ---------- selection ----------

async function select(id, { frame: doFrame = true } = {}) {
  if (inTour() && id !== 'all') stopTour();
  if (state.follow && state.follow.species !== id) stopFollow();
  if (state.story && state.story.species !== id) stopStory();
  if (state.selected !== id) {
    state.hidden.clear();
    state.colorBy = null;
  }
  state.selected = id;
  state.highlight = null;
  clearKbdFocus();
  renderSpeciesList();
  $('#loading').hidden = false;
  $('#loading').textContent = 'Loading tracks…';
  try {
    if (id === 'all') await loadOverview();
    else await loadSpecies(id);
  } catch (err) {
    $('#loading').textContent = `Couldn't load tracks: ${err.message}`;
    return;
  }
  $('#loading').hidden = true;
  buildInstances();
  refreshRoutes();
  refreshSites();
  renderInfo();
  $('.panel-body').scrollTo({ top: 0, behavior: 'smooth' });
  frame();
  renderCharts();
  if (doFrame) frameSpecies(id === 'all' ? null : speciesById(id));
  emit('selection', id);
  announce(describe());
}

// ---------- panel ----------

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
      b.innerHTML = `${iconHtml(sp.id, 'sil row-icon')}
        <span class="row-text"><strong>${esc(sp.name)}</strong><small>${esc(sp.region)}</small></span>
        <span class="row-dist">${esc(fmtDist(sp.stats.longestKm))}</span>`;
      b.title = `Longest track: ${fmtDist(sp.stats.longestKm)}`;
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
    info.style.removeProperty('--sp');
    info.innerHTML = `
      <p class="kicker">Real tracking data · ${sp.length} migrations</p>
      <h2 class="hero-title">${animals} animals, one planet</h2>
      <p>Each glowing dot is one tagged animal; its tail is where it went over the last ${settings.trailDays} days.
      In <b>Season</b> view every year an animal was tracked plays over one calendar year, so you can see who moves when.</p>
      <div class="actions-row">
        <button class="btn primary" data-act="tour">${playIcon} A year on Earth</button>
        <button class="btn" data-act="calendar">${chartIcon} Migration calendar</button>
        <button class="btn" data-act="game">${gameIcon} Guess where</button>
      </div>
      <p class="hint">Pick a migration for its story, or click any dot to ride along with that animal.
      <b>Shift-click</b> dots from any species to race them against each other.</p>
      <details class="credits"><summary>About the data</summary>
        <p>All tracks are real GPS, Argos satellite or geolocator fixes from published, openly licensed data packages in the
        <a href="https://datarepository.movebank.org" target="_blank" rel="noopener">Movebank Data Repository</a>.
        Each migration lists its citation. Silhouettes from <a href="https://www.phylopic.org" target="_blank" rel="noopener">PhyloPic</a>;
        overlays from <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a>.</p></details>`;
    info.querySelector('[data-act="calendar"]').addEventListener('click', () => setChartsOpen(true));
    info.querySelector('[data-act="game"]').addEventListener('click', () => startGame());
    info.querySelector('[data-act="tour"]').addEventListener('click', () => startTour());
    return;
  }
  const s = speciesById(state.selected);
  const st = s.stats;
  const src = s.source;
  const icon = state.assets?.icons?.[s.id];
  const span = year(st.start) === year(st.end) ? year(st.start) : `${year(st.start)}–${year(st.end)}`;
  const thin = s.processing.thinHours ? `at most one position per ${s.processing.thinHours} h, ` : '';
  info.style.setProperty('--sp', colorFor(s.id, isDark() ? 'dark' : 'light'));
  info.innerHTML = `
    <div class="species-hero">
      ${iconHtml(s.id, 'sil hero-icon')}
      <div>
        <p class="kicker">${esc(s.groupName)}</p>
        <h2 class="hero-title">${esc(s.name)}</h2>
        <p class="sci">${esc(s.scientific)} · ${esc(s.region)}</p>
      </div>
    </div>
    <p>${esc(s.blurb)}</p>
    <div class="actions-row">
      ${hasStory(s.id) ? `<button class="btn primary" data-act="story">${playIcon} Tell me the story</button>` : ''}
      <button class="btn" data-act="follow">${followIcon} Follow the farthest</button>
      <button class="btn" data-act="charts">${chartIcon} Charts</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${st.animalsShown}${st.animalsShown < st.animalsInStudy ? `<small> of ${st.animalsInStudy}</small>` : ''}</b><span>animals shown</span></div>
      <div class="stat"><b>${span}</b><span>tracked</span></div>
      <div class="stat"><b>${fmtDist(st.medianKm)}</b><span>typical distance per animal</span></div>
      <div class="stat"><b>${fmtDist(st.longestKm)}</b><span>longest track</span></div>
    </div>
    <section id="who" class="who"></section>
    <details class="credits"><summary>Data &amp; credits</summary>
      <p><b>Data:</b> ${esc(src.dataCitation)}
      ${src.doiUrl ? `<a href="${esc(src.doiUrl)}" target="_blank" rel="noopener">${esc(src.doi)}</a>` : ''}
      <span class="license">${src.licenseUrl ? `<a href="${esc(src.licenseUrl)}" target="_blank" rel="noopener">${esc(src.license)}</a>` : esc(src.license)}</span></p>
      ${src.paperCitation ? `<p><b>Study:</b> ${esc(src.paperCitation)}</p>` : ''}
      <p class="muted">Shown: the ${st.animalsShown} longest-tracked animals; ${thin}implausibly fast jumps removed; straight lines between fixes.</p>
      ${s.facets?.length ? `<p class="muted">Sex, age, tagging site and handling come from the study's reference data.</p>` : ''}
      ${icon ? `<p class="muted">Silhouette: ${esc(icon.attribution)}, <a href="${esc(icon.sourceUrl)}" target="_blank" rel="noopener">PhyloPic</a> (${esc(icon.license)}).</p>` : ''}
    </details>`;
  renderWho();
  info.querySelector('[data-act="story"]')?.addEventListener('click', () => startStory(s.id));
  info.querySelector('[data-act="charts"]').addEventListener('click', () => setChartsOpen(true));
  info.querySelector('[data-act="follow"]').addEventListener('click', () => {
    const longest = [...state.data.get(s.id).animals].sort((a, b) => b.km - a.km)[0];
    startFollow(s.id, longest);
    setPlaying(true);
  });
}

// ---------- who they are: filters, colour-by and stopover summary ----------

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function renderWho() {
  const el = document.getElementById('who');
  if (!el || state.selected === 'all') return;
  const id = state.selected;
  const sp = speciesById(id);
  const d = state.data.get(id);
  const facets = facetsOf(id);
  let html = '';
  if (facets.length) {
    html += `<div class="who-head"><span class="kicker">Who they are</span>
      <label class="cb-select">Colour by <select id="color-by" aria-label="Colour animals by">
        <option value="">species</option>
        ${facets.map((f) => `<option value="${f.key}" ${state.colorBy === f.key ? 'selected' : ''}>${esc(f.label.toLowerCase())}</option>`).join('')}
      </select></label></div>`;
    for (const f of facets) {
      const shades = state.colorBy === f.key ? facetShades(id, f.key, colorMode()) : null;
      html += `<div class="facet"><span class="facet-label">${esc(f.label)}</span><div class="chips">${f.values.map((v) => {
        const on = !state.hidden.has(`${f.key}=${v.value}`);
        return `<button class="chip facet-chip" aria-pressed="${on}" data-k="${esc(f.key)}" data-v="${esc(v.value)}" title="${on ? 'Hide' : 'Show'} ${esc(v.value)}">${
          shades ? `<i class="swatch-dot" style="background:${shades.get(v.value)}"></i>` : ''}${esc(cap(v.value))} <small>${v.count}</small></button>`;
      }).join('')}</div></div>`;
    }
  }
  if (d?.sites?.length) {
    const stop = sp.processing.stop;
    html += `<div class="facet"><span class="facet-label">Places they stayed</span>
      <p class="small muted">${d.sites.length} places where an animal stayed at least ${stop.days} days within ${stop.km} km.
      ${settings.showStops ? 'Rings on the globe; brighter when in use at this time of year. Click one to see who used it.' : 'Switch on <b>Stopovers</b> in Layers to see them.'}</p></div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.facet-chip').forEach((b) => b.addEventListener('click', () => toggleFacet(b.dataset.k, b.dataset.v)));
  el.querySelector('#color-by')?.addEventListener('change', (e) => setColorBy(e.target.value || null));
}

function applyFilter() {
  if (state.follow && !isVisible(state.follow.animal)) stopFollow();
  state.highlight = null;
  buildInstances();
  refreshRoutes();
  refreshSites();
  frame();
  renderWho();
  renderCharts();
  emit('filter');
}

function toggleFacet(k, v) {
  const key = `${k}=${v}`;
  if (state.hidden.has(key)) state.hidden.delete(key);
  else state.hidden.add(key);
  applyFilter();
}

function setColorBy(k) {
  state.colorBy = k;
  refreshRoutes();
  frame();
  renderWho();
  renderCharts();
  emit('filter');
}

const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const followIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const gameIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3"/></svg>';
const chartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';

function renderTicks() {
  const ticks = $('#month-ticks');
  ticks.innerHTML = '';
  if (state.race) {
    const max = state.race.maxDay;
    const step = [7, 30, 60, 100, 200, 365, 500, 1000].find((k) => max / k <= 7) || 1000;
    for (let d = step; d < max; d += step) {
      const s = document.createElement('span');
      s.style.left = `${(d / max) * 100}%`;
      s.textContent = `day ${d}`;
      ticks.append(s);
    }
    return;
  }
  if (state.mode === 'season') {
    MONTHS.forEach((m, i) => {
      const s = document.createElement('span');
      s.style.left = `${((i + 0.5) / 12) * 100}%`;
      s.textContent = m;
      ticks.append(s);
    });
  } else {
    const [a, b] = state.range;
    const y0 = new Date(a * 3.6e6).getUTCFullYear();
    const y1 = new Date(b * 3.6e6).getUTCFullYear();
    const step = Math.max(1, Math.ceil((y1 - y0 + 1) / 8));
    for (let y = y0 + 1; y <= y1; y += step) {
      const h = Date.UTC(y, 0, 1) / 3.6e6;
      const s = document.createElement('span');
      s.style.left = `${((h - a) / (b - a)) * 100}%`;
      s.textContent = y;
      ticks.append(s);
    }
  }
}

// ---------- layers popover and overlay legend ----------

function renderLayers() {
  const pop = $('#layers-pop');
  const group = state.selected === 'all' ? null : speciesById(state.selected).group;
  pop.querySelectorAll('input[name="basemap"]').forEach((r) => { r.checked = r.value === settings.basemap; });
  const list = $('#overlay-list');
  list.innerHTML = '';
  for (const [key, label] of [['none', 'None'], ...Object.entries(ENV_LAYERS).map(([k, L]) => [k, L.title])]) {
    const L = ENV_LAYERS[key];
    if (key === 'vegetation' || key === 'footprint') {
      const h = document.createElement('div');
      h.className = 'legend-group';
      h.textContent = key === 'vegetation' ? 'Nature, by date' : 'People';
      list.append(h);
    }
    const id = `ov-${key}`;
    const row = document.createElement('label');
    row.className = 'radio-row';
    row.htmlFor = id;
    row.innerHTML = `<input type="radio" name="overlay" id="${id}" value="${key}" ${settings.overlay === key ? 'checked' : ''}>
      <span><b>${esc(label)}</b>${L ? `<small>${esc(L.detail)}</small>` : ''}</span>
      ${L && group && L.for.includes(group) ? '<em class="badge">suits this one</em>' : ''}`;
    row.querySelector('input').addEventListener('change', () => updateSettings({ overlay: key }));
    list.append(row);
  }
  for (const name of ['terrain', 'nightShade', 'effects', 'showRoutes', 'showStops']) {
    pop.querySelector(`input[name="${name}"]`).checked = settings[name];
  }
}

function wireLayers() {
  const btn = $('#layers-btn');
  const pop = $('#layers-pop');
  btn.addEventListener('click', () => {
    const open = pop.hidden;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) renderLayers();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  pop.querySelectorAll('input[name="basemap"]').forEach((r) => r.addEventListener('change', () => updateSettings({ basemap: r.value })));
  for (const name of ['terrain', 'nightShade', 'effects', 'showRoutes', 'showStops']) {
    pop.querySelector(`input[name="${name}"]`).addEventListener('change', (e) => updateSettings({ [name]: e.target.checked }));
  }
}

function renderLegend(shown) {
  const box = $('#legend');
  const key = settings.overlay;
  const L = ENV_LAYERS[key];
  const lg = state.assets?.layers?.[key];
  if (!L || !lg || !shown) { box.hidden = true; return; }
  box.hidden = false;
  $('#legend-title').textContent = L.title;
  $('#legend-date').textContent = shown.fixed ? '1995–2004'
    : L.period === 'static' || L.period === 'year' ? String(shown.year)
      : (L.period === 'week' ? `${Number(shown.date.slice(8))} ` : '') + fmtMonthYear(shown.date);
  $('#legend-shift').hidden = !shown.shifted;
  $('#legend-ramp').style.background = `linear-gradient(90deg, ${lg.stops.join(',')})`;
  $('#legend-min').textContent = lg.min;
  $('#legend-max').textContent = `${lg.max} ${lg.units}`.trim();
  $('#legend-why').textContent = L.why;
}

// ---------- starfield ----------

function drawStars() {
  const c = $('#stars');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  // Deterministic pseudo-random so the sky doesn't reshuffle on resize.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const band = g.createLinearGradient(0, c.height, c.width, 0);
  band.addColorStop(0.3, 'rgba(60,80,140,0)');
  band.addColorStop(0.5, 'rgba(90,110,180,0.10)');
  band.addColorStop(0.7, 'rgba(60,80,140,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, c.width, c.height);
  const n = Math.round((innerWidth * innerHeight) / 1800);
  for (let i = 0; i < n; i++) {
    const x = rnd() * c.width;
    const y = rnd() * c.height;
    const r = (rnd() ** 3 * 1.3 + 0.25) * dpr;
    const a = 0.25 + rnd() * 0.75;
    const hue = rnd() < 0.15 ? '200,220,255' : rnd() < 0.1 ? '255,230,200' : '255,255,255';
    g.fillStyle = `rgba(${hue},${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

// ---------- controls ----------

function wireControls() {
  $('#play-btn').addEventListener('click', () => setPlaying(!state.playing));
  $('#time-slider').addEventListener('input', (e) => {
    const v = Number(e.target.value) / 1000;
    if (state.race) state.race.day = v * state.race.maxDay;
    else if (state.mode === 'season') state.frac = Math.min(v, 0.9999);
    else state.t = state.range[0] + v * (state.range[1] - state.range[0]);
    frame();
    writeHash();
  });
  $('#mode-season').addEventListener('click', () => { if (state.race) stopRace(); if (state.follow) stopFollow(); setMode('season'); });
  $('#mode-dates').addEventListener('click', () => { if (state.race) stopRace(); setMode('dates'); });
  $('#speed-select').value = String(settings.speed);
  $('#all-btn').addEventListener('click', () => select('all'));

  const panel = $('#panel');
  $('#collapse-btn').addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    document.body.classList.toggle('panel-hidden', collapsed);
    $('#collapse-btn').setAttribute('aria-expanded', String(!collapsed));
  });

  window.addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea, select, dialog, button')) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
  });

  // Click an animal (dot or route) to ride along with it.
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'map-tip' });
  const animalFrom = (f) => viewData(f.properties.species)?.animals.find((a) => String(a.id) === String(f.properties.animal));
  for (const layer of ['heads', 'routes']) {
    map.on('click', layer, (e) => {
      if (inGame() || state.race) return;
      const f = e.features[0];
      const animal = animalFrom(f);
      if (!animal) return;
      if (e.originalEvent.shiftKey) {
        toggleCompare(f.properties.species, animal);
        toast(inCompare(f.properties.species, animal) ? 'Added to the race. Pick another, then press Race.' : 'Removed from the race.');
        return;
      }
      startFollow(f.properties.species, animal);
      setPlaying(true);
    });
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; popup.remove(); });
  }
  map.on('mousemove', 'heads', (e) => {
    const p = e.features[0].properties;
    const sp = speciesById(p.species);
    const a = animalFrom(e.features[0]);
    popup.setLngLat(e.lngLat)
      .setHTML(`<div class="tip-date">${esc(sp.name)} · ${esc(p.animal)}${p.year ? ` · ${p.year}` : ''}</div>
        ${a ? `<div><b>${esc(fmtDist(a.km))}</b> tracked</div>` : ''}<div class="tip-hint">${inGame() || state.race ? '' : 'Click to follow · Shift-click to race'}</div>`)
      .addTo(map);
  });

  // Stopover sites: hover for who used them and when; click to pick those animals.
  const siteOf = (f) => viewData(f.properties.species)?.sites?.[f.properties.idx];
  map.on('mousemove', 'sites', (e) => {
    const f = e.features[0];
    const site = siteOf(f);
    if (!site) return;
    const sp = speciesById(f.properties.species);
    const peak = Math.max(...site.months) || 1;
    const bars = site.months.map((m, i) => `<rect x="${i * 9}" y="${22 - (m / peak) * 20}" width="7" height="${Math.max(1, (m / peak) * 20)}" rx="1.5"/>`).join('');
    popup.setLngLat(e.lngLat)
      .setHTML(`<div class="tip-date">${esc(sp.name)} · a place they stayed</div>
        <div><b>${site.animals.length}</b> ${site.animals.length === 1 ? 'animal' : 'animals'} · <b>${site.days.toLocaleString()}</b> animal-days</div>
        <div class="tip-months"><svg viewBox="0 0 108 22" width="108" height="22" fill="${f.properties.color}" aria-hidden="true">${bars}</svg>
        <span>busiest: ${esc(busiestMonths(site.months))}</span></div>
        <div class="tip-hint">Click to pick these animals</div>`)
      .addTo(map);
  });
  map.on('mouseenter', 'sites', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'sites', () => { map.getCanvas().style.cursor = ''; popup.remove(); });
  map.on('click', 'sites', (e) => {
    if (map.queryRenderedFeatures(e.point, { layers: ['heads'] }).length) return; // a dot click wins
    const f = e.features[0];
    const site = siteOf(f);
    if (site) pickSite(f.properties.species, site);
  });

  // Share this view: a link, an embed snippet, or a short video.
  const sharePop = $('#share-pop');
  $('#share-btn').addEventListener('click', () => {
    writeHash(true);
    sharePop.hidden = !sharePop.hidden;
    $('#share-btn').setAttribute('aria-expanded', String(!sharePop.hidden));
    $('#share-record').disabled = !canRecord();
    if (!canRecord()) $('#share-record').title = 'This browser can\u2019t record video';
  });
  document.addEventListener('pointerdown', (e) => {
    if (!sharePop.hidden && !sharePop.contains(e.target) && !$('#share-btn').contains(e.target)) sharePop.hidden = true;
  });
  const copy = async (text, ok) => {
    try { await navigator.clipboard.writeText(text); toast(ok); } catch { toast(`Copy this: ${text}`); }
    sharePop.hidden = true;
  };
  $('#share-link').addEventListener('click', () => { writeHash(true); copy(fullUrl(), 'Link copied. It opens at this exact moment.'); });
  $('#share-embed').addEventListener('click', () => {
    writeHash(true);
    const src = fullUrl().replace(/(#|$)/, (m) => `${location.search ? '&' : '?'}embed=1${m}`);
    copy(`<iframe src="${src}" width="960" height="560" style="border:0;border-radius:12px" title="Track the Migration" allow="fullscreen" loading="lazy"></iframe>`,
      'Embed code copied. Paste it into any web page.');
  });
  $('#share-record').addEventListener('click', () => { sharePop.hidden = true; startRecording(); });

  // Compare & race from the follow readout
  $('#hud-compare').addEventListener('click', () => {
    if (!state.follow) return;
    toggleCompare(state.follow.species, state.follow.animal);
    syncHudCompare();
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
  if (changed.includes('theme')) applyTheme();
  if (changed.includes('basemap') || (changed.includes('theme') && settings.basemap === 'theme')) {
    renderSpeciesList();
    switchBasemap();
  } else if (changed.includes('theme')) {
    recolor();
    renderSpeciesList();
  }
  if (changed.includes('theme')) { renderInfo(); renderCharts(); }
  if (changed.includes('terrain') || changed.includes('exaggeration')) applyTerrain();
  if (changed.includes('showRoutes')) setRoutesVisible();
  if (changed.includes('showStops')) { setStopsVisible(); renderWho(); }
  if (changed.includes('effects')) setEffects();
  if (changed.includes('motion')) document.body.classList.toggle('reduce-motion', reducedMotion());
  if (changed.includes('sound')) { setSound(settings.sound); emit('sound'); }
  if (changed.includes('volume')) setVolume(settings.volume);
  if (changed.includes('nightShade')) setNightVisible();
  if (changed.includes('overlay')) applyOverlay();
  if (changed.includes('speed')) setSpeed(settings.speed);
  if (changed.includes('units') || changed.includes('trailDays')) { renderInfo(); renderSpeciesList(); renderCharts(); }
  if (changed.includes('mode') && !state.follow) setMode(settings.mode);
  if (!$('#layers-pop').hidden) renderLayers();
  frame();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (settings.theme !== 'system') return;
  renderSpeciesList();
  renderInfo();
  renderCharts();
  if (settings.basemap === 'theme') switchBasemap();
  else recolor();
});

on('overlay', renderLegend);
on('race', () => renderTicks());
// Keep the animals clear of the charts drawer when it opens or closes.
on('charts', () => {
  if (!state.follow && !state.story) frameSpecies(state.selected === 'all' ? null : speciesById(state.selected));
});
on('selection', () => { if (!$('#layers-pop').hidden) renderLayers(); });
// The style can finish loading after a shared link was applied: redraw, and re-find a followed animal.
on('style-ready', () => {
  applyOverlay();
  if (!state.index) return;
  frame();
  if (state.follow) recenterFollow();
});

// ---------- start ----------

const fullUrl = () => location.href.replace(/[?&]embed=1/, '');

function syncHudCompare() {
  const on = !!state.follow && inCompare(state.follow.species, state.follow.animal);
  $('#hud-compare').textContent = on ? '✓ In the race' : '+ Race';
  $('#hud-compare').setAttribute('aria-pressed', String(on));
}
on('follow', syncHudCompare);
on('compare', syncHudCompare);

// ---------- record a short video ----------

let recording = null;
function startRecording() {
  if (recording) return;
  setPlaying(true);
  const btn = $('#rec-stop');
  $('#rec').hidden = false;
  recording = record({
    seconds: 12,
    getText: () => {
      const sp = state.follow ? speciesById(state.follow.species) : state.selected !== 'all' ? speciesById(state.selected) : null;
      const title = state.race ? 'The race' : sp ? `${sp.name}${state.follow ? ` · ${state.follow.animal.id}` : ''}` : 'Every migration';
      const subtitle = state.story ? $('#story-title').textContent : sp ? sp.region : `${state.index.species.length} species, real tracking data`;
      return { title, subtitle, date: $('#time-label').textContent, year: $('#time-year').textContent };
    },
    onTick: (left) => { $('#rec-left').textContent = `${Math.ceil(left)} s`; },
    onDone: (blob, ext) => {
      recording = null;
      $('#rec').hidden = true;
      const name = `track-the-migration-${state.selected}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
      toast(`Saved ${name}`);
    },
  });
  btn.onclick = () => recording?.stop();
}

// Pick the animals that used a stopover site, and fly there.
async function pickSite(speciesId, site) {
  if (state.follow) stopFollow();
  if (state.selected !== speciesId) await select(speciesId, { frame: false });
  setHighlight(new Set(site.animals.map((id) => keyOf(speciesId, id))));
  const group = speciesById(speciesId).group;
  map.easeTo({ center: [site.lon, site.lat], zoom: Math.max(map.getZoom(), group === 'land' ? 9 : 5), padding: viewPadding(), duration: 1600 });
}

let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- shareable links ----------

let hashTimer = 0;
let applyingHash = true; // until startup has read any shared link, never overwrite it
function writeHash(now = false) {
  if (applyingHash) return;
  clearTimeout(hashTimer);
  const write = () => {
    if (applyingHash) return;
    const h = encodeView(cameraString(map));
    if (location.hash.slice(1) !== h) history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
  };
  if (now) write(); else hashTimer = setTimeout(write, 600);
}
for (const ev of ['selection', 'mode', 'follow', 'story', 'story-scene', 'filter', 'overlay']) on(ev, () => writeHash());
map.on('moveend', () => writeHash());

async function applySharedView(view) {
  applyingHash = true;
  try {
    const valid = view.species === 'all' || state.index.species.some((s) => s.id === view.species);
    const id = valid ? view.species : 'all';
    await select(id, { frame: !view.camera && !view.follow && view.story == null });
    if (view.overlay && view.overlay !== settings.overlay) updateSettings({ overlay: view.overlay });
    if (id !== 'all') {
      const keys = new Set(facetsOf(id).flatMap((f) => f.values.map((v) => `${f.key}=${v.value}`)));
      for (const h of view.hidden) if (keys.has(h)) state.hidden.add(h);
      if (facetsOf(id).some((f) => f.key === view.colorBy)) state.colorBy = view.colorBy;
      if (state.hidden.size || state.colorBy) applyFilter();
    }
    if (view.story != null && id !== 'all') {
      await startStory(id, view.story);
      return true;
    }
    if (view.tour) {
      await startTour();
      return true;
    }
    const animal = id !== 'all' && view.follow
      ? state.data.get(id).animals.find((a) => String(a.id) === view.follow)
      : null;
    if (animal) {
      if (view.t != null) state.t = view.t;
      await startFollow(id, animal);
    } else if (view.mode) {
      setMode(view.mode);
      if (view.mode === 'dates' && view.t != null) state.t = Math.min(state.range[1], Math.max(state.range[0], view.t));
      if (view.mode === 'season' && view.frac != null) state.frac = view.frac;
    }
    if (view.camera && !animal) map.jumpTo({ ...view.camera, padding: viewPadding() });
    frame();
    return true;
  } finally {
    applyingHash = false;
    writeHash();
  }
}

const controller = {
  select, setMode, setPlaying, setSpeed, frame, setHighlight, pickSite, toggleCompare, stopRace,
  stopFollow, stopStory,
  toggleCharts: () => setChartsOpen($('#charts').hidden),
  openLayers: () => $('#layers-btn').click(),
  follow: (id, animal, opts) => { const p = startFollow(id, animal, opts); setPlaying(true); return p; },
};

async function main() {
  applyTheme();
  setEffects();
  drawStars();
  window.addEventListener('resize', drawStars);
  bindSettingsDialog($('#settings-dialog'), $('#settings-btn'));
  const [index, assets] = await Promise.all([
    fetch('data/index.json').then((r) => r.json()),
    fetch('data/assets.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  state.index = index;
  state.assets = assets;
  wireControls();
  wireLayers();
  initFollow(controller);
  initCharts(controller);
  initStory(controller);
  initRace(controller);
  initGame(controller);
  initA11y(controller);
  initTour(controller);
  // Sound: a toggle in the time bar (browsers only allow audio after a click).
  const soundBtn = $('#sound-btn');
  const syncSound = () => soundBtn.setAttribute('aria-pressed', String(settings.sound));
  syncSound();
  soundBtn.addEventListener('click', () => updateSettings({ sound: !settings.sound }));
  if (settings.sound) document.addEventListener('pointerdown', () => setSound(true), { once: true });
  on('sound', syncSound);
  document.body.classList.toggle('reduce-motion', reducedMotion());
  setupEmbed();
  setMode(settings.mode);
  renderSpeciesList();
  // A shared link opens paused at its moment; otherwise start as usual.
  const shared = decodeView(location.hash);
  if (shared) {
    await applySharedView(shared);
    // Stories and embedded globes play; a plain shared link opens paused at its moment.
    if ((shared.story != null || document.body.classList.contains('embed')) && !shared.tour) setPlaying(true);
  } else {
    applyingHash = false;
    await select('all');
    if (settings.autoplay && !reducedMotion()) setPlaying(true);
  }
}

// Embed mode (?embed=1): just the globe, the clock and a link to the full site.
function setupEmbed() {
  if (!new URLSearchParams(location.search).has('embed')) return;
  document.body.classList.add('embed');
  const link = $('#embed-link');
  link.hidden = false;
  const sync = () => { link.href = fullUrl(); };
  sync();
  window.addEventListener('hashchange', sync);
  setInterval(sync, 2000);
}

main().catch((err) => {
  console.error(err);
  $('#loading').hidden = false;
  $('#loading').textContent = `Something went wrong: ${err.message}`;
});

// For debugging in the console.
window.ttm = { state, map, updateSettings, select, startFollow, startStory, applySharedView, decodeView };
