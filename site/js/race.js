// Compare & race: pick up to four animals (any species), then replay them
// side by side from the day each journey began. A leaderboard, a distance-
// over-time chart and an optional split screen (one mini-globe per racer).

import { positionAt, trailAt, distanceAt } from './tracks.js';
import { colorFor } from './palette.js';
import { settings } from './settings.js';
import { colorMode, refreshRoutes, refreshSites, frameBounds } from './globe.js';
import {
  state, emit, speciesById, fmtDist, esc, iconHtml, MAX_RACERS,
} from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null;        // { select, setMode, setPlaying, frame, stopFollow, stopStory }
let chart = null;      // { move(day) }
let splitMaps = [];    // mini-globes in split screen

const SPLIT_ZOOM = { land: 7.5, marine: 3.6, birds: 3.4 };

export function initRace(controller) {
  ctl = controller;
  $('#race-start').addEventListener('click', () => startRace());
  $('#race-clear').addEventListener('click', () => { state.compare = []; renderTray(); });
  $('#race-close').addEventListener('click', () => stopRace());
  $('#race-together').addEventListener('click', () => setSplit(false));
  $('#race-split').addEventListener('click', () => setSplit(true));
  $('#race-length').addEventListener('click', () => {
    const r = state.race;
    if (!r) return;
    const full = r.maxDay !== r.fullDays;
    r.maxDay = full ? r.fullDays : r.fairDays;
    r.day = Math.min(r.day, r.maxDay);
    $('#race-length').setAttribute('aria-pressed', String(full));
    $('#race-length').textContent = full ? `First ${Math.round(r.fairDays).toLocaleString()} days only` : `Show all ${Math.round(r.fullDays).toLocaleString()} days`;
    drawChart();
    emit('race', r);
    ctl.frame();
  });
  window.addEventListener('resize', () => { if (state.race) drawChart(); });
}

// ---------- the compare tray ----------

export function inCompare(species, animal) {
  return state.compare.some((c) => c.species === species && c.animal.id === animal.id);
}

export function toggleCompare(species, animal) {
  const i = state.compare.findIndex((c) => c.species === species && c.animal.id === animal.id);
  if (i >= 0) state.compare.splice(i, 1);
  else {
    if (state.compare.length >= MAX_RACERS) state.compare.shift();
    state.compare.push({ species, animal });
  }
  renderTray();
  emit('compare', state.compare);
}

export function renderTray() {
  const tray = $('#compare-tray');
  const list = $('#compare-list');
  tray.hidden = state.compare.length === 0 || !!state.race;
  list.innerHTML = '';
  state.compare.forEach((c, i) => {
    const sp = speciesById(c.species);
    const chip = document.createElement('span');
    chip.className = 'racer-chip';
    chip.style.setProperty('--sp', colorFor(c.species, colorMode()));
    chip.innerHTML = `${iconHtml(c.species, 'sil sil-sm')}<span><b>${esc(sp.name)}</b> ${esc(c.animal.id)}</span>
      <button class="icon-btn tiny" aria-label="Remove ${esc(sp.name)} ${esc(c.animal.id)}">×</button>`;
    chip.querySelector('button').addEventListener('click', () => { state.compare.splice(i, 1); renderTray(); });
    list.append(chip);
  });
  const n = state.compare.length;
  $('#race-start').disabled = n < 2;
  $('#race-hint').textContent = n < 2 ? 'Add one more animal to race. Shift-click a dot, or use + Compare.' : `${n} racers, each from the day it set off`;
}

// ---------- racing ----------

// Distinct colours: the species colour, or shades of it when a species races itself.
function racerColors(compare) {
  const mode = colorMode();
  const seen = new Map();
  return compare.map((c) => {
    const n = seen.get(c.species) || 0;
    seen.set(c.species, n + 1);
    const base = d3.hcl(colorFor(c.species, mode));
    if (n === 0) return base.formatHex();
    return d3.hcl(base.h, base.c * 0.8, Math.min(95, Math.max(25, base.l + (n % 2 ? 22 : -22) * Math.ceil(n / 2)))).formatHex();
  });
}

