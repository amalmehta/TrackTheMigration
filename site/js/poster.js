// Journey posters: one animal's whole journey as a print-ready image
// (2400 × 3200 px, 3:4 — A-series and US Letter both crop well): the route on
// a clean map, coloured from where it set off to where it was last seen, its
// stopovers, key numbers, a latitude strip and full data credits.

import { colorFor } from './palette.js';
import { loadLand, drawLand } from './land.js';
import { projection } from './atlas.js';
import { haversineKm } from './tracks.js';
import { speciesById, fullAnimal, state, fmtDate, fmtDist, t, num } from './store.js';

const W = 2400;
const H = 3200;
const M = 160; // page margin
const PAPER = '#f7f4ee';
const INK = '#1b2430';
const MUTED = '#5b6573';
const SEA = '#e3ebf2';
const LAND = '#fbf9f4';
const SITE = 'amalmehta.github.io/TrackTheMigration';

export async function makePoster(speciesId, animalOrId) {
  const sp = speciesById(speciesId);
  const [animal, land] = await Promise.all([fullAnimal(speciesId, animalOrId), loadLand(), document.fonts.ready]);
  if (!animal) throw new Error('animal not found');
  await Promise.all(['600 140px Fraunces', '400 48px Inter', '600 48px Inter'].map((f) => document.fonts.load(f).catch(() => null)));
  const icon = await loadIcon(speciesId);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  const color = colorFor(speciesId, 'light');
  const pts = animal.pts;
  const gap = state.data.get(speciesId)?.maxGapHours ?? Infinity;

  // ---- title ----
  g.fillStyle = MUTED;
  g.font = '600 34px Inter';
  g.fillText(`${sp.groupName.toUpperCase()} · ${sp.region.toUpperCase()}`.slice(0, 90), M, M + 10);
  g.fillStyle = INK;
  g.font = '600 140px Fraunces';
  g.fillText(sp.name, M, M + 160);
  g.font = '400 50px Inter';
  g.fillStyle = MUTED;
  const sub = `${t('Animal {id}', { id: animal.id })} · `;
  g.fillText(sub, M, M + 240);
  const w0 = g.measureText(sub).width;
  g.font = 'italic 400 50px Inter';
  g.fillText(sp.scientific, M + w0, M + 240);
  if (icon) {
    const [iw, ih] = icon.width && icon.height ? [icon.width, icon.height] : [1, 1];
    const s = 260 / Math.max(iw, ih);
    g.globalAlpha = 0.85;
    g.drawImage(icon, W - M - iw * s, M - 20, iw * s, ih * s);
    g.globalAlpha = 1;
  }

  // ---- the map ----
  const box = { x: M, y: 480, w: W - 2 * M, h: 1820 };
  g.save();
  roundRect(g, box.x, box.y, box.w, box.h, 28);
  g.clip();
  g.fillStyle = SEA;
  g.fillRect(box.x, box.y, box.w, box.h);
  const { xy: rel, view } = projection(pts, box.w, box.h, 0.14);
  const xy = (p) => { const [x, y] = rel(p); return [box.x + x, box.y + y]; };
  // Graticule every 10° (every 5° for small ranges)
  const step = view[2] - view[0] < 25 ? 5 : 10;
  g.strokeStyle = 'rgba(27,36,48,0.08)';
  g.lineWidth = 2;
  for (let lon = Math.ceil(view[0] / step) * step; lon <= view[2]; lon += step) line(g, xy([lon, view[1] - 5]), xy([lon, view[3] + 5]));
  for (let lat = Math.ceil(view[1] / step) * step; lat <= view[3]; lat += step) line(g, xy([view[0] - 5, lat]), xy([view[2] + 5, lat]));
  g.fillStyle = LAND;
  drawLand(g, land, view, xy);

  // Stopovers: soft discs sized by days stayed
  for (const [lon, lat, a, b] of animal.stops || []) {
    const [x, y] = xy([lon, lat]);
    const r = 10 + Math.sqrt((b - a) / 24) * 4;
    g.fillStyle = hexA(color, 0.18);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = hexA(color, 0.55);
    g.lineWidth = 3;
    g.stroke();
  }
  // Route: light at the start, full colour by the end; gaps dashed and thin.
  const mix = d3.interpolateRgb(d3.color(color).brighter(1.6).formatHex(), color);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const broken = pts[i][2] - pts[i - 1][2] > gap;
    g.strokeStyle = mix(i / pts.length);
    g.lineWidth = broken ? 3 : 7;
    g.setLineDash(broken ? [10, 14] : []);
    line(g, xy(pts[i - 1]), xy(pts[i]));
  }
  g.setLineDash([]);
  const start = xy(pts[0]);
  const end = xy(pts[pts.length - 1]);
  marker(g, start, false, color);
  marker(g, end, true, color);
  label(g, start, t('Set off {date}', { date: fmtDate(pts[0][2]) }), box);
  label(g, end, t('Last seen {date}', { date: fmtDate(pts[pts.length - 1][2]) }), box);
  g.restore();

  // ---- numbers ----
  const lats = pts.map((p) => p[1]);
  const span = haversineKm([0, Math.min(...lats)], [0, Math.max(...lats)]);
  const longest = (animal.stops || []).reduce((m, s) => Math.max(m, s[3] - s[2]), 0) / 24;
  const stats = [
    [fmtDist(animal.km), t('travelled')],
    [num(animal.days + 1), t('days tracked')],
    [fmtDist(span), t('north to south')],
    [`${(animal.stops || []).length}`, longest ? t('stopovers · longest {n} d', { n: Math.round(longest) }) : t('stopovers')],
  ];
  const colW = (W - 2 * M) / stats.length;
  stats.forEach(([v, l], i) => {
    const x = M + i * colW;
    g.fillStyle = INK;
    g.font = '600 92px Fraunces';
    g.fillText(v, x, 2470);
    g.fillStyle = MUTED;
    g.font = '400 36px Inter';
    g.fillText(l, x, 2530);
  });

  // ---- latitude through time ----
  const strip = { x: M, y: 2610, w: W - 2 * M, h: 240 };
  const tx = d3.scaleTime().domain([pts[0][2] * 3.6e6, pts[pts.length - 1][2] * 3.6e6]).range([strip.x, strip.x + strip.w]);
  const ly = d3.scaleLinear().domain(d3.extent(lats)).nice(3).range([strip.y + strip.h, strip.y]);
  g.strokeStyle = 'rgba(27,36,48,0.12)';
  g.lineWidth = 2;
  g.font = '400 30px Inter';
  g.fillStyle = MUTED;
  for (const v of ly.ticks(3)) {
    line(g, [strip.x, ly(v)], [strip.x + strip.w, ly(v)]);
    g.fillText(`${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}`, strip.x + strip.w + 14, ly(v) + 10);
  }
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.beginPath();
  pts.forEach((p, i) => {
    const x = tx(p[2] * 3.6e6);
    const y = ly(p[1]);
    if (i && p[2] - pts[i - 1][2] <= gap) g.lineTo(x, y); else g.moveTo(x, y);
  });
  g.stroke();
  g.fillStyle = MUTED;
  for (const d of tx.ticks(6)) g.fillText(d3.utcFormat(pts[pts.length - 1][2] - pts[0][2] > 24 * 500 ? '%Y' : '%b %Y')(d), tx(d) - 30, strip.y + strip.h + 50);
  g.fillText(t('Latitude through time'), strip.x, strip.y - 20);

  // ---- credits ----
  const src = sp.source;
  const ic = state.assets?.icons?.[speciesId];
  g.font = '400 27px Inter';
  g.fillStyle = MUTED;
  let y = 3010;
  for (const text of [
    `${t('Data:')} ${src.dataCitation}${/movebank/i.test(src.dataCitation) ? '' : ' Movebank Data Repository.'} ${src.doi && !src.dataCitation.includes(src.doi) ? `doi:${src.doi} ` : ''}(${src.license}).`,
    `${ic ? `${t('Silhouette:')} ${ic.attribution}, PhyloPic (${ic.license}). ` : ''}${t('Land: Natural Earth via world-atlas. Straight lines join recorded positions.')}`,
  ]) y = wrap(g, text, M, y, W - 2 * M, 36) + 8;
  g.fillStyle = INK;
  g.font = '600 30px Inter';
  g.fillText(`Track the Migration · ${SITE}`, M, H - 60);

  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return { blob, name: `${speciesId}-${String(animal.id).replace(/[^\w-]+/g, '_')}-journey.png` };
}

