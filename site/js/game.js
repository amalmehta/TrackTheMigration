// Guess where: the globe stops at a real moment in a real animal's journey.
// Tap where you think it will be in 30 days; it plays forward and you score
// by how close you were, scaled to how far it actually went.

import { positionAt, haversineKm } from './tracks.js';
import { colorFor } from './palette.js';
import { map, colorMode, setGuess, refreshRoutes, refreshSites, viewPadding } from './globe.js';
import { state, emit, speciesById, keyOf, loadSpecies, fmtDate, fmtDist, esc, iconHtml, t, num } from './store.js';

const $ = (s) => document.querySelector(s);
const ROUNDS = 10;
const AHEAD_DAYS = 30;
// The smallest move worth guessing, by group (km in 30 days).
const MIN_MOVE = { land: 12, marine: 150, birds: 250 };
let ctl = null; // { select, setMode, setPlaying, frame, stopFollow, stopStory, stopRace, setSpeed }
let game = null;

export const inGame = () => !!game;

export function initGame(controller) {
  ctl = controller;
  $('#game-go').addEventListener('click', () => lockIn());
  $('#game-next').addEventListener('click', () => nextRound());
  $('#game-exit').addEventListener('click', () => stopGame());
  $('#game-copy').addEventListener('click', async () => {
    const text = `${t('I scored {score} / {max} guessing where real migrating animals went next.', { score: num(game.total), max: num(ROUNDS * 1000) })} ${location.origin}${location.pathname}`;
    try { await navigator.clipboard.writeText(text); $('#game-copy').textContent = t('Copied'); } catch { $('#game-copy').textContent = text; }
  });
  map.on('click', (e) => {
    if (!game || game.phase !== 'guess') return;
    game.guess = [e.lngLat.lng, e.lngLat.lat];
    drawGuess();
    $('#game-go').disabled = false;
  });
}

// A random real moment with a meaningful 30-day move ahead (loads species as needed).
async function pickRound(used) {
  const species = state.index.species;
  for (let attempt = 0; attempt < 400; attempt++) {
    const sp = species[Math.floor(Math.random() * species.length)];
    const d = await loadSpecies(sp.id);
    const a = d.animals[Math.floor(Math.random() * d.animals.length)];
    const p0 = a.pts[0][2];
    const p1 = a.pts[a.pts.length - 1][2] - AHEAD_DAYS * 24;
    if (p1 <= p0) continue;
    const t0 = p0 + Math.random() * (p1 - p0);
    const from = positionAt(a.pts, t0, d.maxGapHours);
    const to = positionAt(a.pts, t0 + AHEAD_DAYS * 24, d.maxGapHours);
    if (!from || !to) continue;
    const km = haversineKm(from, to);
    if (km < MIN_MOVE[sp.group]) continue;
    const key = `${keyOf(sp.id, a)}@${Math.round(t0 / 240)}`;
    if (used.has(key)) continue;
    used.add(key);
    return { species: sp.id, animal: a, t0, from, to, km };
  }
  return null;
}

export async function startGame() {
  if (state.story) ctl.stopStory();
  if (state.follow) ctl.stopFollow();
  if (state.race) ctl.stopRace();
  game = { round: 0, total: 0, used: new Set(), results: [], phase: 'idle', mode: state.mode };
  document.body.classList.add('gaming');
  $('#game').hidden = false;
  emit('game', true);
  nextRound();
}

export function stopGame() {
  if (!game) return;
  const { mode } = game;
  game = null;
  state.only = null;
  setGuess([]);
  document.body.classList.remove('gaming');
  $('#game').hidden = true;
  ctl.setPlaying(false);
  emit('game', false);
  ctl.select('all').then(() => ctl.setMode(mode));
}

