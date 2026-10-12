// Shareable links: the URL hash records what you're looking at, so a link
// opens at the same moment — species, date, the animal you're following,
// story scene, NASA overlay, filters and camera.
//
//   #s=white-stork&t=2003-09-12&f=Prinzesschen&ov=vegetation
//   #s=zebra&d=12-15&c=24.4,-20.1,7.2,55,0
//
// Keys: s species · m=dates · d MM-DD (Season view) · t YYYY-MM-DD (Dates view)
//       f followed animal · st story scene (1-based) · ov overlay · cb colour-by
//       hide facet=value,… · c camera lon,lat,zoom,pitch,bearing
//       near lon,lat,km + nm place name (who passed near; never your own location)

import { seasonToHours } from './tracks.js';
import { settings } from './settings.js';
import { state } from './store.js';

const pad = (n) => String(n).padStart(2, '0');

export function encodeView(camera) {
  const p = new URLSearchParams();
  if (state.tour) return 'tour=1';
  if (state.selected !== 'all') p.set('s', state.selected);
  if (state.story) {
    p.set('st', String(state.story.index + 1));
  } else {
    if (state.mode === 'dates') {
      const d = new Date(state.t * 3.6e6);
      p.set('t', `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    } else {
      const d = new Date(seasonToHours(2001, state.frac) * 3.6e6);
      p.set('d', `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    }
    if (state.follow) p.set('f', String(state.follow.animal.id));
    else if (camera) p.set('c', camera);
  }
  if (settings.overlay !== 'none') p.set('ov', settings.overlay);
  if (state.colorBy) p.set('cb', state.colorBy);
  if (state.hidden.size) p.set('hide', [...state.hidden].join(','));
  if (state.near && !state.near.private) {
    p.set('near', [state.near.lon.toFixed(3), state.near.lat.toFixed(3), state.near.r].join(','));
    p.set('nm', state.near.name);
  }
  return p.toString();
}

export function decodeView(hash) {
  const p = new URLSearchParams((hash || '').replace(/^#/, ''));
  if (![...p.keys()].length) return null;
  const view = {
    species: p.get('s') || 'all',
    story: /^\d+$/.test(p.get('st') || '') ? Math.max(0, Number(p.get('st')) - 1) : null,
    follow: p.get('f'),
    overlay: p.get('ov'),
    colorBy: p.get('cb'),
    hidden: p.get('hide') ? p.get('hide').split(',').filter(Boolean) : [],
    tour: p.has('tour'),
    camera: null,
    near: null,
    mode: null,
    frac: null,
    t: null,
  };
  const t = p.get('t');
  const th = t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? Date.parse(`${t}T12:00:00Z`) / 3.6e6 : NaN;
  if (Number.isFinite(th)) {
    view.mode = 'dates';
    view.t = th;
  }
  const d = p.get('d');
  if (d && /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)) {
    const [mm, dd] = d.split('-').map(Number);
    view.mode = 'season';
    view.frac = (Date.UTC(2001, mm - 1, dd, 12) - Date.UTC(2001, 0, 1)) / (365 * 86400000);
  }
  const nr = (p.get('near') || '').split(',').map(Number);
  if (nr.length === 3 && nr.every(Number.isFinite) && Math.abs(nr[1]) <= 90 && nr[2] > 0 && nr[2] <= 1000) {
    view.near = { lon: nr[0], lat: nr[1], r: nr[2], name: (p.get('nm') || 'this place').slice(0, 120) };
  }
  const c = (p.get('c') || '').split(',').map(Number);
  if (c.length === 5 && c.every(Number.isFinite)) {
    view.camera = { center: [c[0], c[1]], zoom: c[2], pitch: c[3], bearing: c[4] };
  }
  return view;
}

export const cameraString = (map) => {
  const c = map.getCenter();
  return [c.lng.toFixed(3), c.lat.toFixed(3), map.getZoom().toFixed(2), Math.round(map.getPitch()), Math.round(map.getBearing())].join(',');
};
