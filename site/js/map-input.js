// Pointer input on the globe: hover tips, click a dot or route to follow
// it (shift-click to add it to a race), and stopover sites.

import { map, viewPadding } from './globe.js';
import { toggleCompare, inCompare } from './race.js';
import { inGame } from './game.js';
import { startFollow, stopFollow } from './follow.js';
import { toast } from './ui.js';
import { state, speciesById, viewData, keyOf, esc, fmtDist, busiestMonths, t, num } from './store.js';

let ctl = null; // { select, setPlaying, setHighlight }

export function initMapInput(controller) {
  ctl = controller;
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'map-tip' });
  const animalFrom = (f) => viewData(f.properties.species)?.animals.find((a) => String(a.id) === String(f.properties.animal));
  for (const layer of ['heads', 'routes']) {
    map.on('click', layer, (e) => {
      if (inGame() || state.race) return;
      const f = e.features[0];
      const animal = animalFrom(f);
      if (!animal) return;
      if (e.originalEvent.shiftKey) {
        toggleCompare(f.properties.species, animal);
        toast(t(inCompare(f.properties.species, animal) ? 'Added to the race. Pick another, then press Race.' : 'Removed from the race.'));
        return;
      }
      startFollow(f.properties.species, animal);
      ctl.setPlaying(true);
    });
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; popup.remove(); });
  }
  map.on('mousemove', 'heads', (e) => {
    const p = e.features[0].properties;
    const sp = speciesById(p.species);
    const a = animalFrom(e.features[0]);
    popup.setLngLat(e.lngLat)
      .setHTML(`<div class="tip-date">${esc(sp.name)} · ${esc(p.animal)}${p.year ? ` · ${p.year}` : ''}</div>
        ${a ? `<div>${t('<b>{d}</b> tracked', { d: esc(fmtDist(a.km)) })}</div>` : ''}<div class="tip-hint">${inGame() || state.race ? '' : t('Click to follow · Shift-click to race')}</div>`)
      .addTo(map);
  });

  // Stopover sites: hover for who used them and when; click to pick those animals.
  const siteOf = (f) => viewData(f.properties.species)?.sites?.[f.properties.idx];
  map.on('mousemove', 'sites', (e) => {
    const f = e.features[0];
    const site = siteOf(f);
    if (!site) return;
    const sp = speciesById(f.properties.species);
    const peak = Math.max(...site.months) || 1;
    const bars = site.months.map((m, i) => `<rect x="${i * 9}" y="${22 - (m / peak) * 20}" width="7" height="${Math.max(1, (m / peak) * 20)}" rx="1.5"/>`).join('');
    popup.setLngLat(e.lngLat)
      .setHTML(`<div class="tip-date">${esc(sp.name)} · ${t('a place they stayed')}</div>
        <div>${t(site.animals.length === 1 ? '<b>{n}</b> animal' : '<b>{n}</b> animals', { n: site.animals.length })} · ${t('<b>{n}</b> animal-days', { n: num(site.days) })}</div>
        <div class="tip-months"><svg viewBox="0 0 108 22" width="108" height="22" fill="${f.properties.color}" aria-hidden="true">${bars}</svg>
        <span>${t('busiest: {m}', { m: esc(busiestMonths(site.months)) })}</span></div>
        <div class="tip-hint">${t('Click to pick these animals')}</div>`)
      .addTo(map);
  });
  map.on('mouseenter', 'sites', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'sites', () => { map.getCanvas().style.cursor = ''; popup.remove(); });
  map.on('click', 'sites', (e) => {
    if (map.queryRenderedFeatures(e.point, { layers: ['heads'] }).length) return; // a dot click wins
    const f = e.features[0];
    const site = siteOf(f);
    if (site) pickSite(f.properties.species, site);
  });
}

// Pick the animals that used a stopover site, and fly there.
export async function pickSite(speciesId, site) {
  if (state.follow) stopFollow();
  if (state.selected !== speciesId) await ctl.select(speciesId, { frame: false });
  ctl.setHighlight(new Set(site.animals.map((id) => keyOf(speciesId, id))));
  const group = speciesById(speciesId).group;
  map.easeTo({ center: [site.lon, site.lat], zoom: Math.max(map.getZoom(), group === 'land' ? 9 : 5), padding: viewPadding(), duration: 1600 });
}
