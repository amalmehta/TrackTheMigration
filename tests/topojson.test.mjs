import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeArcs, topologyRings } from '../scripts/topojson.mjs';

const topo = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [10, 20] },
  // arc 0: (0,0)→(4,0)→(4,4); arc 1: (4,4)→(0,4)→(0,0)
  arcs: [[[0, 0], [4, 0], [0, 4]], [[4, 4], [-4, 0], [0, -4]]],
  objects: { land: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0, 1]] }, { type: 'MultiPolygon', arcs: [[[~1, ~0]]] }] } },
};

test('arcs are delta-decoded and transformed', () => {
  assert.deepEqual(decodeArcs(topo)[0], [[10, 20], [14, 20], [14, 24]]);
});

test('rings join arcs without repeating shared points, and reverse ~i arcs', () => {
  const [a, b] = topologyRings(topo, 'land');
  assert.deepEqual(a, [[10, 20], [14, 20], [14, 24], [10, 24], [10, 20]]);
  assert.deepEqual(b, [[10, 20], [10, 24], [14, 24], [14, 20], [10, 20]]);
});
