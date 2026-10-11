// Turn a study's reference data (one row per tag deployment) into "who is
// this animal" attributes — sex, age when tagged, where it was tagged,
// whether it was part of an experiment — and keep only the ones that split
// the animals shown into meaningful groups ("facets").

export const FACET_LABELS = {
  site: 'Tagged at',
  sex: 'Sex',
  stage: 'Age when tagged',
  handling: 'Handling',
};

const SEX = { f: 'female', female: 'female', m: 'male', male: 'male' };

export function normSex(v) {
  return SEX[(v || '').trim().toLowerCase()] || 'unknown';
}

export function normStage(v) {
  const s = (v || '').trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('juv')) return 'juvenile';
  if (s.startsWith('nestling')) return 'nestling';
  if (s.startsWith('subadult')) return 'subadult';
  if (s.startsWith('calf')) return 'calf';
  if (s === 'adult' || s === 'mature') return 'adult';
  return null; // ages like "4 years" are too fine-grained to group
}

export function normHandling(v) {
  const s = (v || '').trim().toLowerCase();
  if (!s) return null;
  return s === 'none' ? 'wild, not handled' : 'experiment or moved';
}

// Sites: use the study-site as is when there are only a few; otherwise try a
// region in brackets ("Columbia River OR (West)" → "West"), then the last
// comma-separated part ("Loburg, Germany" → "Germany").
export function siteNormaliser(values, maxGroups = 6) {
  const distinct = (f) => new Set(values.filter(Boolean).map(f)).size;
  const raw = (v) => v.trim();
  const bracket = (v) => (v.match(/\(([^)]+)\)\s*$/)?.[1] || v).trim();
  const lastPart = (v) => v.split(',').pop().replace(/\(.*\)/, '').trim();
  for (const f of [raw, bracket, lastPart]) {
    const n = distinct(f);
    if (n >= 2 && n <= maxGroups) return f;
  }
  return null;
}

// rows: reference-data rows (objects keyed by column name)
// ids: the animal ids being shown
// Returns { attrs: Map(id → {facet: value}), facets: [{ key, label, values: [{ value, count }] }] }
export function buildFacets(rows, ids) {
  const byId = new Map();
  for (const r of rows) {
    const id = r['animal-id'];
    if (!id) continue;
    const prev = byId.get(id) || {};
    // An animal can have several deployments; keep the first non-empty value of each field.
    for (const [k, v] of Object.entries(r)) if (v && !prev[k]) prev[k] = v;
    byId.set(id, prev);
  }
  const shown = ids.map((id) => [id, byId.get(id) || {}]);
  const site = siteNormaliser(shown.map(([, r]) => r['study-site'] || ''));
  const raw = new Map(shown.map(([id, r]) => [id, {
    site: site && r['study-site'] ? site(r['study-site']) : null,
    sex: r['animal-sex'] !== undefined || r['animal-id'] ? normSex(r['animal-sex']) : null,
    stage: normStage(r['animal-life-stage']),
    handling: normHandling(r['manipulation-type']),
  }]));

  const facets = [];
  for (const key of Object.keys(FACET_LABELS)) {
    const counts = new Map();
    for (const a of raw.values()) if (a[key]) counts.set(a[key], (counts.get(a[key]) || 0) + 1);
    const values = [...counts].map(([value, count]) => ({ value, count })).sort((p, q) => q.count - p.count || p.value.localeCompare(q.value));
    // Worth showing only if it splits the animals into at least two real groups.
    if (values.filter((v) => v.count >= 2 && v.value !== 'unknown').length >= 2) {
      facets.push({ key, label: FACET_LABELS[key], values });
    }
  }
  const keep = new Set(facets.map((f) => f.key));
  const attrs = new Map([...raw].map(([id, a]) => [id, Object.fromEntries(Object.entries(a).filter(([k, v]) => keep.has(k) && v))]));
  return { attrs, facets };
}
