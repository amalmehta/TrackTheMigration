// Species colours. Related animals share a hue family — land mammals warm
// (red → gold), marine animals blue (cyan → indigo), birds green (lime →
// emerald) — with shades far enough apart to tell apart at a glance.
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

  'humpback-whale': { light: '#0e7490', dark: '#22d3ee' },
  'blue-whale': { light: '#2563eb', dark: '#60a5fa' },
  'loggerhead-turtle': { light: '#312e81', dark: '#c7d2fe' },

  osprey: { light: '#4d7c0f', dark: '#a3e635' },
  'white-stork': { light: '#15803d', dark: '#4ade80' },
  'bar-tailed-godwit': { light: '#065f46', dark: '#6ee7b7' },
};

export function colorFor(id, mode) {
  return (SPECIES_COLORS[id] || { light: '#6b7280', dark: '#d1d5db' })[mode];
}
