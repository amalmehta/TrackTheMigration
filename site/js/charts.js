// Linked charts under the globe.
//  • All migrations: a migration calendar — when each species moves most.
//  • One species: where the animals are through the year (brush to pick
//    animals), how far they move each month, and how far each animal went.
// Charts and globe share one clock and one selection.

import { seasonalMovement, mainAxis, yearFraction, seasonToHours } from './tracks.js';
import { colorFor } from './palette.js';
import { settings, isDark } from './settings.js';
import {
  state, emit, on, speciesById, keyOf, MONTHS, MONTHS_LONG, fmtSeason, fmtDist, fmtSpeed, kmIn, iconHtml,
  isVisible, animalColor, facetShades, facetsOf, busiestMonths, viewData,
} from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null;   // { select, setMode, setPlaying, frame, follow, setHighlight }
let open = false;
let tableView = false;
let playheads = [];   // functions that move each chart's playhead
const tip = () => d3.select('#chart-tip');

const uiMode = () => (isDark() ? 'dark' : 'light');
const nowFraction = () => (state.mode === 'season' ? state.frac : yearFraction(state.t));

export function initCharts(controller) {
  ctl = controller;
  $('#charts-btn').addEventListener('click', () => setOpen(!open));
  $('#charts-close').addEventListener('click', () => setOpen(false));
  $('#charts-table').addEventListener('click', () => {
    tableView = !tableView;
    $('#charts-table').setAttribute('aria-pressed', String(tableView));
    $('#charts-table').textContent = tableView ? 'Charts' : 'Table';
    renderCharts();
  });
  $('#charts-clear').addEventListener('click', () => ctl.setHighlight(null));
  on('highlight', () => { $('#charts-clear').hidden = !state.highlight; if (open) renderCharts(); });
  window.addEventListener('resize', () => { if (open) renderCharts(); });
}

export function setOpen(v) {
  open = v;
  $('#charts').hidden = !v;
  document.body.classList.toggle('charts-open', v);
  $('#charts-btn').setAttribute('aria-pressed', String(v));
  if (v) renderCharts();
  emit('charts', v);
}
export const chartsOpen = () => open;

export function chartsTime() {
  if (!open) return;
  const f = nowFraction();
  for (const move of playheads) move(f);
}

export function renderCharts() {
  if (!open || !state.index) return;
  playheads = [];
  const body = $('#charts-body');
  body.innerHTML = '';
  $('#charts-clear').hidden = !state.highlight;
  if (state.selected === 'all') {
    $('#charts-title').textContent = 'Migration calendar';
    $('#charts-sub').textContent = 'How far each species moves through the year. Each row is scaled to its own busiest fortnight. Click a row to open that migration, or a cell to jump there.';
    if (tableView) calendarTable(body); else calendar(body);
  } else {
    const sp = speciesById(state.selected);
    $('#charts-title').textContent = `${sp.name}: the year in motion`;
    $('#charts-sub').textContent = 'Drag a box on the left chart to pick animals (the globe dims the rest). Click a line or a bar to follow that animal.';
    if (tableView) speciesTables(body, sp); else speciesCharts(body, sp);
  }
  chartsTime();
}

// ---------- shared bits ----------

function showTip(event, rows) {
  const t = tip();
  t.html('');
  for (const [value, label, cls] of rows) {
    const row = t.append('div').attr('class', cls || '');
    if (value != null) row.append('b').text(value);
    if (label) row.append('span').text(value != null ? ` ${label}` : label);
  }
  const box = $('#charts').getBoundingClientRect();
  const x = Math.min(event.clientX - box.left + 14, box.width - 220);
  t.style('left', `${x}px`).style('top', `${event.clientY - box.top - 10}px`).style('opacity', 1);
}
const hideTip = () => tip().style('opacity', 0);

const binLabel = (b, bins) => {
  const m = Math.floor((b * 12) / bins);
  if (bins === 12) return MONTHS_LONG[m];
  return `${b % 2 === 0 ? 'early' : 'late'} ${MONTHS_LONG[m]}`;
};

