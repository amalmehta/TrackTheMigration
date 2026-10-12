import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectKeys, checkLang } from '../scripts/i18n-keys.mjs';

const keys = await collectKeys();

for (const lang of ['es', 'fr']) {
  test(`${lang}: every string the site shows is translated, with the same {placeholders}`, async () => {
    const dict = (await import(`../site/js/lang/${lang}.js`)).default;
    const { missing, badPlaceholders } = checkLang(keys, dict);
    assert.deepEqual(missing, [], `${missing.length} missing, e.g. ${missing.slice(0, 5).join(' | ')}`);
    assert.deepEqual(badPlaceholders, []);
  });

  test(`${lang}: HTML tags survive translation`, async () => {
    const dict = (await import(`../site/js/lang/${lang}.js`)).default;
    const tags = (s) => (s.match(/<\/?[a-z]+/g) || []).sort().join(',');
    for (const k of keys) if (dict[k] != null) assert.equal(tags(dict[k]), tags(k), `tags differ in: ${k}`);
  });
}
