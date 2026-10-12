// The journey atlas: every tracked animal as a small map, sortable and
// filterable. Cards draw lazily as they scroll into view; hovering traces the
// route, clicking flies to the animal and follows it.

import { colorFor } from './palette.js';
import { isDark } from './settings.js';
import {
  state, loadOverview, fmtDist, esc, iconHtml, year,
} from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null;   // { follow }
let land = null;  // [{ ring, bbox }]
let observer = null;
let hover = null; // { canvas, journey, raf }

const SORTS = {
  km: ['Farthest first', (a, b) => b.a.km - a.a.km],
  kmAsc: ['Shortest first', (a, b) => a.a.km - b.a.km],
  days: ['Longest tracked', (a, b) => b.a.days - a.a.days],
  hfHi: ['Most human footprint', (a, b) => (b.a.hfMedian ?? -1) - (a.a.hfMedian ?? -1)],
  hfLo: ['Wildest places', (a, b) => (a.a.hfMedian ?? 999) - (b.a.hfMedian ?? 999)],
  early: ['Earliest', (a, b) => a.a.pts[0][2] - b.a.pts[0][2]],
  late: ['Latest', (a, b) => b.a.pts[0][2] - a.a.pts[0][2]],
};

export function initAtlas(controller) {
  ctl = controller;
  $('#atlas-close').addEventListener('click', () => closeAtlas());
  for (const id of ['atlas-species', 'atlas-sort', 'atlas-group']) $(`#${id}`).addEventListener('change', () => { if (id === 'atlas-species') fillGroups(); render(); });
  $('#atlas-search').addEventListener('input', () => render());
  $('#atlas').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAtlas(); });
  const sort = $('#atlas-sort');
  sort.innerHTML = Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}">${label}</option>`).join('');
}

export async function openAtlas(speciesId = null) {
  const [ov] = await Promise.all([loadOverview(), land ? null : loadLand()]);
  const sel = $('#atlas-species');
  sel.innerHTML = `<option value="">All ${state.index.species.length} species</option>` +
    state.index.species.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  sel.value = speciesId || '';
  fillGroups();
  $('#atlas').hidden = false;
  document.body.classList.add('atlas-open');
  render(ov);
  $('#atlas-search').focus();
}

export function closeAtlas() {
  $('#atlas').hidden = true;
  document.body.classList.remove('atlas-open');
  observer?.disconnect();
  stopHover();
}

async function loadLand() {
  const rings = await (await fetch('data/land.json')).json();
  land = rings.map((ring) => {
    let w = 180, s = 90, e = -180, n = -90;
    for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    return { ring, bbox: [w, s, e, n] };
  });
}

// "Who" groups for the chosen species (sex, site, …), from the overview's attrs.
function fillGroups() {
  const id = $('#atlas-species').value;
  const sel = $('#atlas-group');
  const opts = new Map();
  if (id) {
    for (const a of state.overview.get(id).animals) {
      for (const [k, v] of Object.entries(a.attrs || {})) opts.set(`${k}=${v}`, `${k === 'site' ? 'tagged at' : k === 'stage' ? 'age' : k}: ${v}`);
    }
  }
  sel.innerHTML = '<option value="">Everyone</option>' + [...opts].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  sel.parentElement.hidden = opts.size === 0;
}

function journeys() {
  const id = $('#atlas-species').value;
  const group = $('#atlas-group').value;
  const q = $('#atlas-search').value.trim().toLowerCase();
  const out = [];
  for (const sp of state.index.species) {
    if (id && sp.id !== id) continue;
    for (const a of state.overview.get(sp.id).animals) {
      if (group) {
        const [k, v] = group.split('=');
        if (a.attrs?.[k] !== v) continue;
      }
      if (q && !String(a.id).toLowerCase().includes(q) && !sp.name.toLowerCase().includes(q)) continue;
      out.push({ sp, a });
    }
  }
  return out.sort(SORTS[$('#atlas-sort').value][1]);
}

