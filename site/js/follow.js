// Follow one animal: the camera rides along, a readout shows where it is and
// how fast it's going, and a profile of the whole journey can be scrubbed.

import { positionAt, distanceAt, speedAt, mainAxis, haversineKm, indexAtOrBefore } from './tracks.js';
import { colorFor } from './palette.js';
import { settings } from './settings.js';
import { map, colorMode, refreshRoutes, viewPadding } from './globe.js';
import {
  state, emit, speciesById, fmtDate, fmtDist, fmtSpeed, esc, iconHtml, kmIn,
} from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null;          // { select, setMode, setPlaying, frame }
let prevMode = null;
let userMoved = false;
let flying = false;
let profile = null;      // the drawn profile chart (for the playhead)
let panelWasTucked = false;

const ZOOM = { land: 9.2, marine: 4.6, birds: 4.4 };
const PITCH = { land: 58, marine: 35, birds: 35 };

export function initFollow(controller) {
  ctl = controller;
  $('#hud-close').addEventListener('click', () => stopFollow());
  $('#hud-recenter').addEventListener('click', () => {
    userMoved = false;
    $('#hud-recenter').hidden = true;
    flyToAnimal(1200);
  });
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
  const d = state.data.get(speciesId);
  if (!state.follow) prevMode = state.mode;
  state.follow = { species: speciesId, animal, gap: d.maxGapHours };
  state.highlight = null;
  const [t0, t1] = [animal.pts[0][2], animal.pts[animal.pts.length - 1][2]];
  if (!(state.t >= t0 && state.t <= t1)) {
    // In Season view, carry the time of year over to the animal's first year.
    state.t = t0;
  }
  ctl.setMode('dates');
  refreshRoutes();
  userMoved = false;
  $('#hud-recenter').hidden = true;
  renderHud();
  document.body.classList.add('following');
  // On narrower screens the panel and the readout would squeeze the view: tuck the panel away.
  if (!panelWasTucked && window.innerWidth < 1400 && window.innerWidth >= 720 && !$('#panel').classList.contains('collapsed')) {
    $('#collapse-btn').click();
    panelWasTucked = true;
  }
  flyToAnimal(2600);
  emit('follow', state.follow);
  ctl.frame();
}

export function stopFollow() {
  if (!state.follow) return;
  state.follow = null;
  profile = null;
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
    center: p, zoom: ZOOM[group], pitch: PITCH[group], bearing: map.getBearing(),
    padding: viewPadding(), duration, essential: true,
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
    const k = 0.12;
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
  $('#hud-sub').textContent = `Animal ${animal.id}`;
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
  $('#hud-speed-note').textContent = !moving ? 'not tracked right now'
    : stop ? `staying put · day ${Math.floor((t - stop[2]) / 24) + 1} of ${Math.max(1, Math.round((stop[3] - stop[2]) / 24))} here`
      : 'over the last day';
  $('#hud-dist').textContent = fmtDist(distanceAt(pts, animal.cum, t));
  $('#hud-dist-note').textContent = `of ${fmtDist(animal.km)}`;
  const day = Math.max(0, Math.floor((t - pts[0][2]) / 24)) + 1;
  $('#hud-day').textContent = `Day ${Math.min(day, animal.days + 1).toLocaleString()}`;
  $('#hud-day-note').textContent = `of ${(animal.days + 1).toLocaleString()} tracked`;
  // Ground height under the animal (land) or the straight-line distance from the start.
  let place = '—';
  let note = '';
  if (head && sp.group === 'land' && settings.terrain && map.getTerrain()) {
    const z = map.queryTerrainElevation(head);
    if (z) { // 0 or null: terrain tiles not loaded yet
      const m = z / (settings.exaggeration || 1);
      place = settings.units === 'mi' ? `${Math.round(m * 3.28084).toLocaleString()} ft` : `${Math.round(m).toLocaleString()} m`;
      note = 'ground height';
    }
  }
  if (note === '' && head) {
    place = fmtDist(haversineKm(pts[0], head));
    note = 'from where it started';
  }
  $('#hud-place').textContent = place;
  $('#hud-place-note').textContent = note;
  // Human footprint under the nearest fix (land animals and birds; none at sea).
  const hi = animal.hf ? indexAtOrBefore(pts, t) : -1;
  const hfv = hi >= 0 ? animal.hf[hi] : -1;
  $('#hud-hf').hidden = hfv < 0;
  if (hfv >= 0) {
    $('#hud-hf-mark').style.left = `${hfv}%`;
    $('#hud-hf-val').textContent = `${hfv} / 100${animal.hfSummary ? ` · its median ${animal.hfSummary.median}` : ''}`;
  }
  profile?.move(t);
}

// ---------- the journey profile (two small multiples sharing time) ----------

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
  const H = m.t + rowH * 2 + 22 + m.b;
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
    .attr('role', 'img').attr('aria-label', `Journey profile for animal ${animal.id}: ${axis === 'lat' ? 'latitude' : 'longitude'} and speed over time`);

  const grid = (y, label, fmt = d3.format('~s')) => {
    const g = svg.append('g').attr('class', 'axis');
    g.selectAll('line').data(y.ticks(3)).join('line')
      .attr('x1', m.l).attr('x2', W - m.r).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
    g.selectAll('text').data(y.ticks(3)).join('text')
      .attr('x', m.l - 5).attr('y', (d) => y(d) + 3).attr('text-anchor', 'end').text(fmt);
    svg.append('text').attr('class', 'row-label').attr('x', W - m.r).attr('y', y.range()[1] - 6).attr('text-anchor', 'end').text(label);
  };
  const deg = axis === 'lat' ? 'Latitude' : 'Longitude';
  grid(yPos, deg, (v) => {
    const w = axis === 'lon' ? ((v + 540) % 360) - 180 : v;
    return `${Math.abs(+w.toFixed(1))}°${axis === 'lat' ? (w >= 0 ? 'N' : 'S') : (w >= 0 ? 'E' : 'W')}`;
  });
  grid(ySpd, `Speed (${settings.units}/day)`);

  const line = (y) => d3.line().defined((d) => d.v != null && !d.gap).x((d) => x(d.t * 3.6e6)).y((d) => y(d.v)).curve(d3.curveMonotoneX);
  svg.append('path').datum(posSeries).attr('class', 'series').attr('stroke', color).attr('d', line(yPos));
  svg.append('path').datum(speedSeries).attr('class', 'area').attr('fill', color)
    .attr('d', d3.area().defined((d) => d.v != null).x((d) => x(d.t * 3.6e6)).y0(ySpd(0)).y1((d) => ySpd(d.v)).curve(d3.curveMonotoneX));
  svg.append('path').datum(speedSeries).attr('class', 'series').attr('stroke', color).attr('d', line(ySpd));

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
