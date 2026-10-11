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
  footprint: {
    title: 'Human footprint',
    short: 'Human footprint',
    detail: 'Index 0–100, 1995–2004 · SEDAC',
    layer: 'Human_Footprint_1995-2004',
    matrix: 'GoogleMapsCompatible_Level7',
    maxzoom: 7,
    period: 'static',
    years: [1995],
    palette: 'Human_Footprint_1995-2004',
    legendMin: '0 wild',
    legendMax: '100',
    units: '',
    why: 'Roads, farms, towns and lights combined: 0 is wilderness, 100 a city.',
    for: ['land', 'birds'],
    group: 'people',
  },
  population: {
    title: 'Population density',
    short: 'People',
    detail: 'People per km², 2000–2020 · SEDAC GPWv4',
    layer: 'GPW_Population_Density_{year}',
    matrix: 'GoogleMapsCompatible_Level7',
    maxzoom: 7,
    period: 'static',
    years: [2000, 2005, 2010, 2015, 2020],
    palette: 'GPW_Population_Density_2010',
    legendMin: '< 1',
    legendMax: '≥ 1,000',
    units: 'per km²',
    why: 'How many people live here, from the census year nearest the animals\u2019 year.',
    for: ['land', 'birds'],
    group: 'people',
  },
  lights: {
    title: 'Night lights',
    short: 'Night lights',
    detail: 'Black Marble, 2012 & 2016 · NASA VIIRS',
    layer: 'VIIRS_Black_Marble',
    matrix: 'GoogleMapsCompatible_Level8',
    maxzoom: 8,
    period: 'year',
    years: [2012, 2016],
    first: '2012-01-01',
    last: '2016-01-01',
    stops: ['#000000', '#1a1408', '#5c4413', '#c99a3a', '#ffe9a8', '#ffffff'],
    legendMin: 'dark',
    legendMax: 'bright',
    units: '',
    why: 'Where people light up the night: towns, roads, gas flares.',
    for: ['land', 'birds', 'marine'],
    group: 'people',
  },
};

// The archive year nearest to y.
const nearestYear = (years, y) => years.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// The date to request for an overlay at playback time `hours` (hours since
// epoch). Dates outside the layer's archive move to the same day of the
// nearest covered year, so seasons still line up; `shifted` says so.
export function overlayDate(key, hours) {
  const L = ENV_LAYERS[key];
  let d = new Date(hours * 3.6e6);
  if (L.period === 'static' || L.period === 'year') {
    const y = nearestYear(L.years, d.getUTCFullYear());
    return { date: `${y}-01-01`, year: y, shifted: L.years.length > 1 ? y !== d.getUTCFullYear() : false, fixed: L.period === 'static' && L.years.length === 1 };
  }
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
  const layer = L.layer.replace('{year}', date.slice(0, 4));
  // Layers without a time dimension take no date in the URL.
  return L.period === 'static'
    ? `${GIBS}/${layer}/default/${L.matrix}/{z}/{y}/{x}.png`
    : `${GIBS}/${layer}/default/${date}/${L.matrix}/{z}/{y}/{x}.png`;
}

