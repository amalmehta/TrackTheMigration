// Linked charts under the globe.
//  • All migrations: a migration calendar — when each species moves most.
//  • One species: where the animals are through the year (brush to pick
//    animals), how far they move each month, and how far each animal went.
// Charts and globe share one clock and one selection.

import { seasonalMovement, mainAxis, yearFraction, seasonToHours, halfwayCrossings, slope } from './tracks.js';
import { colorFor } from './palette.js';
import { settings, isDark } from './settings.js';
import {
  state, emit, on, speciesById, keyOf, MONTHS, MONTHS_LONG, fmtSeason, fmtDist, fmtSpeed, kmIn, iconHtml,
  isVisible, animalColor, facetShades, facetsOf, busiestMonths, viewData, fmtDate, t, num,
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
    $('#charts-table').textContent = t(tableView ? 'Charts' : 'Table');
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
    $('#charts-title').textContent = t('Migration calendar');
    $('#charts-sub').textContent = t('How far each species moves through the year. Each row is scaled to its own busiest fortnight. Click a row to open that migration, or a cell to jump there.');
    if (tableView) calendarTable(body); else calendar(body);
  } else {
    const sp = speciesById(state.selected);
    $('#charts-title').textContent = t('{name}: the year in motion', { name: sp.name });
    $('#charts-sub').textContent = t('Drag a box on the left chart to pick animals (the globe dims the rest). Click a line or a bar to follow that animal.');
    if (tableView) speciesTables(body, sp); else speciesCharts(body, sp);
  }
  chartsTime();
}

// ---------- shared bits ----------

// Fixed labels ("on average", "Click to follow"…) are translated here.
function showTip(event, rows) {
  const el = tip();
  el.html('');
  for (const [value, label, cls] of rows) {
    const row = el.append('div').attr('class', cls || '');
    if (value != null) row.append('b').text(value);
    if (label) row.append('span').text(value != null ? ` ${t(label)}` : t(label));
  }
  const box = $('#charts').getBoundingClientRect();
  const x = Math.min(event.clientX - box.left + 14, box.width - 220);
  el.style('left', `${x}px`).style('top', `${event.clientY - box.top - 10}px`).style('opacity', 1);
}
const hideTip = () => tip().style('opacity', 0);

const binLabel = (b, bins) => {
  const m = Math.floor((b * 12) / bins);
  if (bins === 12) return MONTHS_LONG[m];
  return t(b % 2 === 0 ? 'early {month}' : 'late {month}', { month: MONTHS_LONG[m] });
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
    .attr('role', 'img').attr('aria-label', t('Migration calendar: how far each species moves in each half-month'));
  monthAxis(svg, x, 11);

  rows.forEach(({ s, mv }, r) => {
    const y = top + r * rowH;
    const max = d3.max(mv.kmPerDay) || 1;
    const color = colorFor(s.id, uiMode());
    const g = svg.append('g').attr('class', 'cal-row');
    const label = g.append('g').attr('class', 'row-link').attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', t('Open {name}', { name: s.name }))
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
          : [[null, `${s.name} · ${binLabel(b, BINS)}`, 'tip-date'], [fmtSpeed(v), 'on average'], [num(Math.round(mv.days[b])), 'days of tracking']]))
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
  key.append('span').text(t('quiet → busiest fortnight for that species · grey: no tracking'));
}

function calendarTable(body) {
  const table = d3.select(body).append('div').attr('class', 'table-wrap').append('table');
  const head = table.append('thead').append('tr');
  head.append('th').text(t('Average {u}/day', { u: settings.units }));
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
    d3.select(body).append('p').attr('class', 'muted').text(t('Every animal is filtered out. Switch a group back on in the panel.'));
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
  if (d.animals.some((a) => a.wind)) windColumns(grid.append('figure').attr('class', 'chart-card'), sp, d);
  const timing = timingByYear(sp, d);
  if (timing) timingChart(grid.append('figure').attr('class', 'chart-card'), sp, timing);
}

