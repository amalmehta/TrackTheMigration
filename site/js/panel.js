// The side panel: the species list, the info card for the current
// selection, and "who they are" (filters, colour-by, stopover summary).

import { colorFor } from './palette.js';
import { settings, isDark } from './settings.js';
import { colorMode, refreshRoutes, refreshSites } from './globe.js';
import { startGame } from './game.js';
import { startTour } from './tour.js';
import { openAtlas } from './atlas.js';
import { openNear } from './near.js';
import { startFollow, stopFollow } from './follow.js';
import { renderCharts, setOpen as setChartsOpen } from './charts.js';
import { startStory, hasStory } from './story.js';
import { playIcon, followIcon, atlasIcon, gameIcon, chartIcon, pinIcon } from './ui.js';
import {
  state, emit, speciesById, fmtDist, esc, iconHtml, year, isVisible, facetsOf, facetShades, t, num,
} from './store.js';

const $ = (s) => document.querySelector(s);
let ctl = null; // { select, setPlaying, buildInstances, frame }

export function initPanel(controller) {
  ctl = controller;
}

export function renderSpeciesList() {
  const list = $('#species-list');
  list.innerHTML = '';
  const mode = colorMode(); // swatches are the map legend, so match the map
  for (const [group, label] of Object.entries(state.index.groups)) {
    const members = state.index.species.filter((s) => s.group === group);
    const title = document.createElement('div');
    title.className = 'group-title';
    title.innerHTML = `<i style="background:linear-gradient(90deg,${members.map((m) => colorFor(m.id, mode)).join(',')})"></i>${esc(label)}`;
    list.append(title);
    for (const sp of members) {
      const b = document.createElement('button');
      b.className = 'species-row';
      b.dataset.id = sp.id;
      b.setAttribute('aria-pressed', String(state.selected === sp.id));
      b.style.setProperty('--sw', colorFor(sp.id, mode));
      b.innerHTML = `${iconHtml(sp.id, 'sil row-icon')}
        <span class="row-text"><strong>${esc(sp.name)}</strong><small>${esc(sp.region)}</small></span>
        <span class="row-dist">${esc(fmtDist(sp.stats.longestKm))}</span>`;
      b.title = t('Longest track: {d}', { d: fmtDist(sp.stats.longestKm) });
      b.addEventListener('click', () => ctl.select(sp.id));
      list.append(b);
    }
  }
  const all = $('#all-btn');
  all.setAttribute('aria-pressed', String(state.selected === 'all'));
  const firsts = Object.keys(state.index.groups).map((g) => state.index.species.find((s) => s.group === g));
  firsts.forEach((s, i) => all.style.setProperty(`--c${i + 1}`, colorFor(s.id, mode)));
}

