import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES_COLORS } from '../site/js/palette.js';
import { DATASETS } from '../scripts/datasets.mjs';

// sRGB hex → CIELAB (D65)
function lab(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = c;
  const xyz = [
    (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    r * 0.2126 + g * 0.7152 + b * 0.0722,
    (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883,
  ].map((v) => (v > 216 / 24389 ? Math.cbrt(v) : (841 / 108) * v + 4 / 29));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const hue = (hex) => { const [, a, b] = lab(hex); return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360; };
const contrast = (hex, bg) => {
  const L = (h) => { const [l] = lab(h); return l; };
  return Math.abs(L(hex) - L(bg));
};

// Lab hue ranges for each family (degrees).
const FAMILY = { land: [0, 95], marine: [200, 310], birds: [100, 190] };

test('every species has a colour in both modes', () => {
  for (const ds of DATASETS) {
    assert.ok(SPECIES_COLORS[ds.id], `missing colour for ${ds.id}`);
    assert.match(SPECIES_COLORS[ds.id].light, /^#[0-9a-f]{6}$/);
    assert.match(SPECIES_COLORS[ds.id].dark, /^#[0-9a-f]{6}$/);
  }
});

for (const mode of ['light', 'dark']) {
  test(`${mode}: related species share a hue family`, () => {
    for (const ds of DATASETS) {
      const h = hue(SPECIES_COLORS[ds.id][mode]);
      const [lo, hi] = FAMILY[ds.group];
      assert.ok(h >= lo && h <= hi, `${ds.id} hue ${h.toFixed(0)} outside ${ds.group} ${lo}–${hi}`);
    }
  });

  test(`${mode}: every pair of species is distinguishable (ΔE ≥ 20)`, () => {
    for (let i = 0; i < DATASETS.length; i++) {
      for (let j = i + 1; j < DATASETS.length; j++) {
        const a = SPECIES_COLORS[DATASETS[i].id][mode];
        const b = SPECIES_COLORS[DATASETS[j].id][mode];
        const d = deltaE(a, b);
        assert.ok(d >= 20, `${DATASETS[i].id} vs ${DATASETS[j].id}: ΔE ${d.toFixed(1)}`);
      }
    }
  });

  test(`${mode}: colours stand off their background`, () => {
    const bg = mode === 'light' ? '#ffffff' : '#0f141a';
    for (const ds of DATASETS) {
      assert.ok(contrast(SPECIES_COLORS[ds.id][mode], bg) >= 30, `${ds.id} too close to ${mode} background`);
    }
  });
}
