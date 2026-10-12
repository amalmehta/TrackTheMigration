// A year on Earth: one calendar year of every migration in about three
// minutes. A "director" picks whichever migration is busiest at that time of
// year (favouring ones with a story scene near this date), flies there, dims
// the rest and captions it with that story's words.

import { positionAt, seasonalMovement, seasonToHours } from './tracks.js';
import { colorFor } from './palette.js';
import { frameBounds, frameSpecies } from './globe.js';
import { STORIES } from './stories.js';
import { fillStoryText } from './story.js';
import {
  state, emit, speciesById, keyOf, instanceTime, viewData, MONTHS_LONG, esc, iconHtml, reducedMotion,
} from './store.js';

const $ = (s) => document.querySelector(s);
const DAYS_PER_SECOND = 2;   // 365 days ≈ 3 minutes
const SEGMENT_DAYS = 18;     // how long the camera stays with one migration
let ctl = null;              // { select, setMode, setPlaying, setSpeed, frame, setHighlight, stopFollow, stopStory, stopRace }
let tour = null;
let activity = null;         // species id → 24 half-month activity levels (0–1)

export const inTour = () => !!tour;

export function initTour(controller) {
  ctl = controller;
  $('#tour-exit').addEventListener('click', () => stopTour());
  $('#tour-replay').addEventListener('click', () => startTour());
}

