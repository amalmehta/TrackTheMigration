// Ground height (metres above sea level) from the open Terrain Tiles
// (Mapzen terrarium encoding on AWS), sampled at build time. Used to turn a
// GPS height into height above the ground for flying birds.

import { join } from 'node:path';
import { tileSampler, terrariumDecoder } from './tiles.mjs';

export function groundSampler(rawDir, z = 10) {
  return tileSampler({
    url: (zz, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zz}/${x}/${y}.png`,
    z,
    dir: join(rawDir, 'dem'),
    decoder: terrariumDecoder,
  });
}
