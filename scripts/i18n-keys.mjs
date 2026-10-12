#!/usr/bin/env node
// Every English string the site can show, for translation:
//   • string literals inside t(…) / tr(…) calls in site/js
//   • text and placeholder / aria-label / title attributes in index.html
//     (whole inner HTML for elements marked data-i18n)
//   • data-driven text: species, groups, stories, NASA layers, facet labels
//     and values, legend labels, compass words, quality levels, sort names
//
//   node scripts/i18n-keys.mjs            list keys missing from es / fr
//   node scripts/i18n-keys.mjs --json     print every key as JSON

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');

// String literals in the first argument of each t( / tr( call.
function fromCode(src) {
  const out = [];
  const re = /\b(?:t|tr)\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let i = m.index + m[0].length;
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "'" || c === '"') {
        let j = i + 1;
        let s = '';
        while (j < src.length && src[j] !== c) {
          if (src[j] === '\\') { s += src[j + 1] === 'u' ? String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16)) : src[j + 1]; j += src[j + 1] === 'u' ? 6 : 2; continue; }
          s += src[j++];
        }
        if (depth === 0) out.push(s);
        i = j + 1;
        continue;
      }
      if (c === '`') { // a template literal as the key: skip (keys must be plain strings)
        i = src.indexOf('`', i + 1) + 1;
        continue;
      }
      if (c === '(' || c === '[' || c === '{') depth++;
      if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
      if (c === ',' && depth === 0) break;
      i++;
    }
  }
  return out;
}

function fromHtml(html) {
  const out = [];
  const body = html.slice(html.indexOf('<body'));
  // data-i18n elements: whole inner HTML (tags of the same name don't nest in our markup)
  const marked = /<(\w+)[^>]*\sdata-i18n[^>]*>([\s\S]*?)<\/\1>/g;
  let rest = body;
  for (let m = marked.exec(body); m; m = marked.exec(body)) {
    out.push(m[2].replace(/\s+/g, ' ').trim());
    rest = rest.replace(m[0], '');
  }
  const noScript = rest.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for (const m of noScript.matchAll(/>([^<>]+)</g)) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (/[A-Za-z]{2}/.test(text)) out.push(decode(text));
  }
  for (const m of noScript.matchAll(/\s(?:placeholder|aria-label|title)="([^"]+)"/g)) out.push(decode(m[1].replace(/\s+/g, ' ').trim()));
  return out;
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

export async function collectKeys() {
  const keys = new Set();
  const add = (s) => { if (s && /[A-Za-z]/.test(s)) keys.add(s); };
  for (const f of readdirSync(join(SITE, 'js')).filter((f) => f.endsWith('.js'))) fromCode(readFileSync(join(SITE, 'js', f), 'utf8')).forEach(add);
  fromHtml(readFileSync(join(SITE, 'index.html'), 'utf8')).forEach(add);

  const index = JSON.parse(readFileSync(join(SITE, 'data', 'index.json'), 'utf8'));
  for (const sp of index.species) ['name', 'region', 'blurb', 'groupName'].forEach((k) => add(sp[k]));
  Object.values(index.groups).forEach(add);
  for (const sp of index.species) {
    const d = JSON.parse(readFileSync(join(SITE, 'data', `${sp.id}.json`), 'utf8'));
    for (const f of d.facets || []) { add(f.label); f.values.forEach((v) => add(v.value)); }
  }
  const assets = JSON.parse(readFileSync(join(SITE, 'data', 'assets.json'), 'utf8'));
  for (const L of Object.values(assets.layers || {})) [L.min, L.max, L.units].forEach((v) => add(String(v ?? '')));

  const imp = (f) => import(pathToFileURL(join(SITE, 'js', f)).href);
  const { STORIES } = await imp('stories.js');
  for (const st of Object.values(STORIES)) { add(st.title); for (const sc of st.scenes) { add(sc.title); add(sc.text); } }
  const { ENV_LAYERS } = await imp('environment.js');
  for (const L of Object.values(ENV_LAYERS)) ['title', 'detail', 'why'].forEach((k) => add(L[k]));
  // Fixed vocabularies used through t(variable)
  ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'].forEach(add);
  ['full detail', 'no glow', 'lighter', 'lightest'].forEach(add);
  ['Farthest first', 'Shortest first', 'Longest tracked', 'Most human footprint', 'Wildest places', 'Earliest', 'Latest'].forEach(add);
  ['wild 0–9', 'light 10–24', 'moderate 25–49', 'heavy 50+', 'unknown', 'All animals'].forEach(add);
  ['sex', 'handling', 'tagged at', 'age'].forEach(add);
  ['animal', 'animals', 'on average', 'not tracked', 'days of tracking', 'Click to follow', 'Click to pick these animals',
    'animal-days in all', 'median travel speed', 'travelling steps', 'fixes', 'median', 'crossed halfway', 'vs usual'].forEach(add);
  return [...keys].sort();
}

const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
export function checkLang(keys, dict) {
  const missing = keys.filter((k) => !(k in dict));
  const badPlaceholders = keys.filter((k) => k in dict && placeholders(k) !== placeholders(dict[k]));
  return { missing, badPlaceholders };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const keys = await collectKeys();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(keys, null, 1));
  } else {
    console.log(`${keys.length} keys`);
    for (const lang of ['es', 'fr']) {
      let dict = {};
      try { dict = (await import(pathToFileURL(join(SITE, 'js', 'lang', `${lang}.js`)).href)).default; } catch { /* none yet */ }
      const { missing, badPlaceholders } = checkLang(keys, dict);
      console.log(`${lang}: ${missing.length} missing, ${badPlaceholders.length} with mismatched {placeholders}`);
    }
  }
}