// Month names under a year axis: three letters when there's room, else one.
function monthAxis(svg, x, y, ticks = 12) {
  const g = svg.append('g').attr('class', 'axis x');
  const slot = Math.abs(x(1 / 12) - x(0));
  for (let i = 0; i < ticks; i++) {
    g.append('text').attr('x', x((i + 0.5) / 12)).attr('y', y).attr('text-anchor', 'middle')
      .text(slot >= 24 ? MONTHS[i] : MONTHS[i][0]);
  }
}

function addPlayhead(svg, x, y1, y2) {
  const line = svg.append('line').attr('class', 'playhead').attr('y1', y1).attr('y2', y2);
  playheads.push((f) => line.attr('x1', x(f)).attr('x2', x(f)));
}

function movementFor(id, bins) {
  const d = viewData(id);
  return seasonalMovement(d.animals.map((a) => a.pts), bins, d.maxGapHours);
}

// ---------- all species: the migration calendar ----------

function calendar(body) {
  const BINS = 24;
  const rows = state.index.species.map((s) => ({ s, mv: movementFor(s.id, BINS) }));
  const W = body.clientWidth;
  const labelW = Math.min(170, W * 0.3);
  const rowH = 20;
  const top = 18;
  const H = top + rows.length * rowH + 4;
  const x = d3.scaleLinear().domain([0, 1]).range([labelW, W - 8]);
  const cellW = (x(1) - x(0)) / BINS;
  const svg = d3.select(body).append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', 'Migration calendar: how far each species moves in each half-month');
  monthAxis(svg, x, 11);

  rows.forEach(({ s, mv }, r) => {
    const y = top + r * rowH;
    const max = d3.max(mv.kmPerDay) || 1;
    const color = colorFor(s.id, uiMode());
    const g = svg.append('g').attr('class', 'cal-row');
    const label = g.append('g').attr('class', 'row-link').attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', `Open ${s.name}`)
      .on('click', () => ctl.select(s.id))
      .on('keydown', (e) => { if (e.key === 'Enter') ctl.select(s.id); });
    label.append('rect').attr('x', 0).attr('y', y).attr('width', labelW - 8).attr('height', rowH - 2).attr('fill', 'transparent');
    label.append('foreignObject').attr('x', 0).attr('y', y + 1).attr('width', 18).attr('height', 16)
      .html(`<div xmlns="http://www.w3.org/1999/xhtml" style="color:${color}">${iconHtml(s.id, 'sil sil-sm')}</div>`);
    label.append('text').attr('x', 24).attr('y', y + rowH / 2 + 3).attr('class', 'row-name').text(s.name);
    mv.kmPerDay.forEach((v, b) => {
      const k = v == null ? 0 : v / max;
      g.append('rect')
        .attr('class', 'cell').attr('x', x(b / BINS) + 1).attr('y', y).attr('width', cellW - 2).attr('height', rowH - 2).attr('rx', 3)
        .attr('fill', v == null ? 'var(--grid)' : color).attr('fill-opacity', v == null ? 0.5 : 0.08 + 0.92 * Math.pow(k, 0.85))
        .on('pointermove', (event) => showTip(event, v == null
          ? [[null, `${s.name} · ${binLabel(b, BINS)}`, 'tip-date'], [null, 'not tracked']]
          : [[null, `${s.name} · ${binLabel(b, BINS)}`, 'tip-date'], [fmtSpeed(v), 'on average'], [`${Math.round(mv.days[b]).toLocaleString()}`, 'days of tracking']]))
        .on('pointerleave', hideTip)
        .on('click', () => {
          ctl.setMode('season');
          state.frac = (b + 0.5) / BINS;
          ctl.frame();
        });
    });
  });
  addPlayhead(svg, x, top - 4, H - 2);

  // Scale key: one hue, light → dark, per row.
  const key = d3.select(body).append('div').attr('class', 'chart-key');
  key.append('span').attr('class', 'key-ramp');
  key.append('span').text('quiet → busiest fortnight for that species · grey: no tracking');
}

