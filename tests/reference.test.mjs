import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normSex, normStage, normHandling, siteNormaliser, buildFacets } from '../scripts/reference.mjs';

test('normalisers', () => {
  assert.equal(normSex('f'), 'female');
  assert.equal(normSex(' M '), 'male');
  assert.equal(normSex(''), 'unknown');
  assert.equal(normSex('u'), 'unknown');
  assert.equal(normStage('juv (1st winter)'), 'juvenile');
  assert.equal(normStage('Adult'), 'adult');
  assert.equal(normStage('Mature'), 'adult');
  assert.equal(normStage('4 years'), null);
  assert.equal(normHandling('none'), 'wild, not handled');
  assert.equal(normHandling('relocated'), 'experiment or moved');
  assert.equal(normHandling(''), null);
});

test('site normaliser picks the coarsest useful grouping', () => {
  const few = siteNormaliser(['Mara', 'Amboseli Basin', 'Mara']);
  assert.equal(few('Mara'), 'Mara');
  const osprey = ['Eastern Long Island NY (East)', 'Minneapolis MN (Midwest)', 'Columbia River OR (West)',
    'Crow Wing MN (Midwest)', 'FL (East)', 'Shelter Island NY (East)', 'Portland OR (West)', 'NJ (East)'];
  const f = siteNormaliser(osprey);
  assert.equal(f('Columbia River OR (West)'), 'West');
  const storks = ['Loburg, Germany', 'Spain', 'Kaliningrad, Russia', 'Bavaria, Germany', 'Israel',
    'Hula, Israel', 'Rybachy, Russia', 'Madrid, Spain'];
  assert.equal(siteNormaliser(storks)('Loburg, Germany'), 'Germany');
  assert.equal(siteNormaliser(['A']), null);
});

test('buildFacets keeps attributes that split the animals', () => {
  const rows = [
    { 'animal-id': 'a', 'animal-sex': 'f', 'study-site': 'Mara', 'manipulation-type': 'none' },
    { 'animal-id': 'b', 'animal-sex': 'f', 'study-site': 'Mara', 'manipulation-type': 'none' },
    { 'animal-id': 'c', 'animal-sex': 'm', 'study-site': 'Amboseli', 'manipulation-type': 'none' },
    { 'animal-id': 'd', 'animal-sex': 'm', 'study-site': 'Amboseli', 'manipulation-type': 'none' },
    { 'animal-id': 'd', 'animal-sex': '', 'study-site': '', 'manipulation-type': '' }, // second deployment
  ];
  const { attrs, facets } = buildFacets(rows, ['a', 'b', 'c', 'd']);
  assert.deepEqual(facets.map((f) => f.key), ['site', 'sex']); // handling is all the same
  assert.deepEqual(attrs.get('d'), { site: 'Amboseli', sex: 'male' });
  assert.deepEqual(facets[1].values, [{ value: 'female', count: 2 }, { value: 'male', count: 2 }]);
});

test('buildFacets drops a facet that is all one value', () => {
  const rows = ['a', 'b', 'c'].map((id) => ({ 'animal-id': id, 'animal-sex': 'f' }));
  assert.deepEqual(buildFacets(rows, ['a', 'b', 'c']).facets, []);
});
