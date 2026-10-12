// Keep the globe smooth on slower devices. While the globe is moving or
// playing, frames are timed in two-second windows. With Quality on Auto, two
// slow windows in a row (under 28 frames a second) step detail down one level;
// a long run of fast ones steps it back up. The levels only lower what's drawn
// for now; the person's own settings are never changed.

import { map, quality, setEffects, applyTerrain, setNightVisible } from './globe.js';
import { settings } from './settings.js';
import { state, t } from './store.js';

const LEVELS = [
  { label: 'full detail' },
  { label: 'no glow', effects: false },
  { label: 'lighter', effects: false, sharpness: 1, trailDays: 30 },
  { label: 'lightest', effects: false, sharpness: 1, trailDays: 14, terrain: false, night: false },
];
const WINDOW_MS = 2000;
const SLOW_FPS = 28;
const FAST_FPS = 55;
const WARM_UP_MS = 10000; // the first seconds (shaders compiling, tiles loading) don't count

let level = 0;
let toast = () => {};
let win = { start: 0, frames: 0, busyMs: 0 };
let last = 0;
let slowRuns = 0;
let fastRuns = 0;
let lastChange = 0;
let lockedAt = Infinity; // a step up that had to be undone: don't try again this visit
let fps = null;

export const qualityLevel = () => level;
export const currentFps = () => fps;

export function initPerf(opts) {
  toast = opts.toast;
  showMeter();
  requestAnimationFrame(loop);
}

// The person's Quality setting changed: back to full detail if they chose it.
export function onQualitySetting() {
  if (settings.quality === 'high' && level) setLevel(0, true);
  showMeter();
}

function loop(now) {
  const dt = now - last;
  last = now;
  const busy = state.playing || map.isMoving() || map.isZooming() || map.isRotating();
  if (busy && dt > 0 && dt < 1000 && document.visibilityState === 'visible') { // skip pauses (hidden tab, sleep)
    win.frames++;
    win.busyMs += dt;
  }
  if (now - win.start >= WINDOW_MS) {
    if (win.busyMs > WINDOW_MS * 0.6 && now > WARM_UP_MS) judge((win.frames / win.busyMs) * 1000);
    win = { start: now, frames: 0, busyMs: 0 };
  }
  requestAnimationFrame(loop);
}

function judge(f) {
  fps = f;
  showMeter();
  if (settings.quality !== 'auto') return;
  const now = performance.now();
  slowRuns = f < SLOW_FPS ? slowRuns + 1 : 0;
  fastRuns = f > FAST_FPS ? fastRuns + 1 : 0;
  if (slowRuns >= 2 && level < LEVELS.length - 1) {
    if (now - lastChange < 20000 && lastChange) lockedAt = level; // the last step up didn't hold
    setLevel(level + 1);
    toast(t('Lowered detail ({level}) to keep things smooth. Settings → Quality.', { level: t(LEVELS[level].label) }));
  } else if (fastRuns >= 8 && level > 0 && level - 1 < lockedAt && now - lastChange > 30000) {
    setLevel(level - 1);
  }
}

function setLevel(n, quiet = false) {
  level = n;
  slowRuns = 0;
  fastRuns = 0;
  lastChange = quiet ? 0 : performance.now();
  const L = LEVELS[n];
  quality.effects = L.effects !== false;
  quality.terrain = L.terrain !== false;
  quality.night = L.night !== false;
  quality.trailDays = L.trailDays ?? Infinity;
  map.setPixelRatio(L.sharpness ? Math.min(L.sharpness, window.devicePixelRatio || 1) : window.devicePixelRatio || 1);
  setEffects();
  applyTerrain();
  setNightVisible();
  showMeter();
}

function showMeter() {
  const el = document.getElementById('fps');
  if (!el) return;
  el.hidden = !settings.showFps;
  if (!settings.showFps) return;
  el.textContent = `${fps == null ? '—' : Math.round(fps)} fps${level ? ` · ${t(LEVELS[level].label)}` : ''}`;
  el.classList.toggle('slow', fps != null && fps < SLOW_FPS);
}
