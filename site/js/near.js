// Who passed near: pick a place (search, or your own location) and a
// distance, and list every tracked animal that came that close, with the
// moment of its closest approach. Clicking one jumps to that moment.

import { passesNear } from './tracks.js';
import { colorFor } from './palette.js';
import { colorMode, frameBounds, setNear } from './globe.js';
import { startFollow } from './follow.js';
import {
  state, emit, loadOverview, loadSpecies, fmtDate, fmtDist, esc, iconHtml, t,
} from './store.js';

const $ = (s) => document.querySelector(s);
const RADII = [25, 50, 100, 250, 500]; // km
let ctl = null; // { select, setMode, setPlaying, frame }
let runId = 0;

export function initNear(controller) {
  ctl = controller;
  $('#near-radius').innerHTML = RADII.map((r) => `<option value="${r}" ${r === 100 ? 'selected' : ''}>${fmtDist(r)}</option>`).join('');
  $('#near-close').addEventListener('click', () => closeNear());
  $('#near-form').addEventListener('submit', (e) => { e.preventDefault(); search($('#near-q').value.trim()); });
  $('#near-locate').addEventListener('click', locate);
  $('#near-radius').addEventListener('change', () => { if (state.near) setPlace({ ...state.near, r: Number($('#near-radius').value) }); });
  $('#near').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNear(); });
}

export function openNear(place = null, { frame = true } = {}) {
  $('#near').hidden = false;
  document.body.classList.add('near-open');
  if (place) {
    $('#near-q').value = place.name || '';
    if (RADII.includes(place.r)) $('#near-radius').value = String(place.r);
    return setPlace(place, { frame });
  }
  $('#near-q').focus();
  return null;
}

export function closeNear() {
  if ($('#near').hidden) return;
  $('#near').hidden = true;
  document.body.classList.remove('near-open');
  state.near = null;
  runId++;
  setNear(null);
  emit('near', null);
}

const status = (text) => { $('#near-summary').textContent = text; };

// Place search with OpenStreetMap's Nominatim: one request per search, as its usage policy asks.
async function search(q) {
  if (!q) return;
  status(t('Looking it up…'));
  $('#near-choices').innerHTML = '';
  $('#near-list').innerHTML = '';
  let found = [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
    found = await (await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } })).json();
  } catch {
    status(t("Couldn't reach the place search. Try again, or use your location."));
    return;
  }
  if (!found.length) { status(t('No place called "{q}" found.', { q })); return; }
  const places = found.map((f) => ({ name: f.display_name.split(', ').slice(0, 3).join(', '), lon: Number(f.lon), lat: Number(f.lat) }));
  if (places.length === 1) { setPlace({ ...places[0], r: Number($('#near-radius').value) }); return; }
  status(t('Which one?'));
  $('#near-choices').innerHTML = places.map((p, i) => `<button class="chip" data-i="${i}">${esc(p.name)}</button>`).join('');
  $('#near-choices').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    $('#near-choices').innerHTML = '';
    setPlace({ ...places[Number(b.dataset.i)], r: Number($('#near-radius').value) });
  }));
}

// Your location is rounded to about 10 km, used only here, and never put in the link.
function locate() {
  if (!navigator.geolocation) { status(t("This browser can't share its location.")); return; }
  status(t('Finding you…'));
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const round = (v) => Math.round(v * 10) / 10;
      $('#near-q').value = '';
      setPlace({ name: t('your location'), lon: round(pos.coords.longitude), lat: round(pos.coords.latitude), r: Number($('#near-radius').value), private: true });
    },
    () => status(t('Location not available. Search for a place instead.')),
    { maximumAge: 600000, timeout: 15000 },
  );
}

async function setPlace(place, { frame = true } = {}) {
  state.near = place;
  setNear(place);
  if (frame) {
    const kx = 111.32 * Math.cos((place.lat * Math.PI) / 180);
    const dx = (place.r * 1.6) / kx;
    const dy = (place.r * 1.6) / 110.57;
    frameBounds([place.lon - dx, place.lat - dy, place.lon + dx, place.lat + dy], { maxZoom: 9, duration: 1800 });
  }
  emit('near', place);
  const id = ++runId;
  status(t('Searching every track…'));
  $('#near-list').innerHTML = '';
  const results = await findPasses(place);
  if (id !== runId) return; // a newer search started
  render(place, results);
}

// Overview tracks (≤ 180 points each) shortlist species with a wide margin;
// their full tracks then give the exact passes.
export async function findPasses(place) {
  const ov = await loadOverview();
  const margin = place.r + 300;
  const species = state.index.species.filter((sp) => ov.get(sp.id).animals.some((a) => passesNear(a.pts, [place.lon, place.lat], margin).length));
  const out = [];
  for (const sp of species) {
    const d = await loadSpecies(sp.id);
    for (const a of d.animals) {
      const visits = passesNear(a.pts, [place.lon, place.lat], place.r, { maxGapHours: d.maxGapHours });
      if (visits.length) out.push({ sp, a, visits, best: visits.reduce((m, v) => (v.km < m.km ? v : m)) });
    }
  }
  return out.sort((x, y) => x.best.km - y.best.km);
}

function render(place, results) {
  const where = place.private ? t('your location') : place.name;
  const list = $('#near-list');
  if (!results.length) {
    status(t('No tracked animal came within {d} of {where}. Try a larger distance.', { d: fmtDist(place.r), where }));
    list.innerHTML = '';
    return;
  }
  const bySpecies = new Map();
  for (const r of results) bySpecies.set(r.sp.id, (bySpecies.get(r.sp.id) || 0) + 1);
  status(t(results.length === 1 ? '{n} animal of {s} species came within {d} of {where}.' : '{n} animals of {s} species came within {d} of {where}.', { n: results.length, s: bySpecies.size, d: fmtDist(place.r), where }));
  const mode = colorMode();
  list.innerHTML = results.map((r, i) => {
    const more = r.visits.length - 1;
    return `<li><button class="near-row" data-i="${i}" style="--sp:${colorFor(r.sp.id, mode)}">
      ${iconHtml(r.sp.id, 'sil sil-sm')}
      <span class="near-text"><b>${esc(r.sp.name)} ${esc(r.a.id)}</b>
      <small>${r.best.km < 1 ? t('right here') : t('{d} away', { d: esc(fmtDist(r.best.km)) })} · ${esc(fmtDate(r.best.t))}${more ? ` · ${t(more === 1 ? '{n} more visit' : '{n} more visits', { n: more })}` : ''}</small></span>
    </button></li>`;
  }).join('');
  list.querySelectorAll('.near-row').forEach((b) => b.addEventListener('click', () => go(results[Number(b.dataset.i)])));
}

// Jump to the moment of closest approach, paused, riding along with the animal.
async function go({ sp, a, best }) {
  if (state.selected !== sp.id) await ctl.select(sp.id, { frame: false });
  ctl.setMode('dates');
  state.t = best.t;
  await startFollow(sp.id, a);
  ctl.setPlaying(false);
  ctl.frame();
}
