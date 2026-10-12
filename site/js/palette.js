// Species colours. Related animals share a hue family — land mammals warm
// (rose → gold), marine animals blue (cyan → indigo), birds green (olive →
// teal) — with shades far enough apart to tell apart at a glance. The shades
// were found by a search that maximises the smallest colour difference
// within limits on lightness and saturation (17 species: smallest ΔE 31
// light, 35 dark; tests/palette.test.mjs requires ≥ 20).
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

  'white-stork': { light: '#099330', dark: '#63b376' },
  'white-fronted-goose': { light: '#8ab32d', dark: '#bff366' },
  osprey: { light: '#6b6f02', dark: '#909702' },
  'steppe-eagle': { light: '#46461d', dark: '#707139' },
  'egyptian-vulture': { light: '#a6a66f', dark: '#dfe7b6' },
  'turkey-vulture': { light: '#034e00', dark: '#078000' },
  'bar-tailed-godwit': { light: '#69b1a7', dark: '#20fde0' },
  'hudsonian-godwit': { light: '#03634f', dark: '#2c766d' },
  'far-eastern-curlew': { light: '#02bc8a', dark: '#60fe9b' },
};

export function colorFor(id, mode) {
  return (SPECIES_COLORS[id] || { light: '#6b7280', dark: '#d1d5db' })[mode];
}