export async function startRace() {
  if (state.compare.length < 2) return;
  if (state.story) ctl.stopStory();
  if (state.follow) ctl.stopFollow();
  ctl.setPlaying(false);
  const colors = racerColors(state.compare);
  const racers = state.compare.map((c, i) => {
    const pts = c.animal.pts;
    return {
      ...c, color: colors[i], start: pts[0][2], end: pts[pts.length - 1][2],
      gap: state.data.get(c.species).maxGapHours, group: speciesById(c.species).group,
    };
  });
  // If one track is far longer than the rest (a stork followed for 12 years),
  // size the race to the others; "Show all days" extends it.
  const lengths = racers.map((r) => (r.end - r.start) / 24).sort((a, b) => b - a);
  const fullDays = lengths[0];
  const fairDays = lengths[0] > lengths[1] * 1.5 ? Math.ceil(lengths[1] * 1.2) : fullDays;
  state.race = { racers, day: 0, maxDay: fairDays, fullDays, fairDays, split: false };
  $('#race-length').hidden = fairDays === fullDays;
  $('#race-length').setAttribute('aria-pressed', 'false');
  $('#race-length').textContent = `Show all ${Math.round(fullDays).toLocaleString()} days`;
  state.instances = racers.map((r) => ({ species: r.species, animal: r.animal, pts: r.animal.pts, start: r.start, gap: r.gap, color: r.color }));
  document.body.classList.add('racing');
  $('#compare-tray').hidden = true;
  $('#race').hidden = false;
  refreshRoutes();
  refreshSites();
  // Frame every racer's whole journey.
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const r of racers) for (const [lon, lat] of r.animal.pts) {
    if (lon < w) w = lon; if (lon > e) e = lon; if (lat < s) s = lat; if (lat > n) n = lat;
  }
  frameBounds([w, s, e, n], { pitch: 0 });
  renderBoard();
  drawChart();
  emit('race', state.race);
  ctl.frame();
  ctl.setPlaying(true);
}

export function stopRace() {
  if (!state.race) return;
  setSplit(false);
  state.race = null;
  document.body.classList.remove('racing');
  $('#race').hidden = true;
  chart = null;
  ctl.setMode(state.mode); // rebuild the normal instances
  refreshRoutes();
  refreshSites();
  renderTray();
  emit('race', null);
  ctl.frame();
}

export function raceLabel() {
  const r = state.race;
  return { label: `Day ${Math.floor(r.day) + 1}`, sub: 'since each set off' };
}

// Called every frame while racing.
export function raceFrame() {
  const r = state.race;
  if (!r) return;
  renderBoard();
  chart?.move(r.day);
  if (r.split) updateSplit();
}

function standings() {
  const r = state.race;
  return r.racers.map((x) => {
    const t = x.start + r.day * 24;
    const done = t > x.end;
    const km = distanceAt(x.animal.pts, x.animal.cum, Math.min(t, x.end));
    const tracked = !!positionAt(x.animal.pts, t, x.gap);
    const stop = x.animal.stops?.find(([, , a, b]) => t >= a && t <= b);
    const status = done ? `tag ended on day ${Math.round((x.end - x.start) / 24) + 1}` : !tracked ? 'not tracked' : stop ? 'staying put' : 'on the move';
    return { x, km, status, done };
  }).sort((a, b) => b.km - a.km);
}

function renderBoard() {
  const board = $('#race-board');
  const rows = standings();
  $('#race-day').textContent = `Day ${Math.floor(state.race.day) + 1}`;
  board.innerHTML = rows.map((s, i) => `
    <li style="--sp:${s.x.color}" class="${s.done ? 'done' : ''}">
      <span class="rank">${i + 1}</span>
      ${iconHtml(s.x.species, 'sil board-icon')}
      <span class="who"><b>${esc(speciesById(s.x.species).name)}</b><small>${esc(s.x.animal.id)} · ${esc(s.status)}</small></span>
      <span class="km">${esc(fmtDist(s.km))}</span>
    </li>`).join('');
}