// Then vs now: the date each animal crossed the halfway line of its range,
// by year and direction, with a trend where there's enough to fit one.
const DAY = 24;
const doy = (h) => { const dt = new Date(h * 3.6e6); return (h - Date.UTC(dt.getUTCFullYear(), 0, 1) / 3.6e6) / DAY; };
function timingByYear(sp, d) {
  const axis = mainAxis(d.animals.map((a) => a.pts));
  const series = new Map();
  for (const a of d.animals) {
    for (const c of halfwayCrossings(a.pts, axis, { maxGapHours: d.maxGapHours })) {
      if (!series.has(c.dir)) series.set(c.dir, []);
      series.get(c.dir).push({ t: c.t, animal: a });
    }
  }
  const out = [];
  for (const [dir, ev] of series) {
    // Centre on the circular mean day, so a crossing around New Year doesn't split.
    const ang = ev.map((e) => (doy(e.t) / 365.25) * 2 * Math.PI);
    const meanDay = ((Math.atan2(d3.sum(ang, Math.sin), d3.sum(ang, Math.cos)) / (2 * Math.PI)) * 365.25 + 365.25) % 365.25;
    const pts = ev.map((e) => {
      let off = doy(e.t) - meanDay;
      if (off > 182.6) off -= 365.25;
      if (off < -182.6) off += 365.25;
      return { year: 1970 + e.t / (365.25 * DAY) - off / 365.25, off, ...e };
    });
    const years = new Set(pts.map((p) => Math.floor(p.year)));
    if (pts.length < 6 || years.size < 3) continue;
    const s = slope(pts.map((p) => p.year), pts.map((p) => p.off), 8);
    const label = t(axis === 'lat' ? (dir > 0 ? 'Northward' : 'Southward') : (dir > 0 ? 'Eastward' : 'Westward'));
    out.push({ dir, label, meanDay, pts, perDecade: s == null ? null : s * 10, years: d3.extent(pts, (p) => Math.floor(p.year)) });
  }
  return out.length ? out.sort((a, b) => a.label.localeCompare(b.label)) : null;
}

function timingChart(fig, sp, timing) {
  fig.append('figcaption').text(t('Then vs now')).append('small').text(t(' · when each animal passed the halfway point of its range'));
  const node = fig.node();
  const W = node.clientWidth || 260;
  const H = 168;
  const m = { l: 40, r: 8, t: 12, b: 20 };
  const all = timing.flatMap((s) => s.pts);
  const x = d3.scaleLinear().domain(d3.extent(all, (p) => p.year)).nice().range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([-1, 1].map((k) => k * Math.max(20, d3.max(all, (p) => Math.abs(p.off))))).nice(4).range([H - m.b, m.t]);
  const color = colorFor(sp.id, uiMode());
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', t('{name}: migration timing by year', { name: sp.name }));
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end')
    .text((v) => (v === 0 ? t('usual') : `${v > 0 ? '+' : '−'}${Math.abs(v)} ${t('d')}`));
  svg.append('g').attr('class', 'axis x').attr('transform', `translate(0,${H - m.b + 2})`)
    .call(d3.axisBottom(x).ticks(Math.min(6, Math.round(x.domain()[1] - x.domain()[0]))).tickFormat(d3.format('d')).tickSize(0))
    .call((g) => g.select('.domain').remove());
  timing.forEach((s, k) => {
    const filled = k === 0;
    svg.append('g').selectAll('circle').data(s.pts).join('circle')
      .attr('cx', (p) => x(p.year)).attr('cy', (p) => y(p.off)).attr('r', 4)
      .attr('fill', filled ? color : 'none').attr('stroke', color).attr('stroke-width', 1.6).attr('opacity', 0.85)
      .on('pointermove', (event, p) => showTip(event, [[null, `${s.label} · ${p.animal.id}`, 'tip-date'],
        [fmtDate(p.t), 'crossed halfway'], [`${p.off > 0 ? '+' : '−'}${Math.abs(Math.round(p.off))} ${t('d')}`, 'vs usual']]))
      .on('pointerleave', hideTip)
      .on('click', (event, p) => ctl.follow(sp.id, p.animal));
    if (s.perDecade != null) {
      const [x0, x1] = x.domain();
      const mx = d3.mean(s.pts, (p) => p.year);
      const my = d3.mean(s.pts, (p) => p.off);
      const yAt = (xx) => my + (s.perDecade / 10) * (xx - mx);
      svg.append('line').attr('x1', x(x0)).attr('x2', x(x1)).attr('y1', y(yAt(x0))).attr('y2', y(yAt(x1)))
        .attr('stroke', color).attr('stroke-width', 2).attr('stroke-dasharray', filled ? null : '4 3');
    }
  });
  const fmtDay = (day) => fmtSeason(day / 365);
  const lines = timing.map((s, k) => {
    const trend = s.perDecade == null ? t('too few to fit a trend')
      : Math.abs(s.perDecade) < 2 ? t('no clear shift')
        : t(s.perDecade < 0 ? '{n} days earlier per decade' : '{n} days later per decade', { n: Math.abs(s.perDecade).toFixed(0) });
    return `${k === 0 ? '●' : '○'} ${t('{label}: usually around {day}; {trend} ({n} crossings, {from}–{to}).', { label: s.label, day: fmtDay(s.meanDay), trend, n: s.pts.length, from: s.years[0], to: s.years[1] })}`;
  });
  fig.append('p').attr('class', 'chart-note muted small').text(`${lines.join(' ')} ${t('Different animals were tracked in different years, so a trend here is a hint, not proof.')}`);
}

