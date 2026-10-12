// Preferences, kept in one place: the Settings dialog (⌘, / Ctrl+,).
// Stored in this browser only (localStorage); everything works without it.

const KEY = 'ttm.settings';

export const DEFAULTS = Object.freeze({
  theme: 'dark',        // system | light | dark
  basemap: 'satellite', // satellite | theme
  terrain: true,
  exaggeration: 1.5,
  overlay: 'none',      // none | vegetation | sst | snow (NASA GIBS)
  nightShade: true,     // seasonal day/night shading on the globe
  effects: true,        // glowing trails, pulsing heads, starfield
  showRoutes: true,
  showStops: true,      // stopover and resting sites
  trailDays: 30,
  units: 'km',
  mode: 'season',       // season | dates
  speed: 7,             // days per second
  autoplay: true,
  motion: 'system',     // system | reduce | full — camera flights, pulsing, animations
  sound: false,         // listen to the migration
  volume: 0.6,
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (k in saved && typeof saved[k] === typeof DEFAULTS[k]) out[k] = saved[k];
    }
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();
const listeners = new Set();

export function onSettingsChange(fn) {
  listeners.add(fn);
}

export function updateSettings(patch) {
  const changed = Object.keys(patch).filter((k) => settings[k] !== patch[k]);
  if (changed.length === 0) return;
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  for (const fn of listeners) fn(changed, settings);
}

export function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
}

export function isDark() {
  if (settings.theme === 'dark') return true;
  if (settings.theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Wire the <dialog id="settings-dialog"> form to the settings object.
export function bindSettingsDialog(dialog, openButton) {
  const form = dialog.querySelector('form');
  const fields = [...form.elements].filter((el) => el.name && el.name in DEFAULTS);

  const fill = () => {
    for (const el of fields) {
      const v = settings[el.name];
      if (el.type === 'checkbox') el.checked = v;
      else el.value = String(v);
      const out = form.querySelector(`output[data-for="${el.name}"]`);
      if (out) out.textContent = el.name === 'volume' ? `${Math.round(v * 100)}%` : `${v}×`;
    }
  };
  const read = (el) => {
    const d = DEFAULTS[el.name];
    if (el.type === 'checkbox') return el.checked;
    if (typeof d === 'number') return Number(el.value);
    return el.value;
  };

  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!fields.includes(el)) return;
    updateSettings({ [el.name]: read(el) });
    fill();
  });
  form.querySelector('#settings-reset').addEventListener('click', () => {
    updateSettings({ ...DEFAULTS });
    fill();
  });

  const open = () => { fill(); if (!dialog.open) dialog.showModal(); };
  openButton.addEventListener('click', open);
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      open();
    }
  });
  return { open };
}
