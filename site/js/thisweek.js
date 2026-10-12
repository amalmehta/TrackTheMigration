// This week in migration: on the All migrations card, who is on the move at
// today's time of year, where, which way and how fast (from every year each
// animal was tracked; see scripts/seasons.mjs), and who picks up next.

import { colorFor } from './palette.js';
import { colorMode } from './globe.js';
import { placeText } from './diary.js';
import {
  state, fmtSpeed, fmtSeason, esc, iconHtml, t,
} from './store.js';

const BINS = 24;
const TYPICAL = { land: 10, marine: 50, birds: 200 }; // km/day that counts as busy, per group
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
let ctl = null; // { select, setMode, setPlaying, frame }

export function initThisWeek(controller) {
  ctl = controller;
}

// Today as a fraction of the year (Season view's clock).
export function todayFraction(now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.min(0.9999, (now - start) / (365.25 * 86400000));
}

const binOf = (frac) => Math.min(BINS - 1, Math.floor(frac * BINS));
const busy = (sp, w) => (w && w.n >= 3 && w.kmDay != null ? Math.min(1.5, w.kmDay / TYPICAL[sp.group]) : 0);

export function weekSummary(frac = todayFraction()) {
  const b = binOf(frac);
  const rows = state.index.species
    .map((sp) => ({ sp, w: sp.weeks?.bins[b], next: sp.weeks?.bins[(b + 1) % BINS] }))
    .filter((r) => r.w && r.w.n >= 3);
  const now = [...rows].sort((x, y) => busy(y.sp, y.w) - busy(x.sp, x.w)).slice(0, 4);
  const rising = rows
    .filter((r) => !now.includes(r) && busy(r.sp, r.next) > busy(r.sp, r.w) * 1.4 && busy(r.sp, r.next) > 0.25)
    .sort((x, y) => (busy(y.sp, y.next) - busy(y.sp, y.w)) - (busy(x.sp, x.next) - busy(x.sp, x.w)))
    .slice(0, 2);
  return { b, now, rising };
}

function line({ sp, w }) {
  const where = placeText(w.place, sp.weeks.names);
  const how = w.heading != null ? t('heading {dir}, about {speed}', { dir: t(COMPASS[Math.round(w.heading / 45) % 8]), speed: fmtSpeed(w.kmDay) })
    : w.kmDay >= 15 ? t('moving about, {speed}', { speed: fmtSpeed(w.kmDay) }) : t('mostly staying put');
  return `${t('{n} tracked', { n: w.n })} · ${how}${where ? ` · ${where}` : ''}`;
}

// The card's HTML (placed at the top of the All migrations card).
export function thisWeekHtml() {
  if (!state.index.species.some((s) => s.weeks)) return '';
  const frac = todayFraction();
  const { now, rising } = weekSummary(frac);
  if (!now.length) return '';
  const mode = colorMode();
  const from = fmtSeason(Math.floor(frac * BINS) / BINS);
  const to = fmtSeason(Math.min(0.9999, (Math.floor(frac * BINS) + 1) / BINS - 1 / 365));
  return `<section class="thisweek" aria-label="${esc(t('This week in migration'))}">
    <p class="kicker">${esc(t('This week in migration'))} · ${esc(from)}–${esc(to)}</p>
    <ul>${now.map((r) => `<li><button class="tw-row" data-id="${r.sp.id}" style="--sp:${colorFor(r.sp.id, mode)}">
      ${iconHtml(r.sp.id, 'sil sil-sm')}<span><b>${esc(r.sp.name)}</b><small>${esc(line(r))}</small></span></button></li>`).join('')}</ul>
    ${rising.length ? `<p class="small muted">${esc(t('Coming up: {names} pick up the pace.', { names: rising.map((r) => r.sp.name).join(', ') }))}</p>` : ''}
    <button class="btn" data-act="thisweek">${esc(t('Watch this week'))}</button>
  </section>`;
}

// Wire the card's buttons after it's in the page.
export function wireThisWeek(root) {
  const frac = todayFraction();
  const go = async (id) => {
    await ctl.select(id);
    ctl.setMode('season');
    state.frac = frac;
    ctl.frame();
    ctl.setPlaying(true);
  };
  root.querySelectorAll('.tw-row').forEach((b) => b.addEventListener('click', () => go(b.dataset.id)));
  root.querySelector('[data-act="thisweek"]')?.addEventListener('click', () => go('all'));
}