// Faster with the wind? Median travel speed (km/day) on steps grouped by the
// wind 100 m up along the bird's heading, from strong headwind to strong tailwind.
const WIND_BINS = [[-Infinity, -20, 'head 20+'], [-20, -10, 'head 10–20'], [-10, 0, 'head 0–10'], [0, 10, 'tail 0–10'], [10, 20, 'tail 10–20'], [20, Infinity, 'tail 20+']];
function windColumns(fig, sp, d) {
  fig.append('figcaption').text(t('Faster with the wind?')).append('small').text(` · ${t('median {u}/day by wind 100 m up (km/h)', { u: settings.units })}`);
  const bins = WIND_BINS.map(() => []);
  for (const a of d.animals) {
    for (const [, , tail, , kmDay] of a.wind || []) bins[WIND_BINS.findIndex(([lo, hi]) => tail >= lo && tail < hi)].push(kmDay);
  }
  const stats = bins.map((v, i) => ({ i, n: v.length, med: v.length >= 5 ? d3.median(v) : null }));
  const node = fig.node();
  const W = node.clientWidth || 260;
  const H = 168;
  const m = { l: 40, r: 6, t: 12, b: 32 };
  const x = d3.scaleBand().domain(stats.map((s) => s.i)).range([m.l, W - m.r]).paddingInner(0.25);
  const y = d3.scaleLinear().domain([0, kmIn(d3.max(stats, (s) => s.med) || 1)]).nice(4).range([H - m.b, m.t]);
  const color = colorFor(sp.id, uiMode());
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', t('{name}: median travel speed by headwind or tailwind', { name: sp.name }));
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end').text(d3.format('~s'));
  const xg = svg.append('g').attr('class', 'axis');
  xg.selectAll('text').data(stats).join('text').attr('x', (s) => x(s.i) + x.bandwidth() / 2).attr('y', H - m.b + 13).attr('text-anchor', 'middle')
    .text((s) => WIND_BINS[s.i][2].split(' ')[1]);
  xg.append('text').attr('x', x(1) + x.bandwidth() / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(t('← headwind'));
  xg.append('text').attr('x', x(4) + x.bandwidth() / 2).attr('y', H - 4).attr('text-anchor', 'middle').text(t('tailwind →'));
  // Headwind columns are a lighter step of the species hue, tailwind full strength; the labels carry the meaning.
  svg.append('g').selectAll('path').data(stats.filter((s) => s.med != null)).join('path')
    .attr('fill', color).attr('fill-opacity', (s) => (s.i < 3 ? 0.45 : 1))
    .attr('d', (s) => roundedTop(x(s.i), y(kmIn(s.med)), x.bandwidth(), y(0) - y(kmIn(s.med)), Math.min(4, x.bandwidth() / 2)))
    .on('pointermove', (event, s) => showTip(event, [[null, `${t(WIND_BINS[s.i][2].startsWith('head') ? 'Headwind' : 'Tailwind')} ${WIND_BINS[s.i][2].split(' ')[1]} km/h`, 'tip-date'],
      [fmtSpeed(s.med), 'median travel speed'], [num(s.n), 'travelling steps']]))
    .on('pointerleave', hideTip);
  const n = d3.sum(stats, (s) => s.n);
  const tailShare = n ? d3.sum(stats.slice(3), (s) => s.n) / n : 0;
  fig.append('p').attr('class', 'chart-note muted small').text(t('{p}% of {n} travelling steps had a tailwind. Wind from ERA5 via Open-Meteo, 100 m above the ground; birds often fly higher.', { p: Math.round(tailShare * 100), n: num(n) }));
}

// The conditions they met, month by month: median, and the middle half of fixes as a band.
function conditionsByMonth(fig, sp, d) {
  const sst = d.condKey === 'sst';
  fig.append('figcaption').text(t(sst ? 'Sea temperature where they were' : 'Greenness where they were'))
    .append('small').text(t(sst ? ' · °C, by month' : ' · NDVI, by month'));
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
    .attr('role', 'img').attr('aria-label', t(sst ? '{name}: sea temperature where they were, by month' : '{name}: vegetation greenness where they were, by month', { name: sp.name }));
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
      [null, t('middle half {r}', { r: sst ? `${s.q1.toFixed(1)}–${s.q3.toFixed(1)} °C` : `${s.q1.toFixed(2)}–${s.q3.toFixed(2)}` })],
      [num(s.n), 'fixes']]))
    .on('pointerleave', hideTip);
  playheads.push((f) => svg.selectAll('circle').attr('r', (s) => (s.i === Math.min(11, Math.floor(f * 12)) ? 6 : 4)));
}

