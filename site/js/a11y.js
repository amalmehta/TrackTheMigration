// Accessibility: plain-language descriptions of what's on the globe (read by
// screen readers through a polite live region and the map's label), keyboard
// control of time and animals, and the shortcuts list.

import { positionAt, recentHeading, compassWord } from './tracks.js';
import { map } from './globe.js';
import { inGame } from './game.js';
import {
  state, speciesById, instanceTime, fmtDate, fmtSeason, fmtDist, fmtSpeed, reducedMotion,
} from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null; // { frame, setPlaying, follow, toggleCompare, toggleCharts, openLayers, toast }
let focusIdx = -1;
let lastSpoken = '';

export function initA11y(controller) {
  ctl = controller;
  window.addEventListener('keydown', onKey);
  $('#keys-close')?.addEventListener('click', () => $('#keys-dialog').close());
}

// ---------- describing ----------

export function announce(text) {
  if (!text || text === lastSpoken) return;
  lastSpoken = text;
  const live = $('#sr-live');
  live.textContent = '';
  // A fresh text node after a tick so screen readers notice the change.
  setTimeout(() => { live.textContent = text; }, 50);
  map.getCanvas().setAttribute('aria-label', `Globe. ${text}`);
}

const when = () => (state.race ? `Day ${Math.floor(state.race.day) + 1} of the race`
  : state.mode === 'season' ? fmtSeason(state.frac) : fmtDate(state.t));

export function describe() {
  if (state.follow) return describeFollow();
  if (state.race) return describeRace();
  // Group the moving animals by species and summarise each one's last week.
  const bySpecies = new Map();
  for (const inst of state.instances) {
    const t = instanceTime(inst);
    if (!positionAt(inst.pts, t, inst.gap)) continue;
    const h = recentHeading(inst.pts, t, 168, inst.gap);
    if (!bySpecies.has(inst.species)) bySpecies.set(inst.species, { n: 0, x: 0, y: 0, km: 0, k: 0 });
    const s = bySpecies.get(inst.species);
    s.n++;
    if (h && h.km > 1) {
      s.x += Math.sin((h.bearing * Math.PI) / 180) * h.km;
      s.y += Math.cos((h.bearing * Math.PI) / 180) * h.km;
      s.km += h.km;
      s.k++;
    }
  }
  const total = [...bySpecies.values()].reduce((a, s) => a + s.n, 0);
  const parts = [...bySpecies].sort((a, b) => (b[1].km / Math.max(1, b[1].k)) - (a[1].km / Math.max(1, a[1].k))).slice(0, 4).map(([id, s]) => {
    const name = speciesById(id).name;
    if (!s.k) return `${name}: ${s.n} staying put`;
    const perDay = s.km / s.k / 7;
    const net = Math.hypot(s.x, s.y) / s.km; // 1 = all heading the same way
    const dir = compassWord((Math.atan2(s.x, s.y) * 180) / Math.PI);
    return net > 0.45
      ? `${name}: ${s.n} moving, mostly ${dir}, about ${fmtSpeed(perDay)}`
      : `${name}: ${s.n} moving in different directions, about ${fmtSpeed(perDay)}`;
  });
  const where = state.selected === 'all' ? 'All migrations' : speciesById(state.selected).name;
  return `${where}, ${when()}. ${total} ${total === 1 ? 'animal' : 'animals'} tracked right now. ${parts.join('. ')}.`;
}

function describeFollow() {
  const { species, animal } = state.follow;
  const sp = speciesById(species);
  const speed = $('#hud-speed').textContent;
  const note = $('#hud-speed-note').textContent;
  const dist = $('#hud-dist').textContent;
  const h = recentHeading(animal.pts, state.t, 168, state.follow.gap);
  const heading = h && h.km > 1 ? ` Over the last week it went ${fmtDist(h.km)} ${compassWord(h.bearing)}.` : '';
  const hf = $('#hud-hf').hidden ? '' : ` Human footprint here: ${$('#hud-hf-val').textContent}.`;
  return `Following ${sp.name} ${animal.id}, ${fmtDate(state.t)}. Speed ${speed}, ${note}. Travelled ${dist} so far.${heading}${hf}`;
}

function describeRace() {
  const rows = [...document.querySelectorAll('#race-board li')].map((li, i) =>
    `${i + 1}: ${li.querySelector('.who b').textContent} ${li.querySelector('.who small').textContent}, ${li.querySelector('.km').textContent}`);
  return `${when()}. ${rows.join('. ')}.`;
}

export const describeNow = () => announce(describe());

// ---------- keyboard ----------

// Animals currently on screen, in a stable order, for n / p.
function visibleHeads() {
  const out = [];
  for (const inst of state.instances) {
    const p = positionAt(inst.pts, instanceTime(inst), inst.gap);
    if (p) out.push({ inst, p });
  }
  return out.sort((a, b) => a.inst.species.localeCompare(b.inst.species) || String(a.inst.animal.id).localeCompare(String(b.inst.animal.id)));
}

function focusAnimal(step) {
  const heads = visibleHeads();
  if (!heads.length) return announce('No animals are being tracked at this moment.');
  focusIdx = (focusIdx + step + heads.length) % heads.length;
  const { inst, p } = heads[focusIdx];
  state.kbdFocus = { species: inst.species, animal: inst.animal };
  map.getSource('focus')?.setData({ type: 'Point', coordinates: p });
  map.easeTo({ center: p, duration: reducedMotion() ? 0 : 600 });
  const sp = speciesById(inst.species);
  announce(`${focusIdx + 1} of ${heads.length}: ${sp.name} ${inst.animal.id}, ${fmtDist(inst.animal.km)} tracked. Enter to follow, R to race.`);
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
  if (document.querySelector('dialog[open]') && e.key !== '?') return;
  const step = (days) => {
    e.preventDefault();
    ctl.setPlaying(false);
    if (state.race) state.race.day = Math.max(0, Math.min(state.race.maxDay, state.race.day + days));
    else if (state.mode === 'season') state.frac = (state.frac + days / 365.2425 + 1) % 1;
    else state.t = Math.max(state.range[0], Math.min(state.range[1], state.t + days * 24));
    ctl.frame();
    announce(describe());
  };
  switch (e.key) {
    case ',': return step(-1);
    case '.': return step(1);
    case '<': return step(-7);
    case '>': return step(7);
    case 'n': e.preventDefault(); return focusAnimal(1);
    case 'p': e.preventDefault(); return focusAnimal(-1);
    case 'Enter':
      if (inGame() || state.race) return; // like clicks, no following mid-game or mid-race
      if (state.kbdFocus && !e.target?.closest?.('button, a')) { e.preventDefault(); ctl.follow(state.kbdFocus.species, state.kbdFocus.animal); }
      return;
    case 'r':
      if (inGame() || state.race) return;
      if (state.kbdFocus) {
        ctl.toggleCompare(state.kbdFocus.species, state.kbdFocus.animal);
        announce(`${speciesById(state.kbdFocus.species).name} ${state.kbdFocus.animal.id} toggled in the race.`);
      }
      return;
    case 'd': e.preventDefault(); return describeNow();
    case 'c': return ctl.toggleCharts();
    case 'l': return ctl.openLayers();
    case 'a': e.preventDefault(); return inGame() || state.race ? undefined : ctl.openAtlas();
    case '?': e.preventDefault(); return $('#keys-dialog').open ? $('#keys-dialog').close() : $('#keys-dialog').showModal();
    default:
  }
}

export const clearKbdFocus = () => { state.kbdFocus = null; focusIdx = -1; };