export function renderInfo() {
  const info = $('#info');
  info.hidden = false;
  if (state.selected === 'all') {
    const sp = state.index.species;
    const animals = sp.reduce((n, s) => n + s.stats.animalsShown, 0);
    info.style.removeProperty('--sp');
    info.innerHTML = `
      <p class="kicker">${t('Real tracking data · {n} migrations', { n: sp.length })}</p>
      <h2 class="hero-title">${t('{n} animals, one planet', { n: num(animals) })}</h2>
      <p>${t('Each glowing dot is one tagged animal; its tail is where it went over the last {n} days. In <b>Season</b> view every year an animal was tracked plays over one calendar year, so you can see who moves when.', { n: settings.trailDays })}</p>
      <div class="actions-row">
        <button class="btn primary" data-act="tour">${playIcon} ${t('A year on Earth')}</button>
        <button class="btn" data-act="calendar">${chartIcon} ${t('Migration calendar')}</button>
        <button class="btn" data-act="game">${gameIcon} ${t('Guess where')}</button>
        <button class="btn" data-act="atlas">${atlasIcon} ${t('Journey atlas')}</button>
        <button class="btn" data-act="near">${pinIcon} ${t('Who passed near…')}</button>
      </div>
      <p class="hint">${t('Pick a migration for its story, or click any dot to ride along with that animal. <b>Shift-click</b> dots from any species to race them against each other.')}</p>
      <details class="credits"><summary>${t('About the data')}</summary>
        <p>${t('All tracks are real GPS, Argos satellite or geolocator fixes from published, openly licensed data packages in the {movebank}. Each migration lists its citation. Silhouettes from {phylopic}; overlays from {gibs}.', {
    movebank: '<a href="https://datarepository.movebank.org" target="_blank" rel="noopener">Movebank Data Repository</a>',
    phylopic: '<a href="https://www.phylopic.org" target="_blank" rel="noopener">PhyloPic</a>',
    gibs: '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a>',
  })}</p></details>`;
    info.querySelector('[data-act="calendar"]').addEventListener('click', () => setChartsOpen(true));
    info.querySelector('[data-act="game"]').addEventListener('click', () => startGame());
    info.querySelector('[data-act="tour"]').addEventListener('click', () => startTour());
    info.querySelector('[data-act="atlas"]').addEventListener('click', () => openAtlas());
    info.querySelector('[data-act="near"]').addEventListener('click', () => openNear());
    return;
  }
  const s = speciesById(state.selected);
  const st = s.stats;
  const src = s.source;
  const icon = state.assets?.icons?.[s.id];
  const span = year(st.start) === year(st.end) ? year(st.start) : `${year(st.start)}–${year(st.end)}`;
  const thin = s.processing.thinHours ? t('at most one position per {h} h, ', { h: s.processing.thinHours }) : '';
  info.style.setProperty('--sp', colorFor(s.id, isDark() ? 'dark' : 'light'));
  info.innerHTML = `
    <div class="species-hero">
      ${iconHtml(s.id, 'sil hero-icon')}
      <div>
        <p class="kicker">${esc(s.groupName)}</p>
        <h2 class="hero-title">${esc(s.name)}</h2>
        <p class="sci">${esc(s.scientific)} · ${esc(s.region)}</p>
      </div>
    </div>
    <p>${esc(s.blurb)}</p>
    <div class="actions-row">
      ${hasStory(s.id) ? `<button class="btn primary" data-act="story">${playIcon} ${t('Tell me the story')}</button>` : ''}
      <button class="btn" data-act="follow">${followIcon} ${t('Follow the farthest')}</button>
      <button class="btn" data-act="charts">${chartIcon} ${t('Charts')}</button>
      <button class="btn" data-act="atlas">${atlasIcon} ${t('Atlas')}</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${st.animalsShown}${st.animalsShown < st.animalsInStudy ? `<small> ${t('of {n}', { n: st.animalsInStudy })}</small>` : ''}</b><span>${t('animals shown')}</span></div>
      <div class="stat"><b>${span}</b><span>${t('tracked')}</span></div>
      <div class="stat"><b>${fmtDist(st.medianKm)}</b><span>${t('typical distance per animal')}</span></div>
      <div class="stat"><b>${fmtDist(st.longestKm)}</b><span>${t('longest track')}</span></div>
    </div>
    <section id="who" class="who"></section>
    <details class="credits"><summary>${t('Data & credits')}</summary>
      <p><b>${t('Data:')}</b> ${esc(src.dataCitation)}
      ${src.doiUrl ? `<a href="${esc(src.doiUrl)}" target="_blank" rel="noopener">${esc(src.doi)}</a>` : ''}
      <span class="license">${src.licenseUrl ? `<a href="${esc(src.licenseUrl)}" target="_blank" rel="noopener">${esc(src.license)}</a>` : esc(src.license)}</span></p>
      ${src.paperCitation ? `<p><b>${t('Study:')}</b> ${esc(src.paperCitation)}</p>` : ''}
      <p class="muted">${t('Shown: the {n} longest-tracked animals; {thin}implausibly fast jumps removed; straight lines between fixes.', { n: st.animalsShown, thin })}</p>
      ${s.facets?.length ? `<p class="muted">${t('Sex, age, tagging site and handling come from the study\'s reference data.')}</p>` : ''}
      ${icon ? `<p class="muted">${t('Silhouette:')} ${esc(icon.attribution)}, <a href="${esc(icon.sourceUrl)}" target="_blank" rel="noopener">PhyloPic</a> (${esc(icon.license)}).</p>` : ''}
    </details>`;
  renderWho();
  info.querySelector('[data-act="story"]')?.addEventListener('click', () => startStory(s.id));
  info.querySelector('[data-act="charts"]').addEventListener('click', () => setChartsOpen(true));
  info.querySelector('[data-act="atlas"]').addEventListener('click', () => openAtlas(s.id));
  info.querySelector('[data-act="follow"]').addEventListener('click', () => {
    const longest = state.data.get(s.id).animals.filter(isVisible).sort((a, b) => b.km - a.km)[0];
    if (!longest) return;
    startFollow(s.id, longest);
    ctl.setPlaying(true);
  });
}