// Share of time spent at each level of human footprint, per group (the
// colour-by facet, else where they were tagged, else everyone).
const HF_BANDS = [[0, 9, 'wild 0–9'], [10, 24, 'light 10–24'], [25, 49, 'moderate 25–49'], [50, 100, 'heavy 50+']];
const HF_COLORS = ['#3f8f3a', '#b9c94a', '#e6923a', '#c8402f']; // ordinal: footprint low → high
function footprintBars(fig, sp, d) {
  fig.append('figcaption').text(t('Human footprint where they went')).append('small').text(t(' · share of fixes'));
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
    .attr('role', 'img').attr('aria-label', t('{name}: share of time at each level of human footprint', { name: sp.name }));
  rows.forEach((r, k) => {
    const y = m.t + k * rowH;
    if (key) svg.append('text').attr('class', 'row-name').attr('x', 0).attr('y', y + 14).text(t(r.g).charAt(0).toUpperCase() + t(r.g).slice(1));
    let acc = 0;
    r.shares.forEach((share, b) => {
      if (share > 0) {
        svg.append('rect').attr('x', x(acc) + 1).attr('y', y + 3).attr('width', Math.max(0, x(acc + share) - x(acc) - 2)).attr('height', rowH - 8).attr('rx', 3)
          .attr('fill', HF_COLORS[b])
          .on('pointermove', (event) => showTip(event, [[null, r.g === 'All animals' ? sp.name : t(r.g), 'tip-date'], [`${Math.round(share * 100)}%`, t('of fixes {band}', { band: t(HF_BANDS[b][2]) })]]))
          .on('pointerleave', hideTip);
      }
      acc += share;
    });
    svg.append('text').attr('class', 'axis-note').attr('x', W - m.r + 6).attr('y', y + 14).text(t('median {n}', { n: r.median }));
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
    item.append('span').text(t(v.value).charAt(0).toUpperCase() + t(v.value).slice(1));
  }
}

function yearLines(fig, sp, d) {
  const axis = mainAxis(d.animals.map((a) => a.pts));
  fig.append('figcaption').text(t(axis === 'lat' ? 'Latitude through the year' : 'Longitude through the year'))
    .append('small').text(t(axis === 'lat' ? ' · north is up' : ' · east is up'));
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
    .attr('role', 'img').attr('aria-label', t(axis === 'lat' ? '{name}: latitude of each animal through the year' : '{name}: longitude of each animal through the year', { name: sp.name }));
  svg.append('clipPath').attr('id', 'clip-year').append('rect').attr('x', m.l).attr('y', 0).attr('width', W - m.l - m.r).attr('height', H);
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end')
    .text((v) => fmtDeg(v, axis, y.ticks(4).some((k) => !Number.isInteger(k)) ? 1 : 0));
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
        [null, `${t('Animal {id}', { id: p.s.animal.id })} · ${p.s.year}`, 'tip-date'],
        [fmtDeg(p.v, axis, 2), t('on {date}', { date: fmtSeason(Math.max(0, Math.min(0.999, p.f))) })],
        [null, 'Click to follow', 'tip-hint'],
      ]);
    })
    .on('pointerleave.hover', () => { hovered = null; dot.style('opacity', 0); hideTip(); paths.attr('stroke-width', (s) => (hl && hl.has(s.key) ? 1.8 : 1.2)).attr('stroke-opacity', (s) => (hl ? (hl.has(s.key) ? 0.95 : 0.08) : 0.4)); });
}

