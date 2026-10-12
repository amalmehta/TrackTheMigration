// The journey diary: an animal's trip as dated entries (computed at build
// time from its track; see scripts/diary.mjs), shown in the follow readout.
// Click an entry to jump to that day; the entry for "now" is highlighted.

import { lang } from './i18n.js';
import {
  state, fmtDate, fmtDist, fmtSpeed, esc, t,
} from './store.js';

const $ = (s) => document.querySelector(s);
const LANG = { en: 0, es: 1, fr: 2 }[lang] ?? 0;
let ctl = null; // { frame }
let shown = null; // the animal whose diary is drawn
let current = -1;

export function initDiary(controller) {
  ctl = controller;
  $('#hud-tab-profile').addEventListener('click', () => setTab('profile'));
  $('#hud-tab-diary').addEventListener('click', () => setTab('diary'));
}

// A place label tuple → words, in the page language.
export function placeText(place, names) {
  if (!place || !names) return '';
  const n = (i) => names[i]?.[LANG] ?? names[i]?.[0] ?? '';
  const [kind, a, b] = place;
  if (kind === 'near') return t('near {town}, {country}', { town: n(a), country: n(b) });
  if (kind === 'off') return t('off {town}, {country}', { town: n(a), country: n(b) });
  if (kind === 'region') return `${n(a)}, ${n(b)}`;
  return n(a);
}

// Just the most specific name ("Kano", "Sahara", "Mediterranean Sea"), for tight labels.
export function placeShort(place, names) {
  if (!place || !names) return '';
  return names[place[1]]?.[LANG] ?? names[place[1]]?.[0] ?? '';
}

export const duration = (hours) => (hours < 48 ? t('{n} h', { n: Math.max(1, Math.round(hours)) }) : t('{n} days', { n: Math.round(hours / 24) }));
const deg = (lat) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;

function entryText([kind, , ...a], names) {
  const at = (p) => placeText(p, names);
  switch (kind) {
    case 'start': return [t('First recorded'), at(a[0])];
    case 'stay': return [t(a[0] === 1 ? 'Stayed {n} day' : 'Stayed {n} days', { n: a[0] }), at(a[1])];
    case 'cross': return [t('{name}: crossed in {time}', { name: names[a[0]]?.[LANG] ?? names[a[0]]?.[0], time: duration(a[1]) }), fmtDist(a[2])];
    case 'fast': return [t('Fastest day'), fmtSpeed(a[0])];
    case 'north': return [t('Farthest north: {lat}', { lat: deg(a[0]) }), at(a[1])];
    case 'south': return [t('Farthest south: {lat}', { lat: deg(a[0]) }), at(a[1])];
    case 'km': return [t('Passed {d}', { d: fmtDist(a[0]) }), ''];
    case 'end': return [t('Last recorded'), at(a[0])];
    default: return [kind, ''];
  }
}

export function setTab(tab) {
  const diary = tab === 'diary';
  $('#hud-tab-profile').setAttribute('aria-selected', String(!diary));
  $('#hud-tab-diary').setAttribute('aria-selected', String(diary));
  $('#hud-profile').hidden = diary;
  $('#hud-diary').hidden = !diary;
  if (diary) render();
}

// Draw the followed animal's diary (once per animal), then keep "now" marked.
function render() {
  const f = state.follow;
  const box = $('#hud-diary');
  if (!f) return;
  if (shown !== f.animal) {
    shown = f.animal;
    current = -1;
    const names = state.data.get(f.species)?.names;
    const entries = f.animal.diary || [];
    box.innerHTML = entries.length
      ? `<ol class="diary">${entries.map((e, i) => {
        const [what, where] = entryText(e, names);
        return `<li><button class="diary-row" data-i="${i}"><span class="diary-date">${esc(fmtDate(e[1]))}</span><b>${esc(what)}</b>${where ? `<small>${esc(where)}</small>` : ''}</button></li>`;
      }).join('')}</ol>`
      : `<p class="muted small">${esc(t('No diary for this animal.'))}</p>`;
    box.querySelectorAll('.diary-row').forEach((b) => b.addEventListener('click', () => {
      state.t = entries[Number(b.dataset.i)][1];
      ctl.frame();
    }));
  }
  mark();
}

// Called every frame while following.
export function diaryFrame() {
  if (!state.follow || $('#hud-diary').hidden) return;
  if (shown !== state.follow.animal) { render(); return; }
  mark();
}

function mark() {
  const entries = state.follow.animal.diary || [];
  let i = -1;
  while (i + 1 < entries.length && entries[i + 1][1] <= state.t) i++;
  if (i === current) return;
  current = i;
  const rows = $('#hud-diary').querySelectorAll('.diary-row');
  rows.forEach((r, k) => r.classList.toggle('now', k === i));
  rows[i]?.scrollIntoView({ block: 'nearest' });
}

// "Crossing the Sahara" while the followed animal is mid-crossing, else null.
export function crossingNow() {
  const f = state.follow;
  if (!f) return null;
  const names = state.data.get(f.species)?.names;
  for (const e of f.animal.diary || []) {
    if (e[0] === 'cross' && state.t >= e[1] && state.t <= e[1] + e[3]) {
      return t('crossing {name} · day {n}', { name: names?.[e[2]]?.[LANG] ?? names?.[e[2]]?.[0], n: Math.floor((state.t - e[1]) / 24) + 1 });
    }
  }
  return null;
}
