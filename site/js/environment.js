// Live environment overlays from NASA GIBS (https://nasa-gibs.github.io/gibs-api-docs/).
// Key-free WMTS tiles with a TIME dimension, so the picture changes with the
// playback date. This module is pure (no DOM) so the date logic can be tested.

export const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

export const ENV_LAYERS = {
  vegetation: {
    title: 'Vegetation greenness',
    short: 'Vegetation',
    detail: 'NDVI, monthly · Terra MODIS',
    layer: 'MODIS_Terra_L3_NDVI_Monthly',
    matrix: 'GoogleMapsCompatible_Level7',
    maxzoom: 7,
    period: 'month',
    first: '2000-03-01',
    last: '2026-08-01',
    palette: 'MODIS_L3_NDVI',
    legendMin: 'bare',
    legendMax: 'lush',
    units: '',
    why: 'Compare where the grazers go with where the land is green.',
    for: ['land'],
  },
  sst: {
    title: 'Sea surface temperature',
    short: 'Sea temperature',
    detail: 'Daily · GHRSST AVHRR-OI',
    layer: 'GHRSST_L4_AVHRR-OI_Sea_Surface_Temperature',
    matrix: 'GoogleMapsCompatible_Level6',
    maxzoom: 6,
    period: 'week',
    first: '1981-09-01',
    last: '2020-04-04',
    palette: 'GHRSST_Sea_Surface_Temperature',
    legendMin: '0',
    legendMax: '32',
    units: '°C',
    why: 'Compare where the whales and turtles are with how warm the water is.',
    for: ['marine'],
  },
  snow: {
    title: 'Snow cover',
    short: 'Snow',
    detail: 'Days with snow, monthly · Terra MODIS',
    layer: 'MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct',
    matrix: 'GoogleMapsCompatible_Level6',
    maxzoom: 6,
    period: 'month',
    first: '2000-03-01',
    last: '2026-09-01',
    palette: 'MODIS_NDSI_Snow_Cover',
    legendMin: '0%',
    legendMax: '100%',
    units: 'of days',
    why: 'Compare where animals spend the winter with where the snow lies.',
    for: ['land', 'birds'],
  },
};

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// The date to request for an overlay at playback time `hours` (hours since
// epoch). Dates outside the layer's archive move to the same day of the
// nearest covered year, so seasons still line up; `shifted` says so.
export function overlayDate(key, hours) {
  const L = ENV_LAYERS[key];
  let d = new Date(hours * 3.6e6);
  const first = new Date(L.first + 'T00:00:00Z');
  const last = new Date(L.last + 'T00:00:00Z');
  let shifted = false;
  while (d < first) { d = new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), Math.min(d.getUTCDate(), 28))); shifted = true; }
  while (d > last) { d = new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), Math.min(d.getUTCDate(), 28))); shifted = true; }
  // Snap so tiles only change when the picture would.
  if (L.period === 'month') d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  else if (L.period === 'week') {
    const day = d.getUTCDate();
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day >= 22 ? 22 : day >= 15 ? 15 : day >= 8 ? 8 : 1));
  }
  if (d < first) d = first;
  if (d > last) d = last;
  return { date: iso(d), shifted };
}

export function tileUrl(key, date) {
  const L = ENV_LAYERS[key];
  return `${GIBS}/${L.layer}/default/${date}/${L.matrix}/{z}/{y}/{x}.png`;
}