const dayOfYear = (frac) => frac * 365;
const sceneDay = (at) => {
  const [m, d] = at.split('-').map(Number);
  return (Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86400000;
};
const circDist = (a, b) => { const d = Math.abs(a - b) % 365; return Math.min(d, 365 - d); };

// Busy for its own kind: a pronghorn wandering 3 km a day shouldn't outrank
// a stork crossing the Sahara, so each species' peak is scaled against what's
// typical for land animals, sea animals or birds.
const TYPICAL_PEAK = { land: 10, marine: 50, birds: 200 };
function buildActivity() {
  activity = new Map();
  for (const sp of state.index.species) {
    const d = viewData(sp.id);
    const mv = seasonalMovement(d.animals.map((a) => a.pts), 24, d.maxGapHours);
    const max = Math.max(...mv.kmPerDay.map((v) => v || 0)) || 1;
    const vigor = Math.min(1, max / TYPICAL_PEAK[sp.group]) ** 0.5;
    activity.set(sp.id, mv.kmPerDay.map((v) => ((v || 0) / max) * vigor));
  }
}

// The story scene nearest today's date for a species (within a month), if any.
function nearestScene(id, day) {
  const scenes = STORIES[id]?.scenes.filter((s) => s.follow !== 'longest') || [];
  let best = null;
  for (const s of scenes) {
    const dist = circDist(sceneDay(s.at), day);
    if (dist <= 30 && (!best || dist < best.dist)) best = { scene: s, dist };
  }
  return best;
}

function movingCount(id) {
  let n = 0;
  for (const inst of state.instances) if (inst.species === id && positionAt(inst.pts, instanceTime(inst), inst.gap)) n++;
  return n;
}

// Pick the next migration to watch.
function choose(day) {
  const bin = Math.min(23, Math.floor((day / 365) * 24));
  let best = null;
  for (const sp of state.index.species) {
    if (sp.id === tour.current) continue;
    const moving = movingCount(sp.id);
    if (!moving) continue;
    const scene = nearestScene(sp.id, day);
    // Busy now, a story to tell, not just seen, and not shown too often already.
    const score = activity.get(sp.id)[bin] + (scene ? 0.6 - scene.dist / 60 : 0) + Math.min(0.2, moving / 100)
      - (tour.recent.includes(sp.id) ? 0.5 : 0) - 0.3 * (tour.counts.get(sp.id) || 0);
    if (!best || score > best.score) best = { id: sp.id, score, scene };
  }
  return best;
}

export async function startTour() {
  if (state.story) ctl.stopStory();
  if (state.follow) ctl.stopFollow();
  if (state.race) ctl.stopRace();
  await ctl.select('all', { frame: false });
  ctl.setMode('season');
  state.frac = 0;
  if (!activity) buildActivity();
  tour = { current: null, recent: [], counts: new Map(), segStart: -Infinity, ended: false };
  state.tour = true;
  document.body.classList.add('touring');
  $('#tour').hidden = false;
  $('#tour-replay').hidden = true;
  ctl.setSpeed(String(DAYS_PER_SECOND));
  ctl.frame();
  emit('tour', true);
  ctl.setPlaying(true);
  tourFrame();
}

export function stopTour() {
  if (!tour) return;
  tour = null;
  state.tour = false;
  document.body.classList.remove('touring');
  $('#tour').hidden = true;
  ctl.setHighlight(null);
  ctl.setPlaying(false);
  frameSpecies(null);
  emit('tour', false);
}

// Called every frame while touring.
export function tourFrame() {
  if (!tour) return;
  const day = dayOfYear(state.frac);
  $('#tour-month').textContent = MONTHS_LONG[new Date(seasonToHours(2001, state.frac) * 3.6e6).getUTCMonth()];
  $('#tour-bar').style.width = `${(state.frac * 100).toFixed(2)}%`;
  // The year wraps from December to January: that's the end of the tour.
  if (tour.lastDay != null && day < tour.lastDay - 100) return endTour();
  tour.lastDay = day;
  if (tour.ended || day - tour.segStart < SEGMENT_DAYS) return;
  const pick = choose(day);
  if (!pick) return;
  tour.current = pick.id;
  tour.recent = [pick.id, ...tour.recent].slice(0, 3);
  tour.counts.set(pick.id, (tour.counts.get(pick.id) || 0) + 1);
  tour.segStart = day;
  show(pick);
}

function show({ id, scene }) {
  const sp = speciesById(id);
  const d = viewData(id);
  ctl.setHighlight(new Set(d.animals.map((a) => keyOf(id, a))));
  // Frame where this species' animals are right now.
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const inst of state.instances) {
    if (inst.species !== id) continue;
    const p = positionAt(inst.pts, instanceTime(inst), inst.gap);
    if (!p) continue;
    if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0]; if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1];
  }
  if (Number.isFinite(w)) {
    const pad = Math.max(2, (e - w) * 0.25, (n - s) * 0.25);
    frameBounds([w - pad, s - pad, e + pad, n + pad], { pitch: sp.group === 'land' ? 45 : 15, maxZoom: sp.group === 'land' ? 8 : 4.5, duration: reducedMotion() ? 0 : 3500 });
  }
  const card = $('#tour');
  card.style.setProperty('--sp', colorFor(id, 'dark'));
  $('#tour-icon').innerHTML = iconHtml(id, 'sil sil-lg');
  $('#tour-species').textContent = sp.name;
  const caption = scene ? fillStoryText(scene.scene.text, id) : esc(sp.blurb);
  $('#tour-title').textContent = scene ? scene.scene.title : sp.region;
  $('#tour-text').innerHTML = caption;
}

function endTour() {
  tour.ended = true;
  ctl.setPlaying(false);
  ctl.setHighlight(null);
  frameSpecies(null);
  $('#tour-month').textContent = 'One year on Earth';
  $('#tour-species').textContent = `${state.index.species.length} migrations`;
  $('#tour-title').textContent = 'That was one year';
  $('#tour-text').textContent = 'Every track you saw is a real animal, tagged by researchers and shared openly. Pick any migration to explore it, or watch again.';
  $('#tour-icon').innerHTML = '';
  $('#tour-bar').style.width = '100%';
  $('#tour-replay').hidden = false;
  // In an embed, keep going round.
  if (document.body.classList.contains('embed')) setTimeout(() => { if (tour) startTour(); }, 6000);
}
