// Small shared pieces of interface: the toast, button icons, the feedback
// tab and the starfield behind the globe.

import { state, speciesById } from './store.js';
import { lang } from './i18n.js';

const REPO = 'amalmehta/TrackTheMigration';
const $ = (s) => document.querySelector(s);

let toastTimer = 0;
export function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

export const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
export const followIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
export const atlasIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>';
export const gameIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3"/></svg>';
export const chartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>';
export const pinIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';

// Save a blob as a file.
export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}

// Feedback opens a pre-filled GitHub issue (no server needed).
export function initFeedback() {
  const fb = $('#feedback-dialog');
  $('#feedback-tab').addEventListener('click', () => fb.showModal());
  $('#feedback-form').addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'send') return;
    const text = $('#fb-text').value.trim();
    if (!text) return;
    const view = state.selected === 'all' ? 'All migrations' : speciesById(state.selected).name;
    const body = `${text}\n\n---\nView: ${view} · ${state.mode} mode · ${lang}`;
    const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent('Feedback: ' + text.slice(0, 60))}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
    $('#fb-text').value = '';
  });
}

// ---------- starfield ----------

export function drawStars() {
  const c = $('#stars');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  // Deterministic pseudo-random so the sky doesn't reshuffle on resize.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const band = g.createLinearGradient(0, c.height, c.width, 0);
  band.addColorStop(0.3, 'rgba(60,80,140,0)');
  band.addColorStop(0.5, 'rgba(90,110,180,0.10)');
  band.addColorStop(0.7, 'rgba(60,80,140,0)');
  g.fillStyle = band;
  g.fillRect(0, 0, c.width, c.height);
  const n = Math.round((innerWidth * innerHeight) / 1800);
  for (let i = 0; i < n; i++) {
    const x = rnd() * c.width;
    const y = rnd() * c.height;
    const r = (rnd() ** 3 * 1.3 + 0.25) * dpr;
    const a = 0.25 + rnd() * 0.75;
    const hue = rnd() < 0.15 ? '200,220,255' : rnd() < 0.1 ? '255,230,200' : '255,255,255';
    g.fillStyle = `rgba(${hue},${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}
