import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORIES } from '../site/js/stories.js';
import { DATASETS } from '../scripts/datasets.mjs';
import { ENV_LAYERS } from '../site/js/environment.js';

const PLACEHOLDERS = new Set(['{animals}', '{years}', '{longestId}', '{longestKm}']);

test('every migration has a story, and every story a migration', () => {
  const ids = DATASETS.map((d) => d.id).sort();
  assert.deepEqual(Object.keys(STORIES).sort(), ids);
});

for (const [id, story] of Object.entries(STORIES)) {
  test(`${id}: scenes are well formed`, () => {
    assert.ok(story.title);
    assert.ok(story.scenes.length >= 4 && story.scenes.length <= 6, 'four to six scenes');
    for (const sc of story.scenes) {
      assert.ok(sc.title && sc.text, 'title and text');
      assert.match(sc.at, /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, `bad date ${sc.at}`);
      const [m, d] = sc.at.split('-').map(Number);
      assert.equal(new Date(Date.UTC(2001, m - 1, d)).getUTCMonth(), m - 1, `impossible date ${sc.at}`);
      if (typeof sc.view === 'string') assert.ok(['species', 'heads'].includes(sc.view), `bad view ${sc.view}`);
      else {
        assert.equal(sc.view.center.length, 2);
        assert.ok(sc.view.zoom > 0 && sc.view.zoom < 16);
      }
      if (sc.overlay) assert.ok(ENV_LAYERS[sc.overlay], `unknown overlay ${sc.overlay}`);
      if (sc.follow) assert.equal(sc.follow, 'longest');
      for (const ph of sc.text.match(/\{[^}]+\}/g) || []) assert.ok(PLACEHOLDERS.has(ph), `unknown placeholder ${ph}`);
      assert.ok(!sc.speed || (sc.speed >= 1 && sc.speed <= 30));
    }
    assert.equal(story.scenes.at(-1).follow, 'longest', 'stories end by riding along with one animal');
  });
}