// Distance-over-time: one line per racer, shared axis, crosshair tooltip with every racer.
function drawChart() {
  const el = $('#race-chart');
  el.innerHTML = '';
  const r = state.race;
  const W = el.clientWidth || 500;
  const H = el.clientHeight || 190;
  const m = { l: 48, r: 12, t: 10, b: 22 };
  const step = Math.max(1, Math.ceil(r.maxDay / 400));
  const series = r.racers.map((x) => {
    const pts = [];
    const days = (x.end - x.start) / 24;
    const until = Math.min(days, r.maxDay);
    for (let d = 0; d <= until; d += step) pts.push([d, distanceAt(x.animal.pts, x.animal.cum, x.start + d * 24)]);
    pts.push([until, distanceAt(x.animal.pts, x.animal.cum, x.start + until * 24)]);
    return { x, pts };
  });
  const xS = d3.scaleLinear().domain([0, r.maxDay]).range([m.l, W - m.r]);
  const kmIn = (k) => (settings.units === 'mi' ? k * 0.621371 : k);
  const yS = d3.scaleLinear().domain([0, kmIn(d3.max(series, (s) => s.pts[s.pts.length - 1][1])) || 1]).nice(4).range([H - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', 'Distance travelled by each racer, by days since it set off');
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(yS.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', yS).attr('y2', yS);
  yg.selectAll('text').data(yS.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => yS(v) + 3).attr('text-anchor', 'end').text(d3.format('~s'));
  svg.append('g').attr('class', 'axis x').attr('transform', `translate(0,${H - m.b + 4})`)
    .call(d3.axisBottom(xS).ticks(6).tickSize(0).tickFormat((d) => `day ${d}`))
    .call((g) => g.select('.domain').remove());
  svg.append('text').attr('class', 'axis-note').attr('x', m.l).attr('y', m.t + 2).text(settings.units);
  const line = d3.line().x((p) => xS(p[0])).y((p) => yS(kmIn(p[1])));
  svg.append('g').selectAll('path').data(series).join('path')
    .attr('class', 'race-line').attr('fill', 'none').attr('stroke', (s) => s.x.color).attr('stroke-width', 2).attr('d', (s) => line(s.pts));
  const head = svg.append('line').attr('class', 'playhead').attr('y1', m.t).attr('y2', H - m.b);
  const dots = svg.append('g').selectAll('circle').data(series).join('circle').attr('r', 4.5)
    .attr('fill', (s) => s.x.color).attr('stroke', 'var(--surface)').attr('stroke-width', 2);
  const cross = svg.append('line').attr('class', 'crosshair').attr('y1', m.t).attr('y2', H - m.b).style('opacity', 0);
  const tip = d3.select('#race-tip');
  svg.append('rect').attr('x', m.l).attr('y', 0).attr('width', W - m.l - m.r).attr('height', H).attr('fill', 'transparent')
    .style('cursor', 'ew-resize')
    .on('pointermove', (event) => {
      const [px] = d3.pointer(event);
      const d = Math.max(0, Math.min(r.maxDay, xS.invert(px)));
      cross.attr('x1', px).attr('x2', px).style('opacity', 1);
      const rows = r.racers.map((x) => ({ x, km: distanceAt(x.animal.pts, x.animal.cum, Math.min(x.start + d * 24, x.end)) })).sort((a, b) => b.km - a.km);
      tip.html('');
      tip.append('div').attr('class', 'tip-date').text(`Day ${Math.floor(d) + 1}`);
      for (const row of rows) {
        const div = tip.append('div').attr('class', 'tip-row');
        div.append('i').style('background', row.x.color);
        div.append('b').text(fmtDist(row.km));
        div.append('span').text(` ${speciesById(row.x.species).name} ${row.x.animal.id}`);
      }
      tip.style('opacity', 1).style('left', `${Math.min(px + 12, W - 200)}px`).style('top', '8px');
      if (event.buttons) { state.race.day = d; ctl.frame(); }
    })
    .on('pointerleave', () => { cross.style('opacity', 0); tip.style('opacity', 0); })
    .on('pointerdown', (event) => {
      ctl.setPlaying(false);
      const [px] = d3.pointer(event);
      state.race.day = Math.max(0, Math.min(r.maxDay, xS.invert(px)));
      ctl.frame();
    });
  chart = {
    move(day) {
      head.attr('x1', xS(day)).attr('x2', xS(day));
      dots.attr('cx', (s) => xS(Math.min(day, (s.x.end - s.x.start) / 24, r.maxDay)))
        .attr('cy', (s) => yS(kmIn(distanceAt(s.x.animal.pts, s.x.animal.cum, Math.min(s.x.start + day * 24, s.x.end)))));
    },
  };
  chart.move(r.day);
}

// ---------- split screen: one mini-globe per racer ----------

function setSplit(on) {
  const r = state.race;
  $('#race-together').setAttribute('aria-checked', String(!on));
  $('#race-split').setAttribute('aria-checked', String(on));
  const grid = $('#split');
  for (const m of splitMaps) m.map.remove();
  splitMaps = [];
  grid.innerHTML = '';
  grid.hidden = !on || !r;
  document.body.classList.toggle('split', !!(on && r));
  if (!r) return;
  r.split = on;
  if (!on) return;
  grid.style.setProperty('--n', String(r.racers.length));
  for (const x of r.racers) {
    const cell = document.createElement('div');
    cell.className = 'split-cell';
    cell.style.setProperty('--sp', x.color);
    cell.innerHTML = `<div class="split-map"></div><div class="split-label">${iconHtml(x.species, 'sil sil-sm')}<b>${esc(speciesById(x.species).name)}</b> ${esc(x.animal.id)}<span class="split-km"></span></div>`;
    grid.append(cell);
    const mini = new maplibregl.Map({
      container: cell.querySelector('.split-map'),
      style: {
        version: 8, projection: { type: 'globe' },
        sources: {
          s2: { type: 'raster', tileSize: 256, maxzoom: 13, tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'], attribution: 'Sentinel-2 cloudless by EOX' },
          trail: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#061224' } },
          { id: 's2', type: 'raster', source: 's2' },
          { id: 'route', type: 'line', source: 'trail', filter: ['==', ['get', 'k'], 'route'], paint: { 'line-color': x.color, 'line-width': 1.2, 'line-opacity': 0.35 } },
          { id: 'trail', type: 'line', source: 'trail', filter: ['==', ['get', 'k'], 'trail'], paint: { 'line-color': x.color, 'line-width': 3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
          { id: 'head', type: 'circle', source: 'trail', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': x.color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
        ],
      },
      center: [x.animal.pts[0][0], x.animal.pts[0][1]],
      zoom: SPLIT_ZOOM[x.group],
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    splitMaps.push({ map: mini, x, cell, route: x.animal.pts.map((p) => [p[0], p[1]]) });
  }
  updateSplit();
}

function updateSplit() {
  const r = state.race;
  for (const s of splitMaps) {
    const src = s.map.getSource('trail');
    const t = s.x.start + r.day * 24;
    const tt = Math.min(t, s.x.end);
    const head = positionAt(s.x.animal.pts, tt, Infinity);
    const trail = trailAt(s.x.animal.pts, tt, settings.trailDays * 24, Infinity);
    if (src) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { k: 'route' }, geometry: { type: 'LineString', coordinates: s.route } },
          ...(trail && trail.length > 1 ? [{ type: 'Feature', properties: { k: 'trail' }, geometry: { type: 'LineString', coordinates: trail } }] : []),
          ...(head ? [{ type: 'Feature', properties: { k: 'head' }, geometry: { type: 'Point', coordinates: head } }] : []),
        ],
      });
    }
    if (head) s.map.jumpTo({ center: head });
    s.cell.querySelector('.split-km').textContent = ` · ${fmtDist(distanceAt(s.x.animal.pts, s.x.animal.cum, tt))}`;
  }
}