function calendarTable(body) {
  const table = d3.select(body).append('div').attr('class', 'table-wrap').append('table');
  const head = table.append('thead').append('tr');
  head.append('th').text(`Average ${settings.units}/day`);
  MONTHS.forEach((m) => head.append('th').text(m));
  const tb = table.append('tbody');
  for (const s of state.index.species) {
    const mv = movementFor(s.id, 12);
    const tr = tb.append('tr');
    tr.append('th').text(s.name);
    mv.kmPerDay.forEach((v) => tr.append('td').text(v == null ? '—' : d3.format(',.1f')(kmIn(v))));
  }
}

// ---------- one species ----------

// The species' data with filtered-out animals removed (the Who filter).
const visibleData = (id) => {
  const d = state.data.get(id);
  return { ...d, animals: d.animals.filter(isVisible) };
};

function speciesCharts(body, sp) {
  const d = visibleData(sp.id);
  if (!d.animals.length) {
    d3.select(body).append('p').attr('class', 'muted').text('Every animal is filtered out. Switch a group back on in the panel.');
    return;
  }
  const grid = d3.select(body).append('div').attr('class', 'chart-grid');
  const a = grid.append('figure').attr('class', 'chart-card wide');
  const b = grid.append('figure').attr('class', 'chart-card');
  const c = grid.append('figure').attr('class', 'chart-card');
  yearLines(a, sp, d);
  monthColumns(b, sp, d);
  distanceColumns(c, sp, d);
  if (d.sites?.length) siteBars(grid.append('figure').attr('class', 'chart-card'), sp, d);
  if (d.animals.some((a) => a.hf)) footprintBars(grid.append('figure').attr('class', 'chart-card'), sp, d);
  if (d.animals.some((a) => a.cond)) conditionsByMonth(grid.append('figure').attr('class', 'chart-card'), sp, d);
}

// The conditions they met, month by month: median, and the middle half of fixes as a band.
function conditionsByMonth(fig, sp, d) {
  const sst = d.condKey === 'sst';
  fig.append('figcaption').text(sst ? 'Sea temperature where they were' : 'Greenness where they were')
    .append('small').text(sst ? ' · °C, by month' : ' · NDVI, by month');
  const months = Array.from({ length: 12 }, () => []);
  for (const a of d.animals) {
    if (!a.cond) continue;
    a.pts.forEach((p, i) => { if (a.cond[i] != null) months[new Date(p[2] * 3.6e6).getUTCMonth()].push(a.cond[i]); });
  }
  const stats = months.map((v, i) => {
    if (v.length < 5) return { i, n: v.length };
    v.sort(d3.ascending);
    return { i, n: v.length, q1: d3.quantile(v, 0.25), med: d3.quantile(v, 0.5), q3: d3.quantile(v, 0.75) };
  });
  const ok = stats.filter((s) => s.med != null);
  const node = fig.node();
  const W = node.clientWidth || 260;
  const H = 168;
  const m = { l: 34, r: 8, t: 12, b: 20 };
  const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([d3.min(ok, (s) => s.q1), d3.max(ok, (s) => s.q3)]).nice(4).range([H - m.b, m.t]);
  const color = colorFor(sp.id, uiMode());
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', `${sp.name}: ${sst ? 'sea temperature' : 'vegetation greenness'} where they were, by month`);
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end').text(sst ? d3.format('.0f') : d3.format('.1f'));
  monthAxis(svg, x, H - 5);
  const cx = (s) => x((s.i + 0.5) / 12);
  svg.append('path').datum(ok).attr('fill', color).attr('fill-opacity', 0.14)
    .attr('d', d3.area().x(cx).y0((s) => y(s.q1)).y1((s) => y(s.q3)).curve(d3.curveMonotoneX));
  svg.append('path').datum(ok).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2)
    .attr('d', d3.line().x(cx).y((s) => y(s.med)).curve(d3.curveMonotoneX));
  svg.append('g').selectAll('circle').data(ok).join('circle').attr('cx', cx).attr('cy', (s) => y(s.med)).attr('r', 4)
    .attr('fill', color).attr('stroke', 'var(--surface)').attr('stroke-width', 2)
    .on('pointermove', (event, s) => showTip(event, [[null, MONTHS_LONG[s.i], 'tip-date'],
      [sst ? `${s.med.toFixed(1)} °C` : s.med.toFixed(2), 'median'],
      [null, `middle half ${sst ? `${s.q1.toFixed(1)}–${s.q3.toFixed(1)} °C` : `${s.q1.toFixed(2)}–${s.q3.toFixed(2)}`}`],
      [`${s.n.toLocaleString()}`, 'fixes']]))
    .on('pointerleave', hideTip);
  playheads.push((f) => svg.selectAll('circle').attr('r', (s) => (s.i === Math.min(11, Math.floor(f * 12)) ? 6 : 4)));
}

