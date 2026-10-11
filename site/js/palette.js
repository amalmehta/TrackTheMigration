// Species colours. Related animals share a hue family — land mammals warm
// (rose → gold), marine animals blue (cyan → indigo), birds green (olive →
// teal) — with shades far enough apart to tell apart at a glance. The 13
// shades were found by a search that maximises the smallest colour
// difference (ΔE ≥ 20 in both modes; see tests/palette.test.mjs).
// `light` is for light backgrounds, `dark` for dark ones and satellite imagery.
// tests/palette.test.mjs checks the spacing.

export const GROUP_COLORS = {
  land: { light: '#c2410c', dark: '#fb923c' },
  marine: { light: '#2563eb', dark: '#60a5fa' },
  birds: { light: '#15803d', dark: '#4ade80' },
};

export const SPECIES_COLORS = {
  zebra: { light: '#991b1b', dark: '#f87171' },
  wildebeest: { light: '#ea580c', dark: '#fb923c' },
  'mule-deer': { light: '#a16207', dark: '#facc15' },
  pronghorn: { light: '#ef4444', dark: '#fdba74' },
  elk: { light: '#881337', dark: '#fda4af' },

  'humpback-whale': { light: '#0e7490', dark: '#22d3ee' },
  'blue-whale': { light: '#2563eb', dark: '#60a5fa' },
  'loggerhead-turtle': { light: '#312e81', dark: '#c7d2fe' },

  osprey: { light: '#3f6212', dark: '#9acd32' },
  'white-stork': { light: '#10b981', dark: '#22c55e' },
  'white-fronted-goose': { light: '#65a30d', dark: '#86efac' },
  'bar-tailed-godwit': { light: '#14b8a6', dark: '#14b8a6' },
  'hudsonian-godwit': { light: '#15803d', dark: '#10b981' },
};

export function colorFor(id, mode) {
  return (SPECIES_COLORS[id] || { light: '#6b7280', dark: '#d1d5db' })[mode];
}
