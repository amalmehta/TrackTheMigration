// Follow one animal: the camera rides along, a readout shows where it is and
// how fast it's going, and a profile of the whole journey can be scrubbed.

import { positionAt, distanceAt, speedAt, mainAxis, haversineKm, indexAtOrBefore, seasonToHours } from './tracks.js';
import { colorFor } from './palette.js';
import { settings } from './settings.js';
import { map, colorMode, refreshRoutes, viewPadding, setCurtain } from './globe.js';
import {
  state, emit, speciesById, fmtDate, fmtDist, fmtSpeed, esc, iconHtml, kmIn, fullAnimal, reducedMotion, dur, t as tr, num,
} from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null;          // { select, setMode, setPlaying, frame }
let prevMode = null;
let userMoved = false;
let flying = false;
let profile = null;      // the drawn profile chart (for the playhead)
let panelWasTucked = false;
let closeUp = false;     // the low, steep camera for seeing a bird's flight in 3D

const ZOOM = { land: 9.2, marine: 4.6, birds: 4.4 };
const PITCH = { land: 58, marine: 35, birds: 35 };
const CLOSE_UP = { zoom: 9.5, pitch: 72 };

export function initFollow(controller) {
  ctl = controller;
  $('#hud-close').addEventListener('click', () => stopFollow());
  $('#hud-recenter').addEventListener('click', () => {
    userMoved = false;
    $('#hud-recenter').hidden = true;
    flyToAnimal(1200);
  });
  $('#hud-alt-3d').addEventListener('click', () => setCloseUp(!closeUp));
  // Any drag or rotate by the person pauses the camera ride (zooming doesn't).
  for (const ev of ['dragstart', 'rotatestart', 'pitchstart']) {
    map.on(ev, (e) => {
      if (!state.follow || !e.originalEvent) return;
      userMoved = true;
      $('#hud-recenter').hidden = false;
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.follow && !document.querySelector('dialog[open]')) stopFollow();
  });
}

export async function startFollow(speciesId, animal, { fromStory = false } = {}) {
  if (state.story && !fromStory) ctl.stopStory();
  if (state.selected !== speciesId) await ctl.select(speciesId, { frame: false });
  animal = await fullAnimal(speciesId, animal); // a click in All migrations hands over a light copy
  if (!animal) return;
  const d = state.data.get(speciesId);
  if (!state.follow) prevMode = state.mode;
  setCloseUp(false, false);
  state.follow = { species: speciesId, animal, gap: d.maxGapHours };
  state.highlight = null;
  const [t0, t1] = [animal.pts[0][2], animal.pts[animal.pts.length - 1][2]];
  if (state.mode === 'season') {
    // Carry the time of year over to the animal's first year that has it.
    state.t = t0;
    const [y0, y1] = [t0, t1].map((h) => new Date(h * 3.6e6).getUTCFullYear());
    for (let y = y0; y <= y1; y++) {
      const h = seasonToHours(y, state.frac);
      if (h >= t0 && h <= t1) { state.t = h; break; }
    }
  } else if (!(state.t >= t0 && state.t <= t1)) state.t = t0;
  ctl.setMode('dates');
  refreshRoutes();
  userMoved = false;
  $('#hud-recenter').hidden = true;
  renderHud();
  setCurtain(animal.alt || null, colorFor(speciesId, 'dark'));
  document.body.classList.add('following');
  // On narrower screens the panel and the readout would squeeze the view: tuck the panel away.
  if (!panelWasTucked && window.innerWidth < 1400 && window.innerWidth >= 720 && !$('#panel').classList.contains('collapsed')) {
    $('#collapse-btn').click();
    panelWasTucked = true;
  }
  flyToAnimal(2600);
  emit('follow', state.follow);
  const sp = speciesById(speciesId);
  document.getElementById('sr-live').textContent = tr('Following {name} {id}. Press D to hear where it is, Escape to stop.', { name: sp.name, id: animal.id });
  ctl.frame();
}

export function stopFollow() {
  if (!state.follow) return;
  setCloseUp(false, false);
  state.follow = null;
  profile = null;
  setCurtain(null);
  $('#hud').hidden = true;
  document.body.classList.remove('following');
  if (panelWasTucked) {
    if ($('#panel').classList.contains('collapsed')) $('#collapse-btn').click();
    panelWasTucked = false;
  }
  ctl.setMode(prevMode || 'season');
  refreshRoutes();
  emit('follow', null);
  ctl.frame();
}

