// Decode a TopoJSON topology into plain polygon rings ([[lon, lat], …]),
// enough for the world-atlas land outline. Handles quantised, delta-encoded
// arcs and reversed arc references (~i).

export function decodeArcs(topology) {
  const t = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      if (t) {
        x += dx;
        y += dy;
        return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]];
      }
      return [dx, dy];
    });
  });
}

function ring(arcs, refs) {
  const out = [];
  refs.forEach((ref, k) => {
    const a = ref < 0 ? arcs[~ref].slice().reverse() : arcs[ref];
    out.push(...(k === 0 ? a : a.slice(1))); // shared endpoints appear once
  });
  return out;
}

// Every ring of every (Multi)Polygon in the named object.
export function topologyRings(topology, name) {
  const arcs = decodeArcs(topology);
  const obj = topology.objects[name];
  const geoms = obj.type === 'GeometryCollection' ? obj.geometries : [obj];
  const rings = [];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    for (const poly of polys) for (const r of poly) rings.push(ring(arcs, r));
  }
  return rings;
}
