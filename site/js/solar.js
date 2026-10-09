// Where the sun is, and how dark it is anywhere on Earth — for the day/night
// shading. Pure functions (NOAA's low-precision solar position formulas).

const rad = Math.PI / 180;

// Subsolar point { lat, lon } in degrees for a JS Date.
export function subsolarPoint(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24; // hours
  let lon = (ra / rad - gmst * 15) % 360;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat: dec / rad, lon };
}

// Sun altitude (degrees) at a place, given the subsolar point.
export function sunAltitude(lat, lon, sun) {
  const a = Math.sin(lat * rad) * Math.sin(sun.lat * rad) +
    Math.cos(lat * rad) * Math.cos(sun.lat * rad) * Math.cos((lon - sun.lon) * rad);
  return Math.asin(Math.max(-1, Math.min(1, a))) / rad;
}

// Darkness 0..1: 0 in daylight, rising through civil/nautical twilight,
// 1 once the sun is 12° below the horizon.
export function darkness(altitude) {
  const x = Math.max(0, Math.min(1, (2 - altitude) / 14));
  return x * x * (3 - 2 * x);
}

// Paint night onto a Web-Mercator canvas (covers ±85.05° latitude).
// Per-row and per-column trig is cached, so a repaint is a few multiplies per pixel.
let geo = null;
function geometry(w, h) {
  if (geo && geo.w === w && geo.h === h) return geo;
  const sinLat = new Float32Array(h), cosLat = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / h)));
    sinLat[y] = Math.sin(lat); cosLat[y] = Math.cos(lat);
  }
  const sinLon = new Float32Array(w), cosLon = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const lon = (((x + 0.5) / w) * 360 - 180) * rad;
    sinLon[x] = Math.sin(lon); cosLon[x] = Math.cos(lon);
  }
  geo = { w, h, sinLat, cosLat, sinLon, cosLon };
  return geo;
}

export function paintNight(ctx, sun, maxAlpha = 0.62) {
  const { width: w, height: h } = ctx.canvas;
  const g = geometry(w, h);
  const img = ctx.createImageData(w, h);
  const sd = Math.sin(sun.lat * rad), cd = Math.cos(sun.lat * rad);
  const cs = Math.cos(sun.lon * rad), ss = Math.sin(sun.lon * rad);
  const lut = new Uint8ClampedArray(256); // alpha by sin(altitude), −1..1
  for (let i = 0; i < 256; i++) lut[i] = Math.round(darkness(Math.asin(i / 127.5 - 1) / rad) * maxAlpha * 255);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    const a = g.sinLat[y] * sd, b = g.cosLat[y] * cd;
    for (let x = 0; x < w; x++) {
      const sinAlt = a + b * (g.cosLon[x] * cs + g.sinLon[x] * ss);
      const i = (y * w + x) * 4;
      data[i] = 2; data[i + 1] = 6; data[i + 2] = 20;
      data[i + 3] = lut[Math.round((sinAlt + 1) * 127.5)];
    }
  }
  ctx.putImageData(img, 0, 0);
}