// Dive in to see the flight as walls of height (jumping ahead to the next
// flight if it's on the ground), or climb back out.
function setCloseUp(on, move = true) {
  closeUp = on;
  $('#hud-alt-3d').setAttribute('aria-pressed', String(on));
  $('#hud-alt-3d').textContent = tr(on ? 'Back out' : 'See it in 3D');
  if (!move || !state.follow) return;
  const alt = state.follow.animal.alt;
  if (on && alt && !nearestAlt(alt, state.t)) {
    const next = alt.find((a) => a[0] > state.t) || alt[0];
    state.t = next[0];
    ctl.frame();
  }
  if (on) ctl.setPlaying(false); // even at 1 day/s a stork crosses the close-up view in a blink
  userMoved = false;
  $('#hud-recenter').hidden = true;
  flyToAnimal(2400);
}

function headNow() {
  const f = state.follow;
  return positionAt(f.animal.pts, state.t, Infinity);
}

// Re-centre on the followed animal (e.g. once the map has finished loading).
export function recenterFollow() {
  if (!state.follow) return;
  userMoved = false;
  $('#hud-recenter').hidden = true;
  flyToAnimal(1600);
}

function flyToAnimal(duration) {
  const p = headNow();
  if (!p) return;
  const group = speciesById(state.follow.species).group;
  flying = true;
  map.flyTo({
    center: p, zoom: closeUp ? CLOSE_UP.zoom : ZOOM[group], pitch: closeUp ? CLOSE_UP.pitch : PITCH[group], bearing: map.getBearing(),
    padding: viewPadding(), duration: dur(duration), essential: true,
  }, { follow: true });
  map.once('moveend', () => { flying = false; });
}

// Called every frame by the playback loop.
export function followFrame() {
  const f = state.follow;
  if (!f) return;
  const head = headNow();
  if (head && !userMoved && !flying && !map.isZooming()) {
    const c = map.getCenter();
    let dLon = head[0] - c.lng;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const k = reducedMotion() ? 1 : 0.12; // reduced motion: jump, don't glide
    if (Math.abs(dLon) + Math.abs(head[1] - c.lat) > 1e-5) {
      map.jumpTo({ center: [c.lng + dLon * k, c.lat + (head[1] - c.lat) * k] });
    }
  }
  updateHud(head);
}

// ---------- the readout ----------

function renderHud() {
  const { species, animal } = state.follow;
  const sp = speciesById(species);
  const color = colorFor(species, 'dark');
  const hud = $('#hud');
  hud.style.setProperty('--sp', color);
  $('#hud-icon').innerHTML = iconHtml(species, 'sil sil-lg');
  $('#hud-title').textContent = sp.name;
  $('#hud-title').title = sp.name;
  $('#hud-sub').textContent = tr('Animal {id}', { id: animal.id });
  hud.hidden = false;
  drawProfile();
}