// Share of time spent at each level of human footprint, per group (the
// colour-by facet, else where they were tagged, else everyone).
const HF_BANDS = [[0, 9, 'wild 0–9'], [10, 24, 'light 10–24'], [25, 49, 'moderate 25–49'], [50, 100, 'heavy 50+']];
const HF_COLORS = ['#3f8f3a', '#b9c94a', '#e6923a', '#c8402f']; // ordinal: footprint low → high
function footprintBars(fig, sp, d) {
  fig.append('figcaption').text('Human footprint where they went').append('small').text(' · share of fixes');
  const key = state.colorBy || (facetsOf(sp.id).some((f) => f.key === 'site') ? 'site' : null);
  const groups = new Map();
  for (const a of d.animals) {
    if (!a.hf) continue;
    const g = key ? (a.attrs?.[key] || 'unknown') : 'All animals';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(...a.hf.filter((v) => v >= 0));
  }
  const rows = [...groups].filter(([, v]) => v.length).map(([g, v]) => {
    v.sort((a, b) => a - b);
    return { g, median: v[Math.floor(v.length / 2)], shares: HF_BANDS.map(([lo, hi]) => v.filter((x) => x >= lo && x <= hi).length / v.length) };
  }).sort((a, b) => a.median - b.median);
  const node = fig.node();
  const W = node.clientWidth || 260;
  const rowH = 24;
  const m = { l: key ? 96 : 8, r: 64, t: 4 };
  const H = m.t + rows.length * rowH + 30;
  const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', `${sp.name}: share of time at each level of human footprint`);
  rows.forEach((r, k) => {
    const y = m.t + k * rowH;
    if (key) svg.append('text').attr('class', 'row-name').attr('x', 0).attr('y', y + 14).text(r.g.charAt(0).toUpperCase() + r.g.slice(1));
    let acc = 0;
    r.shares.forEach((share, b) => {
      if (share > 0) {
        svg.append('rect').attr('x', x(acc) + 1).attr('y', y + 3).attr('width', Math.max(0, x(acc + share) - x(acc) - 2)).attr('height', rowH - 8).attr('rx', 3)
          .attr('fill', HF_COLORS[b])
          .on('pointermove', (event) => showTip(event, [[null, r.g === 'All animals' ? sp.name : r.g, 'tip-date'], [`${Math.round(share * 100)}%`, `of fixes ${HF_BANDS[b][2]}`]]))
          .on('pointerleave', hideTip);
      }
      acc += share;
    });
    svg.append('text').attr('class', 'axis-note').attr('x', W - m.r + 6).attr('y', y + 14).text(`median ${r.median}`);
  });
  // Legend (ordinal bands)
  const lg = svg.append('g').attr('transform', `translate(${m.l},${H - 12})`);
  let lx = 0;
  HF_BANDS.forEach(([, , label], b) => {
    lg.append('rect').attr('x', lx).attr('y', -7).attr('width', 9).attr('height', 9).attr('rx', 2).attr('fill', HF_COLORS[b]);
    lg.append('text').attr('class', 'axis-note').attr('x', lx + 12).attr('y', 1).text(label.split(' ')[0]);
    lx += 14 + label.split(' ')[0].length * 6 + 8;
  });
}

