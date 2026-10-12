// The Layers popover (basemap, NASA overlay, terrain, effects) and the
// overlay legend in the corner.

import { settings, updateSettings } from './settings.js';
import { ENV_LAYERS } from './environment.js';
import { state, on, speciesById, esc, fmtMonthYear, t } from './store.js';

const $ = (s) => document.querySelector(s);

export function renderLayers() {
  const pop = $('#layers-pop');
  const group = state.selected === 'all' ? null : speciesById(state.selected).group;
  pop.querySelectorAll('input[name="basemap"]').forEach((r) => { r.checked = r.value === settings.basemap; });
  const list = $('#overlay-list');
  list.innerHTML = '';
  for (const [key, label] of [['none', 'None'], ...Object.entries(ENV_LAYERS).map(([k, L]) => [k, L.title])]) {
    const L = ENV_LAYERS[key];
    if (key === 'vegetation' || key === 'footprint') {
      const h = document.createElement('div');
      h.className = 'legend-group';
      h.textContent = t(key === 'vegetation' ? 'Nature, by date' : 'People');
      list.append(h);
    }
    const id = `ov-${key}`;
    const row = document.createElement('label');
    row.className = 'radio-row';
    row.htmlFor = id;
    row.innerHTML = `<input type="radio" name="overlay" id="${id}" value="${key}" ${settings.overlay === key ? 'checked' : ''}>
      <span><b>${esc(t(label))}</b>${L ? `<small>${esc(L.detail)}</small>` : ''}</span>
      ${L && group && L.for.includes(group) ? `<em class="badge">${t('suits this one')}</em>` : ''}`;
    row.querySelector('input').addEventListener('change', () => updateSettings({ overlay: key }));
    list.append(row);
  }
  for (const name of ['terrain', 'nightShade', 'effects', 'showRoutes', 'showStops']) {
    pop.querySelector(`input[name="${name}"]`).checked = settings[name];
  }
}

export function wireLayers() {
  const btn = $('#layers-btn');
  const pop = $('#layers-pop');
  btn.addEventListener('click', () => {
    const open = pop.hidden;
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) renderLayers();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  pop.querySelectorAll('input[name="basemap"]').forEach((r) => r.addEventListener('change', () => updateSettings({ basemap: r.value })));
  for (const name of ['terrain', 'nightShade', 'effects', 'showRoutes', 'showStops']) {
    pop.querySelector(`input[name="${name}"]`).addEventListener('change', (e) => updateSettings({ [name]: e.target.checked }));
  }
}

function renderLegend(shown) {
  const box = $('#legend');
  const key = settings.overlay;
  const L = ENV_LAYERS[key];
  const lg = state.assets?.layers?.[key];
  if (!L || !lg || !shown) { box.hidden = true; return; }
  box.hidden = false;
  $('#legend-title').textContent = L.title;
  $('#legend-date').textContent = shown.fixed ? '1995–2004'
    : L.period === 'static' || L.period === 'year' ? String(shown.year)
      : (L.period === 'week' ? `${Number(shown.date.slice(8))} ` : '') + fmtMonthYear(shown.date);
  $('#legend-shift').hidden = !shown.shifted;
  $('#legend-ramp').style.background = `linear-gradient(90deg, ${lg.stops.join(',')})`;
  $('#legend-min').textContent = t(String(lg.min));
  $('#legend-max').textContent = `${t(String(lg.max))} ${t(lg.units || '')}`.trim();
  $('#legend-why').textContent = L.why;
}

on('overlay', renderLegend);
on('selection', () => { if (!$('#layers-pop').hidden) renderLayers(); });