function updateHud(head) {
  const { species, animal, gap } = state.follow;
  const sp = speciesById(species);
  const pts = animal.pts;
  const t = state.t;
  $('#hud-date').textContent = fmtDate(t);
  const v = speedAt(pts, animal.cum, t, 24, gap);
  const moving = !!positionAt(pts, t, gap);
  $('#hud-speed').textContent = v == null ? '—' : fmtSpeed(v);
  const stop = animal.stops?.find(([, , a, b]) => t >= a && t <= b);
  $('#hud-speed-note').textContent = !moving ? tr('not tracked right now')
    : stop ? tr('staying put · day {n} of {total} here', { n: Math.floor((t - stop[2]) / 24) + 1, total: Math.max(1, Math.round((stop[3] - stop[2]) / 24)) })
      : tr('over the last day');
  $('#hud-dist').textContent = fmtDist(distanceAt(pts, animal.cum, t));
  $('#hud-dist-note').textContent = tr('of {n}', { n: fmtDist(animal.km) });
  const day = Math.max(0, Math.floor((t - pts[0][2]) / 24)) + 1;
  $('#hud-day').textContent = tr('Day {n}', { n: num(Math.min(day, animal.days + 1)) });
  $('#hud-day-note').textContent = tr('of {n} tracked', { n: num(animal.days + 1) });
  // Ground height under the animal (land) or the straight-line distance from the start.
  let place = '—';
  let note = '';
  if (head && sp.group === 'land' && settings.terrain && map.getTerrain()) {
    const z = map.queryTerrainElevation(head);
    if (z) { // 0 or null: terrain tiles not loaded yet
      const m = z / (settings.exaggeration || 1);
      place = settings.units === 'mi' ? `${num(Math.round(m * 3.28084))} ft` : `${num(Math.round(m))} m`;
      note = tr('ground height');
    }
  }
  if (note === '' && head) {
    place = fmtDist(haversineKm(pts[0], head));
    note = tr('from where it started');
  }
  $('#hud-place').textContent = place;
  $('#hud-place-note').textContent = note;
  // Human footprint under the nearest fix (land animals and birds; none at sea).
  const hi = animal.hf ? indexAtOrBefore(pts, t) : -1;
  const hfv = hi >= 0 ? animal.hf[hi] : -1;
  $('#hud-hf').hidden = hfv < 0;
  if (hfv >= 0) {
    $('#hud-hf-mark').style.left = `${hfv}%`;
    $('#hud-hf-val').textContent = `${hfv} / 100${animal.hfSummary ? ` · ${tr('its median {n}', { n: animal.hfSummary.median })}` : ''}`;
  }
  // Conditions at the nearest fix (NASA greenness on land, sea temperature at sea).
  const condKey = state.data.get(species)?.condKey;
  const cv = animal.cond && hi >= 0 ? animal.cond[hi] : null;
  $('#hud-cond').hidden = cv == null;
  if (cv != null) {
    $('#hud-cond-label').textContent = tr(condKey === 'sst' ? 'Sea temperature here' : 'Greenness here (NDVI)');
    $('#hud-cond-val').textContent = condKey === 'sst' ? `${num(+cv.toFixed(1))} °C` : num(+cv.toFixed(2));
    const frac = condKey === 'sst' ? cv / 32 : cv;
    $('#hud-cond-mark').style.left = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    $('#hud-cond-bar').style.background = `linear-gradient(90deg, ${(state.assets?.layers?.[condKey]?.stops || []).join(',')})`;
  }
  // Wind 100 m up along its heading, for the travelling step it's on.
  $('#hud-wind').hidden = !animal.wind;
  if (animal.wind) {
    const w = windAt(animal.wind, t);
    const kmh = (v) => `${Math.round(settings.units === 'mi' ? v * 0.621371 : v)} ${settings.units === 'mi' ? 'mph' : 'km/h'}`;
    $('#hud-wind-val').textContent = !w ? tr('resting, or no reading')
      : Math.abs(w[2]) >= Math.abs(w[3]) ? tr(w[2] >= 0 ? '{v} tailwind' : '{v} headwind', { v: kmh(Math.abs(w[2])) })
        : tr(w[3] >= 0 ? '{v} crosswind from the left' : '{v} crosswind from the right', { v: kmh(Math.abs(w[3])) });
  }
  // Flight height above the ground, from the in-flight GPS reading nearest now (within 3 h).
  const alt = animal.alt ? nearestAlt(animal.alt, t) : null;
  $('#hud-alt').hidden = !animal.alt;
  if (animal.alt) {
    $('#hud-alt-val').textContent = alt && alt[4] != null
      ? tr('{h} above the ground', { h: settings.units === 'mi' ? `${num(Math.round(alt[4] * 3.28084))} ft` : `${num(alt[4])} m` })
      : tr('not flying right now');
  }
  profile?.move(t);
}

// ---------- the journey profile (two small multiples sharing time) ----------

// The wind step [t0, t1, tail, cross, kmDay] the animal is on at t, if travelling.
function windAt(wind, t) {
  let lo = 0, hi = wind.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (wind[mid][0] <= t) lo = mid; else hi = mid - 1; }
  const w = wind[lo];
  return w && t >= w[0] && t <= w[1] ? w : null;
}

function nearestAlt(alt, t) {
  let lo = 0, hi = alt.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (alt[mid][0] < t) lo = mid + 1; else hi = mid; }
  const cands = [alt[lo], alt[lo - 1]].filter(Boolean);
  const best = cands.sort((a, b) => Math.abs(a[0] - t) - Math.abs(b[0] - t))[0];
  return best && Math.abs(best[0] - t) <= 3 ? best : null;
}

