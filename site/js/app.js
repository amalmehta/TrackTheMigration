// Track the Migration — wires the globe, panel, playback, follow mode,
// charts and stories together.

import { colorFor } from './palette.js';
import {
  settings, onSettingsChange, updateSettings, applyTheme, isDark, bindSettingsDialog,
} from './settings.js';
import { ENV_LAYERS } from './environment.js';
import {
  map, colorMode, switchBasemap, applyTerrain, recolor, setEffects, setRoutesVisible, setNightVisible,
  applyOverlay, refreshRoutes, renderFrame, pulse, frameSpecies,
} from './globe.js';
import { initFollow, startFollow, stopFollow, followFrame } from './follow.js';
import { initCharts, renderCharts, chartsTime, setOpen as setChartsOpen } from './charts.js';
import { initStory, startStory, stopStory, hasStory } from './story.js';
import {
  state, on, emit, speciesById, visibleSpecies, loadSpecies, MONTHS, fmtDate, fmtSeason, fmtDist,
  fmtMonthYear, esc, iconHtml, year, isPhone,
} from './store.js';

const REPO = 'amalmehta/TrackTheMigration';
const $ = (s) => document.querySelector(s);

// ---------- what's animated ----------

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
  pulse(now);
  frame();
  requestAnimationFrame(tick);
}

function setPlaying(on) {
  if (state.playing === on) return;
  state.playing = on;
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
  if (state.follow && state.follow.species !== id) stopFollow();
  if (state.story && state.story.species !== id) stopStory();
  state.selected = id;
  state.highlight = null;
  renderSpeciesList();
  $('#loading').hidden = false;
  $('#loading').textContent = 'Loading tracks…';
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
  frame();
  renderCharts();
  if (doFrame) frameSpecies(id === 'all' ? null : speciesById(id));
  emit('selection', id);
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
        <button class="btn primary" data-act="calendar">${chartIcon} Migration calendar</button>
      </div>
      <p class="hint">Pick a migration for its story, or click any dot to ride along with that animal.</p>
      <details class="credits"><summary>About the data</summary>
        <p>All tracks are real GPS, Argos satellite or geolocator fixes from published, openly licensed data packages in the
        <a href="https://datarepository.movebank.org" target="_blank" rel="noopener">Movebank Data Repository</a>.
        Each migration lists its citation. Silhouettes from <a href="https://www.phylopic.org" target="_blank" rel="noopener">PhyloPic</a>;
        overlays from <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a>.</p></details>`;
    info.querySelector('[data-act="calendar"]').addEventListener('click', () => setChartsOpen(true));
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
    <details class="credits"><summary>Data &amp; credits</summary>
      <p><b>Data:</b> ${esc(src.dataCitation)}
      ${src.doiUrl ? `<a href="${esc(src.doiUrl)}" target="_blank" rel="noopener">${esc(src.doi)}</a>` : ''}
      <span class="license">${src.licenseUrl ? `<a href="${esc(src.licenseUrl)}" target="_blank" rel="noopener">${esc(src.license)}</a>` : esc(src.license)}</span></p>
      ${src.paperCitation ? `<p><b>Study:</b> ${esc(src.paperCitation)}</p>` : ''}
      <p class="muted">Shown: the ${st.animalsShown} longest-tracked animals; ${thin}implausibly fast jumps removed; straight lines between fixes.</p>
      ${icon ? `<p class="muted">Silhouette: ${esc(icon.attribution)}, <a href="${esc(icon.sourceUrl)}" target="_blank" rel="noopener">PhyloPic</a> (${esc(icon.license)}).</p>` : ''}
    </details>`;
  info.querySelector('[data-act="story"]')?.addEventListener('click', () => startStory(s.id));
  info.querySelector('[data-act="charts"]').addEventListener('click', () => setChartsOpen(true));
  info.querySelector('[data-act="follow"]').addEventListener('click', () => {
    const longest = [...state.data.get(s.id).animals].sort((a, b) => b.km - a.km)[0];
    startFollow(s.id, longest);
    setPlaying(true);
  });
}

const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const followIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const chartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';

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
  for (const name of ['terrain', 'nightShade', 'effects', 'showRoutes']) {
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
  for (const name of ['terrain', 'nightShade', 'effects', 'showRoutes']) {
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
  $('#legend-date').textContent = (L.period === 'week' ? `${Number(shown.date.slice(8))} ` : '') + fmtMonthYear(shown.date);
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
    if (state.mode === 'season') state.frac = Math.min(v, 0.9999);
    else state.t = state.range[0] + v * (state.range[1] - state.range[0]);
    frame();
  });
  $('#mode-season').addEventListener('click', () => { if (state.follow) stopFollow(); setMode('season'); });
  $('#mode-dates').addEventListener('click', () => setMode('dates'));
  $('#speed-select').value = String(settings.speed);
  $('#all-btn').addEventListener('click', () => select('all'));

  const panel = $('#panel');
  $('#collapse-btn').addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    document.body.classList.toggle('panel-hidden', collapsed);
    $('#collapse-btn').setAttribute('aria-expanded', String(!collapsed));
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog, button')) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
  });

  // Click an animal (dot or route) to ride along with it.
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'map-tip' });
  const animalFrom = (f) => state.data.get(f.properties.species)?.animals.find((a) => String(a.id) === String(f.properties.animal));
  for (const layer of ['heads', 'routes']) {
    map.on('click', layer, (e) => {
      const f = e.features[0];
      const animal = animalFrom(f);
      if (!animal) return;
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
        ${a ? `<div><b>${esc(fmtDist(a.km))}</b> tracked</div>` : ''}<div class="tip-hint">Click to follow</div>`)
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
  if (changed.includes('effects')) setEffects();
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
// Keep the animals clear of the charts drawer when it opens or closes.
on('charts', () => {
  if (!state.follow && !state.story) frameSpecies(state.selected === 'all' ? null : speciesById(state.selected));
});
on('selection', () => { if (!$('#layers-pop').hidden) renderLayers(); });
on('style-ready', () => { renderLegend(null); applyOverlay(); });

// ---------- start ----------

const controller = {
  select, setMode, setPlaying, setSpeed, frame, setHighlight,
  follow: (id, animal, opts) => { const p = startFollow(id, animal, opts); setPlaying(true); return p; },
  stopFollow, stopStory,
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
window.ttm = { state, map, updateSettings, select, startFollow, startStory };