// Legend for the colour-by facet (two or more groups), shown above a chart.
function facetLegend(fig, sp) {
  if (!state.colorBy) return;
  const facet = facetsOf(sp.id).find((f) => f.key === state.colorBy);
  if (!facet) return;
  const shades = facetShades(sp.id, facet.key, uiMode());
  const lg = fig.append('div').attr('class', 'chart-legend');
  for (const v of facet.values) {
    if (state.hidden.has(`${facet.key}=${v.value}`)) continue;
    const item = lg.append('span');
    item.append('i').style('background', shades.get(v.value));
    item.append('span').text(v.value.charAt(0).toUpperCase() + v.value.slice(1));
  }
}

function yearLines(fig, sp, d) {
  const axis = mainAxis(d.animals.map((a) => a.pts));
  fig.append('figcaption').text(axis === 'lat' ? 'Latitude through the year' : 'Longitude through the year')
    .append('small').text(axis === 'lat' ? ' · north is up' : ' · east is up');
  facetLegend(fig, sp);
  const node = fig.node();
  const W = node.clientWidth || 400;
  const H = 168;
  const m = { l: 40, r: 8, t: 8, b: 20 };
  const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
  const segs = [];
  for (const a of d.animals) {
    for (const s of a.years) {
      const len = seasonToHours(s.year + 1, 0) - s.start;
      const points = s.pts.map((p, i) => ({
        f: (p[2] - s.start) / len, v: axis === 'lat' ? p[1] : p[0],
        gap: i > 0 && p[2] - s.pts[i - 1][2] > d.maxGapHours,
      }));
      segs.push({ key: keyOf(sp.id, a), animal: a, year: s.year, points });
    }
  }
  const all = segs.flatMap((s) => s.points.filter((p) => p.f >= 0 && p.f <= 1));
  const y = d3.scaleLinear().domain(d3.extent(all, (p) => p.v)).nice(4).range([H - m.b, m.t]);
  const color = colorFor(sp.id, uiMode());
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', `${sp.name}: ${axis === 'lat' ? 'latitude' : 'longitude'} of each animal through the year`);
  svg.append('clipPath').attr('id', 'clip-year').append('rect').attr('x', m.l).attr('y', 0).attr('width', W - m.l - m.r).attr('height', H);
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end')
    .text((v) => fmtDeg(v, axis, y.ticks(4).some((t) => !Number.isInteger(t)) ? 1 : 0));
  monthAxis(svg, x, H - 5);

  const line = d3.line().defined((p) => !p.gap).x((p) => x(p.f)).y((p) => y(p.v)).curve(d3.curveMonotoneX);
  const hl = state.highlight;
  const paths = svg.append('g').attr('clip-path', 'url(#clip-year)').selectAll('path').data(segs).join('path')
    .attr('class', 'year-line').attr('stroke', (s) => animalColor(sp.id, s.animal, uiMode())).attr('d', (s) => line(s.points))
    .attr('stroke-opacity', (s) => (hl ? (hl.has(s.key) ? 0.95 : 0.08) : 0.4))
    .attr('stroke-width', (s) => (hl && hl.has(s.key) ? 1.8 : 1.2));
  addPlayhead(svg, x, m.t, H - m.b);

  // Nearest-line hover via a quadtree over every point.
  const flat = segs.flatMap((s) => s.points.filter((p) => p.f >= 0 && p.f <= 1).map((p) => ({ ...p, s, px: x(p.f), py: y(p.v) })));
  const qt = d3.quadtree().x((p) => p.px).y((p) => p.py).addAll(flat);
  const dot = svg.append('circle').attr('class', 'hover-dot').attr('r', 4).attr('fill', color).style('opacity', 0);
  let hovered = null;
  const nearest = (event) => {
    const [px, py] = d3.pointer(event, svg.node());
    return qt.find(px, py, 18);
  };

  // Brush to pick animals.
  const brush = d3.brush().extent([[m.l, m.t], [W - m.r, H - m.b]])
    .on('end', (event) => {
      if (!event.sourceEvent) return;
      if (!event.selection) {
        // A click, not a drag: follow the nearest line.
        const p = nearest(event.sourceEvent);
        if (p) ctl.follow(sp.id, p.s.animal);
        return;
      }
      const [[x0, y0], [x1, y1]] = event.selection;
      const keys = new Set(flat.filter((p) => p.px >= x0 && p.px <= x1 && p.py >= y0 && p.py <= y1).map((p) => p.s.key));
      ctl.setHighlight(keys.size ? keys : null);
    });
  const bg = svg.append('g').attr('class', 'brush').call(brush);
  bg.select('.overlay')
    .on('pointermove.hover', (event) => {
      const p = nearest(event);
      if (p === hovered) return;
      hovered = p;
      paths.attr('stroke-width', (s) => (p && s === p.s ? 2.4 : hl && hl.has(s.key) ? 1.8 : 1.2))
        .attr('stroke-opacity', (s) => (p && s === p.s ? 1 : hl ? (hl.has(s.key) ? 0.95 : 0.08) : 0.4));
      if (!p) { dot.style('opacity', 0); hideTip(); return; }
      dot.attr('cx', p.px).attr('cy', p.py).attr('fill', animalColor(sp.id, p.s.animal, uiMode())).style('opacity', 1);
      showTip(event, [
        [null, `Animal ${p.s.animal.id} · ${p.s.year}`, 'tip-date'],
        [fmtDeg(p.v, axis, 2), `on ${fmtSeason(Math.max(0, Math.min(0.999, p.f)))}`],
        [null, 'Click to follow', 'tip-hint'],
      ]);
    })
    .on('pointerleave.hover', () => { hovered = null; dot.style('opacity', 0); hideTip(); paths.attr('stroke-width', (s) => (hl && hl.has(s.key) ? 1.8 : 1.2)).attr('stroke-opacity', (s) => (hl ? (hl.has(s.key) ? 0.95 : 0.08) : 0.4)); });
}