function monthColumns(fig, sp, d) {
  fig.append('figcaption').text(t('Distance per day, by month'));
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
    .attr('role', 'img').attr('aria-label', t('{name}: average {u} per day in each month', { name: sp.name, u: settings.units }));
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
        : [[null, MONTHS_LONG[i], 'tip-date'], [fmtSpeed(v / (settings.units === 'mi' ? 0.621371 : 1)), 'on average'], [num(Math.round(mv.days[i])), 'days of tracking']]);
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
  fig.append('figcaption').text(t('How far each animal went'));
  const animals = [...d.animals].sort((p, q) => q.km - p.km);
  facetLegend(fig, sp);
  const node = fig.node();
  const W = node.clientWidth || 260;
  const H = 168;
  const m = { l: 40, r: 6, t: 14, b: 20 };
  const y = d3.scaleLinear().domain([0, kmIn(animals[0].km)]).nice(4).range([H - m.b, m.t]);
  const x = d3.scaleBand().domain(animals.map((a) => a.id)).range([m.l, W - m.r]).paddingInner(0.2);
  const svg = fig.append('svg').attr('class', 'chart').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .attr('role', 'img').attr('aria-label', t('{name}: distance tracked for each animal, longest first', { name: sp.name }));
  const yg = svg.append('g').attr('class', 'axis');
  yg.selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  yg.selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 3).attr('text-anchor', 'end').text(d3.format('~s'));
  svg.append('text').attr('class', 'axis-note').attr('x', m.l).attr('y', H - 5).text(t('{n} animals, longest first · {u}', { n: animals.length, u: settings.units }));
  const hl = state.highlight;
  const bw = Math.min(24, x.bandwidth());
  svg.append('g').selectAll('path').data(animals).join('path')
    .attr('class', 'bar clickable').attr('fill', (a) => animalColor(sp.id, a, uiMode()))
    .attr('fill-opacity', (a) => (hl ? (hl.has(keyOf(sp.id, a)) ? 1 : 0.18) : 0.85))
    .attr('d', (a) => roundedTop(x(a.id) + (x.bandwidth() - bw) / 2, y(kmIn(a.km)), bw, y(0) - y(kmIn(a.km)), Math.min(4, bw / 2)))
    .on('pointermove', (event, a) => showTip(event, [[null, t('Animal {id}', { id: a.id }), 'tip-date'], [fmtDist(a.km), t('over {n} days', { n: num(a.days) })], [null, 'Click to follow', 'tip-hint']]))
    .on('pointerleave', hideTip)
    .on('click', (_, a) => ctl.follow(sp.id, a));
  // Wider invisible hit targets for thin bars.
  svg.append('g').selectAll('rect').data(animals).join('rect')
    .attr('x', (a) => x(a.id) - 2).attr('width', x.bandwidth() + 4).attr('y', m.t).attr('height', H - m.t - m.b)
    .attr('fill', 'transparent').style('cursor', 'pointer')
    .on('pointermove', (event, a) => showTip(event, [[null, t('Animal {id}', { id: a.id }), 'tip-date'], [fmtDist(a.km), t('over {n} days', { n: num(a.days) })], [null, 'Click to follow', 'tip-hint']]))
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
  t1.append('caption').text(t('Distance per day, by month'));
  t1.append('thead').append('tr').call((tr) => { tr.append('th').text(t('Month')); tr.append('th').text(t('{u}/day', { u: settings.units })); tr.append('th').text(t('Days tracked')); });
  const b1 = t1.append('tbody');
  mv.kmPerDay.forEach((v, i) => {
    const tr = b1.append('tr');
    tr.append('th').text(MONTHS_LONG[i]);
    tr.append('td').text(v == null ? '—' : d3.format(',.1f')(kmIn(v)));
    tr.append('td').text(num(Math.round(mv.days[i])));
  });
  const t2 = wrap.append('table');
  t2.append('caption').text(t('Each animal'));
  t2.append('thead').append('tr').call((tr) => ['Animal', 'Distance', 'Days', 'Northmost', 'Southmost'].forEach((h) => tr.append('th').text(t(h))));
  const b2 = t2.append('tbody');
  for (const a of [...d.animals].sort((p, q) => q.km - p.km)) {
    const lats = a.pts.map((p) => p[1]);
    const tr = b2.append('tr');
    tr.append('th').append('button').attr('class', 'link').text(a.id).on('click', () => ctl.follow(sp.id, a));
    tr.append('td').text(fmtDist(a.km));
    tr.append('td').text(num(a.days));
    tr.append('td').text(`${d3.max(lats).toFixed(2)}°`);
    tr.append('td').text(`${d3.min(lats).toFixed(2)}°`);
  }
}