// ---------- who they are: filters, colour-by and stopover summary ----------

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function renderWho() {
  const el = document.getElementById('who');
  if (!el || state.selected === 'all') return;
  const id = state.selected;
  const sp = speciesById(id);
  const d = state.data.get(id);
  const facets = facetsOf(id);
  let html = '';
  if (facets.length) {
    html += `<div class="who-head"><span class="kicker">${t('Who they are')}</span>
      <label class="cb-select">${t('Colour by')} <select id="color-by" aria-label="${t('Colour animals by')}">
        <option value="">${t('species')}</option>
        ${facets.map((f) => `<option value="${f.key}" ${state.colorBy === f.key ? 'selected' : ''}>${esc(t(f.label).toLowerCase())}</option>`).join('')}
      </select></label></div>`;
    for (const f of facets) {
      const shades = state.colorBy === f.key ? facetShades(id, f.key, colorMode()) : null;
      html += `<div class="facet"><span class="facet-label">${esc(t(f.label))}</span><div class="chips">${f.values.map((v) => {
        const on = !state.hidden.has(`${f.key}=${v.value}`);
        return `<button class="chip facet-chip" aria-pressed="${on}" data-k="${esc(f.key)}" data-v="${esc(v.value)}" title="${esc(t(on ? 'Hide {v}' : 'Show {v}', { v: t(v.value) }))}">${
          shades ? `<i class="swatch-dot" style="background:${shades.get(v.value)}"></i>` : ''}${esc(cap(t(v.value)))} <small>${v.count}</small></button>`;
      }).join('')}</div></div>`;
    }
  }
  if (d?.sites?.length) {
    const stop = sp.processing.stop;
    html += `<div class="facet"><span class="facet-label">${t('Places they stayed')}</span>
      <p class="small muted">${t('{n} places where an animal stayed at least {days} days within {km} km.', { n: d.sites.length, days: stop.days, km: stop.km })}
      ${settings.showStops ? t('Rings on the globe; brighter when in use at this time of year. Click one to see who used it.') : t('Switch on <b>Stopovers</b> in Layers to see them.')}</p></div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.facet-chip').forEach((b) => b.addEventListener('click', () => toggleFacet(b.dataset.k, b.dataset.v)));
  el.querySelector('#color-by')?.addEventListener('change', (e) => setColorBy(e.target.value || null));
}

export function applyFilter() {
  if (state.follow && !isVisible(state.follow.animal)) stopFollow();
  state.highlight = null;
  ctl.buildInstances();
  refreshRoutes();
  refreshSites();
  ctl.frame();
  renderWho();
  renderCharts();
  emit('filter');
}

function toggleFacet(k, v) {
  const key = `${k}=${v}`;
  if (state.hidden.has(key)) state.hidden.delete(key);
  else state.hidden.add(key);
  applyFilter();
}

function setColorBy(k) {
  state.colorBy = k;
  refreshRoutes();
  ctl.frame();
  renderWho();
  renderCharts();
  emit('filter');
}