function drawProfile() {
  const { species, animal, gap } = state.follow;
  const el = $('#hud-profile');
  el.innerHTML = '';
  const pts = animal.pts;
  const axis = mainAxis([pts]);
  const color = colorFor(species, colorMode() === 'dark' ? 'dark' : 'light');
  const W = el.clientWidth || 300;
  const rowH = 56;
  const m = { l: 38, r: 8, t: 18, b: 18 };
  // A third row when we have conditions (land/sea) or flight heights (birds).
  const condKey = state.data.get(species)?.condKey;
  const third = animal.cond ? { kind: 'cond', label: tr(condKey === 'sst' ? 'Sea temperature (°C)' : 'Greenness (NDVI)') }
    : animal.alt ? { kind: 'alt', label: tr('Height above ground ({u})', { u: settings.units === 'mi' ? 'ft' : 'm' }) }
      : animal.wind ? { kind: 'wind', label: tr('Tailwind 100 m up (km/h)') } : null;
  const H = m.t + rowH * (third ? 3 : 2) + 22 * (third ? 2 : 1) + m.b;
  const x = d3.scaleTime().domain([pts[0][2] * 3.6e6, pts[pts.length - 1][2] * 3.6e6]).range([m.l, W - m.r]);

  // Series: position along the main axis, and speed per leg (km/day).
  const posSeries = pts.map((p, i) => ({ t: p[2], v: axis === 'lat' ? p[1] : p[0], gap: i > 0 && p[2] - pts[i - 1][2] > gap }));
  const speedSeries = [];
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i][2] - pts[i - 1][2];
    const broken = dt > gap;
    speedSeries.push({ t: (pts[i][2] + pts[i - 1][2]) / 2, v: broken ? null : kmIn((haversineKm(pts[i - 1], pts[i]) / dt) * 24), gap: broken });
  }
  const yPos = d3.scaleLinear().domain(d3.extent(posSeries, (d) => d.v)).nice(3).range([m.t + rowH, m.t]);
  const speedMax = d3.quantile(speedSeries.filter((d) => d.v != null).map((d) => d.v).sort(d3.ascending), 0.98) || 1;
  const ySpd = d3.scaleLinear().domain([0, speedMax]).nice(3).range([m.t + rowH * 2 + 22, m.t + rowH + 22]);

  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', tr(axis === 'lat' ? 'Journey profile for animal {id}: latitude and speed over time' : 'Journey profile for animal {id}: longitude and speed over time', { id: animal.id }));

  const grid = (y, label, fmt = d3.format('~s')) => {
    const g = svg.append('g').attr('class', 'axis');
    g.selectAll('line').data(y.ticks(3)).join('line')
      .attr('x1', m.l).attr('x2', W - m.r).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
    g.selectAll('text').data(y.ticks(3)).join('text')
      .attr('x', m.l - 5).attr('y', (d) => y(d) + 3).attr('text-anchor', 'end').text(fmt);
    svg.append('text').attr('class', 'row-label').attr('x', W - m.r).attr('y', y.range()[1] - 6).attr('text-anchor', 'end').text(label);
  };
  const deg = tr(axis === 'lat' ? 'Latitude' : 'Longitude');
  grid(yPos, deg, (v) => {
    const w = axis === 'lon' ? ((v + 540) % 360) - 180 : v;
    return `${Math.abs(+w.toFixed(1))}°${axis === 'lat' ? (w >= 0 ? 'N' : 'S') : (w >= 0 ? 'E' : 'W')}`;
  });
  grid(ySpd, tr('Speed ({u}/day)', { u: settings.units }));

  const line = (y) => d3.line().defined((d) => d.v != null && !d.gap).x((d) => x(d.t * 3.6e6)).y((d) => y(d.v)).curve(d3.curveMonotoneX);
  svg.append('path').datum(posSeries).attr('class', 'series').attr('stroke', color).attr('d', line(yPos));
  svg.append('path').datum(speedSeries).attr('class', 'area').attr('fill', color)
    .attr('d', d3.area().defined((d) => d.v != null).x((d) => x(d.t * 3.6e6)).y0(ySpd(0)).y1((d) => ySpd(d.v)).curve(d3.curveMonotoneX));
  svg.append('path').datum(speedSeries).attr('class', 'series').attr('stroke', color).attr('d', line(ySpd));
  if (third) {
    const top = m.t + rowH * 2 + 44;
    if (third.kind === 'cond') {
      const series = pts.map((p, i) => ({ t: p[2], v: animal.cond[i], gap: false }));
      const ext = d3.extent(series.filter((d) => d.v != null), (d) => d.v);
      const y3 = d3.scaleLinear().domain(ext[0] == null ? [0, 1] : ext).nice(3).range([top + rowH, top]);
      grid(y3, third.label, condKey === 'sst' ? d3.format('.0f') : d3.format('.1f'));
      svg.append('path').datum(series).attr('class', 'series').attr('stroke', color).attr('stroke-dasharray', null)
        .attr('d', d3.line().defined((d) => d.v != null).x((d) => x(d.t * 3.6e6)).y((d) => y3(d.v)).curve(d3.curveMonotoneX));
    } else if (third.kind === 'wind') {
      // One bar per travelling step, from the zero line: up for tailwind, down for headwind.
      const lim = Math.max(10, d3.max(animal.wind, (w) => Math.abs(w[2])) || 10);
      const y3 = d3.scaleLinear().domain([-lim, lim]).nice(2).range([top + rowH, top]);
      grid(y3, third.label, d3.format('d'));
      svg.append('g').selectAll('rect').data(animal.wind).join('rect')
        .attr('x', (w) => x(w[0] * 3.6e6)).attr('width', (w) => Math.max(1, x(w[1] * 3.6e6) - x(w[0] * 3.6e6)))
        .attr('y', (w) => y3(Math.max(0, w[2]))).attr('height', (w) => Math.abs(y3(w[2]) - y3(0)))
        .attr('fill', color).attr('opacity', (w) => (w[2] >= 0 ? 0.9 : 0.4));
      svg.append('line').attr('class', 'zero').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y3(0)).attr('y2', y3(0));
    } else {
      const f = settings.units === 'mi' ? 3.28084 : 1;
      const series = animal.alt.filter((a) => a[4] != null).map((a) => ({ t: a[0], v: Math.max(0, a[4]) * f }));
      const y3 = d3.scaleLinear().domain([0, d3.quantile(series.map((d) => d.v).sort(d3.ascending), 0.98) || 100]).nice(3).range([top + rowH, top]);
      grid(y3, third.label);
      svg.append('g').selectAll('circle').data(series).join('circle').attr('r', 1.6).attr('fill', color).attr('opacity', 0.7)
        .attr('cx', (d) => x(d.t * 3.6e6)).attr('cy', (d) => y3(Math.min(d.v, y3.domain()[1])));
    }
  }

  // Time axis
  svg.append('g').attr('class', 'axis x').attr('transform', `translate(0,${H - m.b + 2})`)
    .call(d3.axisBottom(x).ticks(4).tickSize(0).tickFormat(d3.utcFormat(pts[pts.length - 1][2] - pts[0][2] > 24 * 400 ? '%b %Y' : '%d %b')))
    .call((g) => g.select('.domain').remove());

  // Playhead + hover crosshair + scrub
  const head = svg.append('line').attr('class', 'playhead').attr('y1', m.t - 4).attr('y2', H - m.b);
  const cross = svg.append('line').attr('class', 'crosshair').attr('y1', m.t - 4).attr('y2', H - m.b).style('opacity', 0);
  const tip = d3.select('#hud-tip');
  const bisect = d3.bisector((d) => d.t).center;
  const scrub = (event) => {
    const [px] = d3.pointer(event);
    const t = Math.max(pts[0][2], Math.min(pts[pts.length - 1][2], x.invert(px) / 3.6e6));
    state.t = t;
    ctl.frame();
  };
  svg.append('rect').attr('class', 'hit').attr('x', m.l).attr('y', 0).attr('width', W - m.l - m.r).attr('height', H)
    .on('pointermove', (event) => {
      const [px] = d3.pointer(event);
      const t = x.invert(px) / 3.6e6;
      const p = posSeries[bisect(posSeries, t)];
      const s = speedSeries[Math.max(0, Math.min(speedSeries.length - 1, bisect(speedSeries, t)))];
      cross.attr('x1', px).attr('x2', px).style('opacity', 1);
      tip.style('opacity', 1).style('left', `${Math.min(px, W - 130)}px`);
      tip.html('');
      tip.append('div').attr('class', 'tip-date').text(fmtDate(t));
      const w = axis === 'lon' ? ((p.v + 540) % 360) - 180 : p.v;
      tip.append('div').html(`<b>${Math.abs(w).toFixed(2)}°${axis === 'lat' ? (w >= 0 ? 'N' : 'S') : (w >= 0 ? 'E' : 'W')}</b> <span>${axis === 'lat' ? 'latitude' : 'longitude'}</span>`);
      tip.append('div').html(s && s.v != null ? `<b>${esc(fmtSpeed(s.v / (settings.units === 'mi' ? 0.621371 : 1)))}</b> <span>speed</span>` : '<span>not tracked</span>');
      if (event.buttons) scrub(event);
    })
    .on('pointerleave', () => { cross.style('opacity', 0); tip.style('opacity', 0); })
    .on('pointerdown', (event) => { ctl.setPlaying(false); scrub(event); });

  profile = {
    move(t) {
      const px = x(t * 3.6e6);
      head.attr('x1', px).attr('x2', px);
    },
  };
  profile.move(state.t);
}

window.addEventListener('resize', () => { if (state.follow) drawProfile(); });