async function nextRound() {
  if (game.round >= ROUNDS) return finish();
  const r = await pickRound(game.used);
  if (!r) return finish();
  game.round++;
  game.current = r;
  game.guess = null;
  game.phase = 'guess';
  ctl.setPlaying(false);
  await ctl.select(r.species, { frame: false });
  state.only = keyOf(r.species, r.animal);
  ctl.setMode('dates');
  state.t = r.t0;
  refreshRoutes();
  refreshSites();
  setGuess([]);
  ctl.frame();
  // Frame a window around the animal sized to how far animals like it move in a month.
  const reach = Math.max(r.km * 1.6, MIN_MOVE[speciesById(r.species).group] * 3);
  const dLat = reach / 111;
  const dLon = reach / (111 * Math.max(0.2, Math.cos((r.from[1] * Math.PI) / 180)));
  const cam = (() => { try { return map.cameraForBounds([[r.from[0] - dLon, r.from[1] - dLat], [r.from[0] + dLon, r.from[1] + dLat]], { padding: viewPadding() }); } catch { return null; } })();
  map.easeTo({ center: r.from, zoom: Math.max(1.2, Math.min(9, cam ? cam.zoom : 4)), pitch: 0, bearing: 0, padding: viewPadding(), duration: 1400 });
  const sp = speciesById(r.species);
  const card = $('#game');
  card.style.setProperty('--sp', colorFor(r.species, 'dark'));
  $('#game-icon').innerHTML = iconHtml(r.species, 'sil sil-lg');
  $('#game-round').textContent = t('Round {n} of {total} · score {score}', { n: game.round, total: ROUNDS, score: num(game.total) });
  $('#game-title').textContent = t('Where will {name} {id} be in {n} days?', { name: sp.name, id: r.animal.id, n: AHEAD_DAYS });
  $('#game-text').innerHTML = t("It's <b>{date}</b>. {name} {id} is at the glowing dot, with its last month behind it. Tap the globe where you think it will be on {then}.", { date: esc(fmtDate(r.t0)), name: esc(sp.name), id: esc(r.animal.id), then: esc(fmtDate(r.t0 + AHEAD_DAYS * 24)) });
  $('#game-go').hidden = false;
  $('#game-go').disabled = true;
  $('#game-next').hidden = true;
  $('#game-copy').hidden = true;
}

function drawGuess(actual) {
  const f = [];
  const color = colorFor(game.current.species, colorMode());
  if (game.guess) f.push({ type: 'Feature', properties: { kind: 'guess' }, geometry: { type: 'Point', coordinates: game.guess } });
  if (actual) {
    f.push({ type: 'Feature', properties: { kind: 'actual', color }, geometry: { type: 'Point', coordinates: actual } });
    f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [game.guess, actual] } });
  }
  setGuess(f);
}

// Play the 30 days forward, then score.
function lockIn() {
  const r = game.current;
  if (!game.guess || game.phase !== 'guess') return;
  game.phase = 'reveal';
  $('#game-go').hidden = true;
  $('#game-text').textContent = t('Watch where it really went…');
  const t1 = r.t0 + AHEAD_DAYS * 24;
  const startWall = performance.now();
  const dur = 2600;
  const step = (now) => {
    const k = Math.min(1, (now - startWall) / dur);
    state.t = r.t0 + (t1 - r.t0) * (1 - (1 - k) ** 2);
    ctl.frame();
    if (k < 1 && game) requestAnimationFrame(step);
    else if (game) score();
  };
  requestAnimationFrame(step);
}

function score() {
  const r = game.current;
  const err = haversineKm(game.guess, r.to);
  const scale = Math.max(25, r.km * 0.5);
  const pts = Math.round(1000 * Math.exp(-err / scale));
  game.total += pts;
  game.results.push(pts);
  drawGuess(r.to);
  const verdict = t(pts >= 900 ? 'Spot on!' : pts >= 600 ? 'Close.' : pts >= 250 ? 'Not bad.' : 'It had other plans.');
  $('#game-round').textContent = t('Round {n} of {total} · score {score}', { n: game.round, total: ROUNDS, score: num(game.total) });
  $('#game-title').textContent = `+${num(pts)} · ${verdict}`;
  $('#game-text').innerHTML = t('You were <b>{miss}</b> off. In those {n} days it moved <b>{d}</b> in a straight line.', { miss: esc(fmtDist(err)), n: AHEAD_DAYS, d: esc(fmtDist(r.km)) });
  $('#game-next').hidden = false;
  $('#game-next').textContent = t(game.round >= ROUNDS ? 'See your score' : 'Next round');
}

function finish() {
  game.phase = 'done';
  state.only = null;
  setGuess([]);
  const best = ROUNDS * 1000;
  const pct = game.total / best;
  $('#game-round').textContent = t('Game over');
  $('#game-title').textContent = `${num(game.total)} / ${num(best)}`;
  $('#game-text').textContent = t(pct >= 0.7 ? 'You think like a migrant. Impressive.'
    : pct >= 0.4 ? 'A solid naturalist. The whales probably fooled you.'
      : 'Migration is hard to predict. That’s why scientists put tags on animals.');
  $('#game-next').hidden = true;
  $('#game-go').hidden = true;
  $('#game-copy').hidden = false;
  $('#game-copy').textContent = t('Copy my score');
}
