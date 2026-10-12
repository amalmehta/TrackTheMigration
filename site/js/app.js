// Track the Migration — wires the globe, panel, playback, follow mode,
// charts and stories together.

import { settings, onSettingsChange, updateSettings, applyTheme, bindSettingsDialog } from './settings.js';
import {
  map, switchBasemap, applyTerrain, recolor, setEffects, setRoutesVisible, setNightVisible,
  applyOverlay, refreshRoutes, refreshSites, setStopsVisible, renderFrame, pulse, frameSpecies,
} from './globe.js';
import { decodeView } from './share.js';
import { initRace, toggleCompare, inCompare, stopRace, raceFrame, raceLabel } from './race.js';
import { initGame } from './game.js';
import { initA11y, announce, describe, clearKbdFocus } from './a11y.js';
import { initTour, stopTour, tourFrame, inTour } from './tour.js';
import { setSound, setVolume } from './sound.js';
import { initAtlas, openAtlas } from './atlas.js';
import { initFollow, startFollow, stopFollow, followFrame, recenterFollow } from './follow.js';
import { initCharts, renderCharts, chartsTime, setOpen as setChartsOpen } from './charts.js';
import { initStory, startStory, stopStory } from './story.js';
import { initPanel, renderSpeciesList, renderInfo, renderWho } from './panel.js';
import { wireLayers, renderLayers } from './layers.js';
import { initMapInput, pickSite } from './map-input.js';
import { initSharing, writeHash, startWritingHash, applySharedView, setupEmbed } from './sharing.js';
import { initFeedback, drawStars } from './ui.js';
import {
  state, on, emit, speciesById, visibleSpecies, loadSpecies, MONTHS, fmtDate, fmtSeason,
  isVisible, keyOf, loadOverview, viewData, reducedMotion,
} from './store.js';

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
  buildInstances(); // first: the ticks follow the new time range
  renderTicks();
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
let rafId = 0;
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
  rafId = requestAnimationFrame(tick);
}

function setPlaying(on) {
  if (state.playing === on) return;
  state.playing = on;
  if (!on && state.index) announce(describe()); // say where things stand when the globe stops
  $('#play-btn').classList.toggle('playing', on);
  $('#play-btn').setAttribute('aria-label', on ? 'Pause' : 'Play');
  cancelAnimationFrame(rafId); // pausing and resuming within a frame mustn't leave two loops
  if (on) { last = 0; rafId = requestAnimationFrame(tick); }
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

let selecting = 0; // the latest selection wins if two overlap while loading
async function select(id, { frame: doFrame = true } = {}) {
  const ticket = ++selecting;
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
    if (ticket === selecting) $('#loading').textContent = `Couldn't load tracks: ${err.message}`;
    return;
  }
  if (ticket !== selecting) return;
  $('#loading').hidden = true;
  buildInstances();
  renderTicks();
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
  // The tour runs on the time of year: real dates end it.
  $('#mode-dates').addEventListener('click', () => { if (state.race) stopRace(); if (inTour()) stopTour(); setMode('dates'); });
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

  // Compare & race from the follow readout
  $('#hud-compare').addEventListener('click', () => {
    if (!state.follow) return;
    toggleCompare(state.follow.species, state.follow.animal);
    syncHudCompare();
  });
}

onSettingsChange((changed) => {
  if (!state.index) return; // still loading: main() applies the settings once data is in
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

on('race', () => renderTicks());
// Keep the animals clear of the charts drawer when it opens or closes.
on('charts', () => {
  if (!state.follow && !state.story) frameSpecies(state.selected === 'all' ? null : speciesById(state.selected));
});
// The style can finish loading after a shared link was applied: redraw, and re-find a followed animal.
on('style-ready', () => {
  applyOverlay();
  if (!state.index) return;
  frame();
  if (state.follow) recenterFollow();
});

function syncHudCompare() {
  const on = !!state.follow && inCompare(state.follow.species, state.follow.animal);
  $('#hud-compare').textContent = on ? '✓ In the race' : '+ Race';
  $('#hud-compare').setAttribute('aria-pressed', String(on));
}
on('follow', syncHudCompare);
on('compare', syncHudCompare);

// ---------- start ----------

const controller = {
  select, setMode, setPlaying, setSpeed, frame, setHighlight, buildInstances, pickSite, toggleCompare, stopRace,
  stopFollow, stopStory,
  toggleCharts: () => setChartsOpen($('#charts').hidden),
  openLayers: () => $('#layers-btn').click(),
  openAtlas: () => openAtlas(state.selected === 'all' ? null : state.selected),
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
  initFeedback();
  initPanel(controller);
  initMapInput(controller);
  initSharing(controller);
  initFollow(controller);
  initCharts(controller);
  initStory(controller);
  initRace(controller);
  initGame(controller);
  initA11y(controller);
  initTour(controller);
  initAtlas(controller);
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
    startWritingHash();
    await select('all');
    if (settings.autoplay && !reducedMotion()) setPlaying(true);
  }
}


main().catch((err) => {
  console.error(err);
  $('#loading').hidden = false;
  $('#loading').textContent = `Something went wrong: ${err.message}`;
});

// For debugging in the console.
window.ttm = { state, map, updateSettings, select, startFollow, startStory, applySharedView, decodeView };
