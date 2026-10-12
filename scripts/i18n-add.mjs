#!/usr/bin/env node
// Add or update translations: node scripts/i18n-add.mjs <lang> <file.json>
// where file.json is { "English": "translation", … }. Keeps the language file sorted.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [lang, file] = process.argv.slice(2);
const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'js', 'lang', `${lang}.js`);
const dict = { ...(await import(pathToFileURL(path).href)).default, ...JSON.parse(readFileSync(file, 'utf8')) };
const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b)));
const head = readFileSync(path, 'utf8').split('\n')[0];
writeFileSync(path, `${head}\nexport default ${JSON.stringify(sorted, null, 2)};\n`);
console.log(`${lang}: ${Object.keys(sorted).length} entries`);