function line(g, [x0, y0], [x1, y1]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }

function marker(g, [x, y], filled, color) {
  g.beginPath();
  g.arc(x, y, 18, 0, Math.PI * 2);
  g.fillStyle = filled ? color : '#ffffff';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = filled ? '#ffffff' : color;
  g.stroke();
}

// A label next to a marker, kept inside the map box.
function label(g, [x, y], text, box) {
  g.font = '600 40px Inter';
  const w = g.measureText(text).width + 36;
  let lx = x + 30;
  if (lx + w > box.x + box.w - 20) lx = x - 30 - w;
  const ly = Math.max(box.y + 30, Math.min(box.y + box.h - 80, y - 32));
  g.fillStyle = 'rgba(255,255,255,0.88)';
  roundRect(g, lx, ly, w, 64, 32);
  g.fill();
  g.fillStyle = INK;
  g.fillText(text, lx + 18, ly + 45);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g, text, x, y, maxW, lh) {
  let lineText = '';
  for (const word of text.split(/\s+/)) {
    const test = lineText ? `${lineText} ${word}` : word;
    if (g.measureText(test).width > maxW && lineText) { g.fillText(lineText, x, y); y += lh; lineText = word; } else lineText = test;
  }
  if (lineText) { g.fillText(lineText, x, y); y += lh; }
  return y;
}

const hexA = (hex, a) => { const c = d3.color(hex); c.opacity = a; return c.formatRgb(); };

function loadIcon(id) {
  const file = state.assets?.icons?.[id]?.file;
  if (!file) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = file;
  });
}
