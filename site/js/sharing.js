// Sharing the view: the link in the address bar (kept up to date, and read
// back when a shared link opens), the Share menu (link, embed code, video)
// and embed mode.

import { settings, updateSettings } from './settings.js';
import { map, viewPadding } from './globe.js';
import { encodeView, cameraString } from './share.js';
import { record, canRecord } from './record.js';
import { startTour } from './tour.js';
import { startFollow } from './follow.js';
import { startStory } from './story.js';
import { applyFilter } from './panel.js';
import { toast } from './ui.js';
import { state, on, speciesById, facetsOf } from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null; // { select, setMode, setPlaying, frame }

export const fullUrl = () => location.href.replace(/[?&]embed=1/, '');

export function initSharing(controller) {
  ctl = controller;
  const sharePop = $('#share-pop');
  $('#share-btn').addEventListener('click', () => {
    writeHash(true);
    sharePop.hidden = !sharePop.hidden;
    $('#share-btn').setAttribute('aria-expanded', String(!sharePop.hidden));
    $('#share-record').disabled = !canRecord();
    if (!canRecord()) $('#share-record').title = 'This browser can\u2019t record video';
  });
  document.addEventListener('pointerdown', (e) => {
    if (!sharePop.hidden && !sharePop.contains(e.target) && !$('#share-btn').contains(e.target)) sharePop.hidden = true;
  });
  const copy = async (text, ok) => {
    try { await navigator.clipboard.writeText(text); toast(ok); } catch { toast(`Copy this: ${text}`); }
    sharePop.hidden = true;
  };
  $('#share-link').addEventListener('click', () => { writeHash(true); copy(fullUrl(), 'Link copied. It opens at this exact moment.'); });
  $('#share-embed').addEventListener('click', () => {
    writeHash(true);
    const src = fullUrl().replace(/(#|$)/, (m) => `${location.search ? '&' : '?'}embed=1${m}`);
    copy(`<iframe src="${src}" width="960" height="560" style="border:0;border-radius:12px" title="Track the Migration" allow="fullscreen" loading="lazy"></iframe>`,
      'Embed code copied. Paste it into any web page.');
  });
  $('#share-record').addEventListener('click', () => { sharePop.hidden = true; startRecording(); });
  for (const ev of ['selection', 'mode', 'follow', 'story', 'story-scene', 'filter', 'overlay']) on(ev, () => writeHash());
  map.on('moveend', () => writeHash());
}

// ---------- the link in the address bar ----------

let hashTimer = 0;
let applyingHash = true; // until startup has read any shared link, never overwrite it
export function writeHash(now = false) {
  if (applyingHash) return;
  clearTimeout(hashTimer);
  const write = () => {
    if (applyingHash) return;
    const h = encodeView(cameraString(map));
    if (location.hash.slice(1) !== h) history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
  };
  if (now) write(); else hashTimer = setTimeout(write, 600);
}

// Startup found no shared link: start keeping the address bar in step.
export function startWritingHash() { applyingHash = false; }

export async function applySharedView(view) {
  applyingHash = true;
  try {
    const valid = view.species === 'all' || state.index.species.some((s) => s.id === view.species);
    const id = valid ? view.species : 'all';
    await ctl.select(id, { frame: !view.camera && !view.follow && view.story == null });
    if (view.overlay && view.overlay !== settings.overlay) updateSettings({ overlay: view.overlay });
    if (id !== 'all') {
      const keys = new Set(facetsOf(id).flatMap((f) => f.values.map((v) => `${f.key}=${v.value}`)));
      for (const h of view.hidden) if (keys.has(h)) state.hidden.add(h);
      if (facetsOf(id).some((f) => f.key === view.colorBy)) state.colorBy = view.colorBy;
      if (state.hidden.size || state.colorBy) applyFilter();
    }
    if (view.story != null && id !== 'all') {
      await startStory(id, view.story);
      return true;
    }
    if (view.tour) {
      await startTour();
      return true;
    }
    const animal = id !== 'all' && view.follow
      ? state.data.get(id).animals.find((a) => String(a.id) === view.follow)
      : null;
    if (animal) {
      if (view.t != null) { ctl.setMode('dates'); state.t = view.t; }
      await startFollow(id, animal);
    } else if (view.mode) {
      ctl.setMode(view.mode);
      if (view.mode === 'dates' && view.t != null) state.t = Math.min(state.range[1], Math.max(state.range[0], view.t));
      if (view.mode === 'season' && view.frac != null) state.frac = view.frac;
    }
    if (view.camera && !animal) map.jumpTo({ ...view.camera, padding: viewPadding() });
    ctl.frame();
    return true;
  } finally {
    applyingHash = false;
    writeHash();
  }
}

// ---------- record a short video ----------

let recording = null;
function startRecording() {
  if (recording) return;
  ctl.setPlaying(true);
  const btn = $('#rec-stop');
  $('#rec').hidden = false;
  recording = record({
    seconds: 12,
    getText: () => {
      const sp = state.follow ? speciesById(state.follow.species) : state.selected !== 'all' ? speciesById(state.selected) : null;
      const title = state.race ? 'The race' : sp ? `${sp.name}${state.follow ? ` · ${state.follow.animal.id}` : ''}` : 'Every migration';
      const subtitle = state.story ? $('#story-title').textContent : sp ? sp.region : `${state.index.species.length} species, real tracking data`;
      return { title, subtitle, date: $('#time-label').textContent, year: $('#time-year').textContent };
    },
    onTick: (left) => { $('#rec-left').textContent = `${Math.ceil(left)} s`; },
    onDone: (blob, ext) => {
      recording = null;
      $('#rec').hidden = true;
      const name = `track-the-migration-${state.selected}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
      toast(`Saved ${name}`);
    },
  });
  btn.onclick = () => recording?.stop();
}

// Embed mode (?embed=1): just the globe, the clock and a link to the full site.
export function setupEmbed() {
  if (!new URLSearchParams(location.search).has('embed')) return;
  document.body.classList.add('embed');
  const link = $('#embed-link');
  link.hidden = false;
  const sync = () => { link.href = fullUrl(); };
  sync();
  window.addEventListener('hashchange', sync);
  setInterval(sync, 2000);
}