function monthColumns(fig, sp, d) {
  fig.append('figcaption').text('Distance per day, by month');
  const mv = seasonalMovement(d.animals.map((a) => a.pts), 12, d.maxGapHours);
  const node = fig.node();
  const W = node.clientWidth || 260;
  const H = 168;
  const m = { l: 34, r: 6, t: 14, b: 20 };
  const vals = mv.kmPerDay.map((v) => (v == null ? null : kmIn(v)));
  const y = d3.scaleLinear().domain([0, d3.max(vals) || 1]).nice(4).range([H - m.b, m.t]);
  const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
  const color = colorFor(sp.id, uiMode());
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', `${sp.name}: average ${settings.units} per day in each month`);
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end').text(d3.format('~s'));
  monthAxis(svg, x, H - 5);
  const slot = (x(1) - x(0)) / 12;
  const bw = Math.min(24, slot - 4);
  const maxI = vals.indexOf(d3.max(vals));
  const bars = svg.append('g').selectAll('path').data(vals.map((v, i) => ({ v, i }))).join('path')
    .attr('class', 'bar').attr('fill', color)
    .attr('d', ({ v, i }) => (v == null ? '' : roundedTop(x(i / 12) + (slot - bw) / 2, y(v), bw, y(0) - y(v), 4)))
    .on('pointermove', (event, { v, i }) => {
      showTip(event, v == null ? [[null, MONTHS_LONG[i], 'tip-date'], [null, 'not tracked']]
        : [[null, MONTHS_LONG[i], 'tip-date'], [`${d3.format(',.1f')(v)} ${settings.units}/day`, 'on average'], [`${Math.round(mv.days[i]).toLocaleString()}`, 'days of tracking']]);
    })
    .on('pointerleave', hideTip);
  if (maxI >= 0 && vals[maxI] != null) {
    svg.append('text').attr('class', 'value-label').attr('x', x(maxI / 12) + slot / 2).attr('y', y(vals[maxI]) - 4).attr('text-anchor', 'middle')
      .text(d3.format(',.0f')(vals[maxI]));
  }
  playheads.push((f) => {
    const cur = Math.min(11, Math.floor(f * 12));
    bars.attr('fill-opacity', ({ i }) => (i === cur ? 1 : 0.55));
  });
}

