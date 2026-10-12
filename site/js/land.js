// The land outline (world-atlas 110 m, from site/data/land.json), loaded once
// and shared by the atlas maps and journey posters. Each ring carries its
// bounding box so drawing can skip what's off-canvas.

let land = null;

export function loadLand() {
  land ??= fetch('data/land.json').then((r) => r.json()).then((rings) => rings.map((ring) => {
    let w = 180, s = 90, e = -180, n = -90;
    for (const [x, y] of ring) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    return { ring, bbox: [w, s, e, n] };
  }));
  return land;
}

// Fill land on a 2D canvas for the view [w, s, e, n] through xy([lon, lat]);
// shifted copies handle routes that cross the antimeridian.
export function drawLand(g, rings, view, xy) {
  for (const shift of [-360, 0, 360]) {
    for (const { ring, bbox } of rings) {
      if (bbox[2] + shift < view[0] || bbox[0] + shift > view[2] || bbox[3] < view[1] || bbox[1] > view[3]) continue;
      g.beginPath();
      ring.forEach(([x, y], i) => { const [px, py] = xy([x + shift, y]); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.closePath();
      g.fill();
    }
  }
}