function render() {
  const grid = $('#atlas-grid');
  observer?.disconnect();
  grid.innerHTML = '';
  const list = journeys();
  $('#atlas-count').textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'journey' : 'journeys'}`;
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      draw(e.target.querySelector('canvas'), e.target._journey);
      observer.unobserve(e.target);
    }
  }, { root: grid, rootMargin: '200px' });
  const frag = document.createDocumentFragment();
  for (const j of list) {
    const { sp, a } = j;
    const card = document.createElement('button');
    card.className = 'atlas-card';
    card._journey = j;
    card.style.setProperty('--sp', colorFor(sp.id, 'dark'));
    const y0 = year(new Date(a.pts[0][2] * 3.6e6).toISOString());
    const y1 = year(new Date(a.pts[a.pts.length - 1][2] * 3.6e6).toISOString());
    card.setAttribute('aria-label', `${sp.name} ${a.id}: ${fmtDist(a.km)} over ${a.days} days, ${y0}${y1 !== y0 ? `–${y1}` : ''}. Follow it.`);
    card.innerHTML = `<canvas width="340" height="210" aria-hidden="true"></canvas>
      <span class="atlas-meta">${iconHtml(sp.id, 'sil sil-sm')}<b>${esc(a.id)}</b>${a.flies ? '<em class="atlas-tag" title="Flight height recorded">height</em>' : ''}</span>
      <span class="atlas-sub">${esc(fmtDist(a.km))} · ${a.days.toLocaleString()} d · ${y0}${y1 !== y0 ? `–${y1}` : ''}${a.hfMedian != null ? ` · footprint ${a.hfMedian}` : ''}</span>`;
    card.addEventListener('click', () => { closeAtlas(); ctl.follow(sp.id, a); });
    card.addEventListener('pointerenter', () => startHover(card.querySelector('canvas'), j));
    card.addEventListener('pointerleave', stopHover);
    card.addEventListener('focus', () => startHover(card.querySelector('canvas'), j));
    card.addEventListener('blur', stopHover);
    frag.append(card);
    observer.observe(card);
  }
  grid.append(frag);
}

// Equirectangular fit of a track (plus margin) into the card.
function projection(pts, W, H) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of pts) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  let spanX = Math.max(0.05, (e - w) * k);
  let spanY = Math.max(0.05, n - s);
  const pad = 0.18;
  spanX *= 1 + pad * 2;
  spanY *= 1 + pad * 2;
  const scale = Math.min(W / spanX, H / spanY);
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  return {
    xy: ([x, y]) => [W / 2 + (x - cx) * k * scale, H / 2 - (y - cy) * scale],
    view: [cx - W / 2 / scale / k, cy - H / 2 / scale, cx + W / 2 / scale / k, cy + H / 2 / scale],
  };
}

function draw(canvas, { sp, a }, headAt = null) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const dark = isDark();
  g.fillStyle = dark ? '#081626' : '#dfe9f3';
  g.fillRect(0, 0, W, H);
  const { xy, view } = projection(a.pts, W, H);
  // Land, for context (the antimeridian is handled by trying shifted copies).
  g.fillStyle = dark ? '#1b2a3a' : '#f6f2ea';
  for (const shift of [-360, 0, 360]) {
    for (const { ring, bbox } of land) {
      if (bbox[2] + shift < view[0] || bbox[0] + shift > view[2] || bbox[3] < view[1] || bbox[1] > view[3]) continue;
      g.beginPath();
      ring.forEach(([x, y], i) => { const [px, py] = xy([x + shift, y]); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.closePath();
      g.fill();
    }
  }
  // The route, fading in from its start.
  const color = colorFor(sp.id, dark ? 'dark' : 'light');
  g.lineWidth = 2.2;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const n = a.pts.length;
  for (let i = 1; i < n; i++) {
    g.strokeStyle = color;
    g.globalAlpha = 0.25 + 0.75 * (i / n);
    const [x0, y0] = xy(a.pts[i - 1]);
    const [x1, y1] = xy(a.pts[i]);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  g.globalAlpha = 1;
  const dot = (p, filled) => {
    const [x, y] = xy(p);
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fillStyle = filled ? color : dark ? '#081626' : '#ffffff';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = filled ? '#ffffff' : color;
    g.stroke();
  };
  dot(a.pts[0], false);
  dot(a.pts[n - 1], true);
  if (headAt != null) {
    const p = a.pts[Math.min(n - 1, Math.floor(headAt * (n - 1)))];
    const [x, y] = xy(p);
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fillStyle = '#ffffff';
    g.fill();
  }
}

function startHover(canvas, journey) {
  stopHover();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now();
  const loop = (now) => {
    draw(canvas, journey, ((now - t0) / 3000) % 1);
    hover.raf = requestAnimationFrame(loop);
  };
  hover = { canvas, journey, raf: requestAnimationFrame(loop) };
}

function stopHover() {
  if (!hover) return;
  cancelAnimationFrame(hover.raf);
  draw(hover.canvas, hover.journey);
  hover = null;
}