function distanceColumns(fig, sp, d) {
  fig.append('figcaption').text('How far each animal went');
  const animals = [...d.animals].sort((p, q) => q.km - p.km);
  facetLegend(fig, sp);
  const node = fig.node();
  const W = node.clientWidth || 260;
  const H = 168;
  const m = { l: 40, r: 6, t: 14, b: 20 };
  const y = d3.scaleLinear().domain([0, kmIn(animals[0].km)]).nice(4).range([H - m.b, m.t]);
  const x = d3.scaleBand().domain(animals.map((a) => a.id)).range([m.l, W - m.r]).paddingInner(0.2);
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', `${sp.name}: distance tracked for each animal, longest first`);
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end').text(d3.format('~s'));
  svg.append('text').attr('class', 'axis-note').attr('x', m.l).attr('y', H - 5).text(`${animals.length} animals, longest first · ${settings.units}`);
  const hl = state.highlight;
  const bw = Math.min(24, x.bandwidth());
  svg.append('g').selectAll('path').data(animals).join('path')
    .attr('class', 'bar clickable').attr('fill', (a) => animalColor(sp.id, a, uiMode()))
    .attr('fill-opacity', (a) => (hl ? (hl.has(keyOf(sp.id, a)) ? 1 : 0.18) : 0.85))
    .attr('d', (a) => roundedTop(x(a.id) + (x.bandwidth() - bw) / 2, y(kmIn(a.km)), bw, y(0) - y(kmIn(a.km)), Math.min(4, bw / 2)))
    .on('pointermove', (event, a) => showTip(event, [[null, `Animal ${a.id}`, 'tip-date'], [fmtDist(a.km), `over ${a.days.toLocaleString()} days`], [null, 'Click to follow', 'tip-hint']]))
    .on('pointerleave', hideTip)
    .on('click', (_, a) => ctl.follow(sp.id, a));
  // Wider invisible hit targets for thin bars.
  svg.append('g').selectAll('rect').data(animals).join('rect')
    .attr('x', (a) => x(a.id) - 2).attr('width', x.bandwidth() + 4).attr('y', m.t).attr('height', H - m.t - m.b)
    .attr('fill', 'transparent').style('cursor', 'pointer')
    .on('pointermove', (event, a) => showTip(event, [[null, `Animal ${a.id}`, 'tip-date'], [fmtDist(a.km), `over ${a.days.toLocaleString()} days`], [null, 'Click to follow', 'tip-hint']]))
    .on('pointerleave', hideTip)
    .on('click', (_, a) => ctl.follow(sp.id, a));
  const top = animals[0];
  svg.append('text').attr('class', 'value-label').attr('x', x(top.id) + x.bandwidth() / 2 + 4).attr('y', y(kmIn(top.km)) - 4)
    .text(`${top.id}: ${fmtDist(top.km)}`);
}

function speciesTables(body, sp) {
  const d = visibleData(sp.id);
  const wrap = d3.select(body).append('div').attr('class', 'table-wrap two');
  const mv = seasonalMovement(d.animals.map((a) => a.pts), 12, d.maxGapHours);
  const t1 = wrap.append('table');
  t1.append('caption').text('Distance per day, by month');
  t1.append('thead').append('tr').call((tr) => { tr.append('th').text('Month'); tr.append('th').text(`${settings.units}/day`); tr.append('th').text('Days tracked'); });
  const b1 = t1.append('tbody');
  mv.kmPerDay.forEach((v, i) => {
    const tr = b1.append('tr');
    tr.append('th').text(MONTHS_LONG[i]);
    tr.append('td').text(v == null ? '—' : d3.format(',.1f')(kmIn(v)));
    tr.append('td').text(Math.round(mv.days[i]).toLocaleString());
  });
  const t2 = wrap.append('table');
  t2.append('caption').text('Each animal');
  t2.append('thead').append('tr').call((tr) => ['Animal', 'Distance', 'Days', 'Northmost', 'Southmost'].forEach((h) => tr.append('th').text(h)));
  const b2 = t2.append('tbody');
  for (const a of [...d.animals].sort((p, q) => q.km - p.km)) {
    const lats = a.pts.map((p) => p[1]);
    const tr = b2.append('tr');
    tr.append('th').append('button').attr('class', 'link').text(a.id).on('click', () => ctl.follow(sp.id, a));
    tr.append('td').text(fmtDist(a.km));
    tr.append('td').text(a.days.toLocaleString());
    tr.append('td').text(`${d3.max(lats).toFixed(2)}°`);
    tr.append('td').text(`${d3.min(lats).toFixed(2)}°`);
  }
}

