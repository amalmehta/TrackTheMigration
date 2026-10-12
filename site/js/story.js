// Plays a species' guided story: each scene sets the time, the camera, an
// optional NASA overlay, and sometimes rides along with one animal.

import { STORIES } from './stories.js';
import { colorFor } from './palette.js';
import { settings, updateSettings } from './settings.js';
import { map, frameBounds, frameSpecies, headBounds, viewPadding } from './globe.js';
import { state, emit, speciesById, fmtDist, esc, iconHtml, year, dur, isVisible } from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null;   // { select, setMode, setPlaying, frame, follow, stopFollow, setSpeed }
let saved = null; // the person's overlay, speed and mode, restored when the story ends

export const hasStory = (id) => !!STORIES[id];

export function initStory(controller) {
  ctl = controller;
  $('#story-next').addEventListener('click', () => go(state.story.index + 1));
  $('#story-prev').addEventListener('click', () => go(state.story.index - 1));
  $('#story-exit').addEventListener('click', () => stopStory());
  window.addEventListener('keydown', (e) => {
    if (!state.story || e.target?.closest?.('input, textarea, select, dialog')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(state.story.index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(state.story.index - 1); }
    if (e.key === 'Escape') stopStory();
  });
}

export async function startStory(id, scene = 0) {
  if (state.follow) ctl.stopFollow();
  if (state.selected !== id) await ctl.select(id, { frame: false });
  // Restarting mid-story keeps the settings from before the first start.
  if (!state.story) saved = { overlay: settings.overlay, speed: $('#speed-select').value, mode: state.mode };
  state.story = { species: id, index: -1 };
  document.body.classList.add('in-story');
  const sp = speciesById(id);
  const card = $('#story');
  card.style.setProperty('--sp', colorFor(id, 'dark'));
  $('#story-icon').innerHTML = iconHtml(id, 'sil sil-lg');
  $('#story-kicker').textContent = `${sp.name} · ${STORIES[id].title}`;
  const dots = $('#story-dots');
  dots.innerHTML = '';
  STORIES[id].scenes.forEach((sc, i) => {
    const b = document.createElement('button');
    b.className = 'dot';
    b.setAttribute('aria-label', `Scene ${i + 1}: ${sc.title}`);
    b.addEventListener('click', () => go(i));
    dots.append(b);
  });
  card.hidden = false;
  emit('story', state.story);
  await go(Math.min(scene, STORIES[id].scenes.length - 1));
}

export function stopStory() {
  if (!state.story) return;
  const id = state.story.species;
  state.story = null;
  $('#story').hidden = true;
  document.body.classList.remove('in-story');
  if (state.follow) ctl.stopFollow();
  if (saved) {
    if (settings.overlay !== saved.overlay) updateSettings({ overlay: saved.overlay });
    ctl.setSpeed(saved.speed);
    ctl.setMode(saved.mode);
  }
  frameSpecies(speciesById(id));
  emit('story', null);
}

// Story text with {placeholders} filled from the tracks (full data, or the overview).
export const fillStoryText = (text, id) => fill(text, id);

function fill(text, id) {
  const d = state.data.get(id) || state.overview?.get(id);
  const sp = speciesById(id);
  const longest = [...d.animals].sort((a, b) => b.km - a.km)[0];
  const ys = year(sp.stats.start) === year(sp.stats.end) ? year(sp.stats.start) : `${year(sp.stats.start)}–${year(sp.stats.end)}`;
  return esc(text)
    .replaceAll('{animals}', String(sp.stats.animalsShown))
    .replaceAll('{years}', ys)
    .replaceAll('{longestId}', `<b>${esc(longest.id)}</b>`)
    .replaceAll('{longestKm}', `<b>${fmtDist(longest.km)}</b>`);
}

async function go(i) {
  const st = state.story;
  if (!st) return;
  const scenes = STORIES[st.species].scenes;
  if (i < 0 || i >= scenes.length) {
    if (i >= scenes.length) stopStory();
    return;
  }
  st.index = i;
  const sc = scenes[i];
  const id = st.species;
  emit('story-scene', i);

  // Text
  $('#story-title').textContent = sc.title;
  $('#story-text').innerHTML = fill(sc.text, id);
  $('#story-count').textContent = `${i + 1} / ${scenes.length}`;
  $('#story-prev').disabled = i === 0;
  $('#story-next').textContent = i === scenes.length - 1 ? 'Finish' : 'Next';
  [...$('#story-dots').children].forEach((d, k) => d.setAttribute('aria-current', String(k === i)));

  // Overlay and speed
  const wantOverlay = sc.overlay || 'none';
  if (settings.overlay !== wantOverlay) updateSettings({ overlay: wantOverlay });
  ctl.setSpeed(String(sc.speed || 5));

  // Follow an animal, or set the time and frame the view.
  if (sc.follow === 'longest') {
    const longest = state.data.get(id).animals.filter(isVisible).sort((a, b) => b.km - a.km)[0]
      || [...state.data.get(id).animals].sort((a, b) => b.km - a.km)[0];
    await ctl.follow(id, longest, { fromStory: true });
    ctl.setPlaying(true);
    return;
  }
  if (state.follow) ctl.stopFollow();
  ctl.setMode('season');
  const [mm, dd] = sc.at.split('-').map(Number);
  state.frac = (Date.UTC(2001, mm - 1, dd) - Date.UTC(2001, 0, 1)) / (365 * 86400000);
  ctl.frame();
  const sp = speciesById(id);
  if (sc.view === 'species') frameSpecies(sp);
  else if (sc.view === 'heads') {
    const b = headBounds();
    if (b) frameBounds(b, { pitch: sp.group === 'land' ? 55 : 15, maxZoom: sp.group === 'land' ? 9 : 5, duration: 2600 });
  } else {
    map.flyTo({ ...sc.view, padding: viewPadding(), duration: dur(3200), essential: true });
  }
  ctl.setPlaying(true);
}