// The busiest stopover sites, by total animal-days; click one to pick its animals.
function siteBars(fig, sp, d) {
  fig.append('figcaption').text(t('Places they stayed')).append('small').text(t(' · busiest first'));
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
    .attr('role', 'img').attr('aria-label', t('{name}: the places animals stayed longest', { name: sp.name }));
  const row = svg.selectAll('g').data(sites).join('g').attr('class', 'site-row')
    .attr('transform', (s, k) => `translate(0,${m.t + k * rowH})`)
    .on('click', (_, s) => ctl.pickSite(sp.id, d.sites[s.i]))
    .on('pointermove', (event, s) => showTip(event, [
      [null, place(s), 'tip-date'],
      [`${s.users.length}`, s.users.length === 1 ? 'animal' : 'animals'],
      [num(s.days), 'animal-days in all'],
      [null, t('busiest {m}', { m: busiestMonths(s.months) })],
      [null, 'Click to pick these animals', 'tip-hint'],
    ]))
    .on('pointerleave', hideTip);
  row.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', rowH).attr('fill', 'transparent');
  row.append('text').attr('class', 'row-name site-name').attr('x', 0).attr('y', rowH / 2 + 4).text((s) => place(s));
  row.append('path').attr('class', 'bar').attr('fill', color)
    .attr('d', (s) => roundedRight(m.l, 5, x(s.days) - m.l, rowH - 10, 4));
  row.append('text').attr('class', 'axis-note').attr('x', (s) => x(s.days) + 5).attr('y', rowH / 2 + 3)
    .text((s) => `${num(s.days)} ${t('d')}`);
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