// The busiest stopover sites, by total animal-days; click one to pick its animals.
function siteBars(fig, sp, d) {
  fig.append('figcaption').text('Places they stayed').append('small').text(' · busiest first');
  const ids = new Set(d.animals.map((a) => String(a.id)));
  const sites = d.sites
    .map((site, i) => ({ ...site, i, users: site.animals.filter((id) => ids.has(String(id))) }))
    .filter((s) => s.users.length)
    .slice(0, 7);
  const node = fig.node();
  const W = node.clientWidth || 260;
  const rowH = 21;
  const m = { l: 96, r: 54, t: 4 };
  const H = m.t + sites.length * rowH + 4;
  const x = d3.scaleLinear().domain([0, d3.max(sites, (s) => s.days) || 1]).range([m.l, W - m.r]);
  const color = colorFor(sp.id, uiMode());
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', `${sp.name}: the places animals stayed longest`);
  const row = svg.selectAll('g').data(sites).join('g').attr('class', 'site-row')
    .attr('transform', (s, k) => `translate(0,${m.t + k * rowH})`)
    .on('click', (_, s) => ctl.pickSite(sp.id, d.sites[s.i]))
    .on('pointermove', (event, s) => showTip(event, [
      [null, place(s), 'tip-date'],
      [`${s.users.length}`, s.users.length === 1 ? 'animal' : 'animals'],
      [`${s.days.toLocaleString()}`, 'animal-days in all'],
      [null, `busiest ${busiestMonths(s.months)}`],
      [null, 'Click to pick these animals', 'tip-hint'],
    ]))
    .on('pointerleave', hideTip);
  row.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', rowH).attr('fill', 'transparent');
  row.append('text').attr('class', 'row-name site-name').attr('x', 0).attr('y', rowH / 2 + 4).text((s) => place(s));
  row.append('path').attr('class', 'bar').attr('fill', color)
    .attr('d', (s) => roundedRight(m.l, 5, x(s.days) - m.l, rowH - 10, 4));
  row.append('text').attr('class', 'axis-note').attr('x', (s) => x(s.days) + 5).attr('y', rowH / 2 + 3)
    .text((s) => `${s.days.toLocaleString()} d`);
}

const place = (s) => `${Math.abs(s.lat).toFixed(1)}°${s.lat >= 0 ? 'N' : 'S'} ${Math.abs(s.lon).toFixed(1)}°${s.lon >= 0 ? 'E' : 'W'}`;

// A bar with a rounded data end on the right and a square baseline on the left.
function roundedRight(x, y, w, h, r) {
  if (w <= 0) return '';
  r = Math.min(r, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

// 37.5 → "37.5°N"; longitudes are unwrapped for the antimeridian, so wrap them back.
function fmtDeg(v, axis, digits) {
  const w = axis === 'lon' ? ((v + 540) % 360) - 180 : v;
  const hemi = axis === 'lat' ? (w >= 0 ? 'N' : 'S') : (w >= 0 ? 'E' : 'W');
  return `${Math.abs(w).toFixed(digits)}°${hemi}`;
}

// A column with a rounded data end and a square baseline.
function roundedTop(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
