#!/usr/bin/env node
// Browser smoke test: serve site/, drive headless Chrome over the DevTools
// protocol (no dependencies; Node ≥ 22 for the built-in WebSocket) and check
// the main flows load and run without page errors.
//
//   node scripts/smoke.mjs            (CHROME_PATH=… to pick a browser)

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from './serve.mjs';

const PORT = 8123;
const DEBUG_PORT = 9334;
const BASE = `http://localhost:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(mac)) return mac;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [name]).toString().trim(); } catch { /* try the next */ }
  }
  throw new Error('No Chrome found: set CHROME_PATH');
}

// Network noise from third-party tile servers isn't a failure of this site.
const IGNORE = /Failed to fetch|NetworkError|net::ERR|AJAXError|status 4\d\d|status 5\d\d|tiles?\b.*(error|fail)/i;

const server = serve(PORT);
const profile = mkdtempSync(join(tmpdir(), 'ttm-smoke-'));
const chrome = spawn(findChrome(), [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1280,800',
  ...(process.platform === 'darwin' && !process.env.SMOKE_SOFTWARE_GL ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--ignore-gpu-blocklist',
  ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
  'about:blank',
], { stdio: 'ignore' });

let ws;
for (let i = 0; i < 100 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { /* not up yet */ }
  if (!ws) await wait(200);
}
if (!ws) throw new Error('Chrome did not start');
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let seq = 0;
const pending = new Map();
const pageErrors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    pageErrors.push(`exception: ${(d.exception?.description || d.text || '').split('\n')[0]}`);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (!IGNORE.test(text)) pageErrors.push(`console.error: ${text.slice(0, 300)}`);
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');

async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description?.split('\n')[0] || 'evaluation failed');
  return r.result?.result?.value;
}
async function until(expr, what, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await js(`try { return !!(${expr}); } catch { return false; }`)) return;
    await wait(250);
  }
  const seen = await js(`return JSON.stringify({ url: location.href, ttm: !!window.ttm, index: !!window.ttm?.state.index, loading: document.querySelector('#loading')?.hidden ? null : document.querySelector('#loading')?.textContent, instances: window.ttm?.state.instances.length })`).catch((e) => e.message);
  throw new Error(`timed out waiting for ${what} (${seen})`);
}
async function open(path, { width = 1280, height = 800, mobile = false } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url: BASE + path });
  await until('window.ttm && ttm.state.index && document.querySelector("#loading").hidden', 'the page to load', 120000);
}

const results = [];
let langScript = null;
async function check(name, fn) {
  const before = pageErrors.length;
  try {
    await fn();
    if (pageErrors.length > before) throw new Error(pageErrors.slice(before).join('\n    '));
    results.push(['ok', name]);
  } catch (err) {
    results.push(['FAIL', name, err.message]);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

await check('home loads and animates every species', async () => {
  await open('/');
  await until('ttm.state.instances.length > 300', 'animals on the globe');
  const r = await js(`return { rows: document.querySelectorAll('#species-list .species-row').length, n: ttm.state.index.species.length, hero: document.querySelector('.hero-title')?.textContent };`);
  assert(r.rows === r.n && r.n >= 13, `species list shows ${r.rows} of ${r.n}`);
  assert(/one planet/.test(r.hero), `unexpected hero: ${r.hero}`);
});

await check('pick a species and open its charts', async () => {
  await js(`await ttm.select('wildebeest');`);
  await until(`document.querySelector('.hero-title')?.textContent === 'Wildebeest'`, 'the wildebeest card');
  await js(`document.querySelector('[data-act="charts"]').click();`);
  await until(`!document.querySelector('#charts').hidden && document.querySelectorAll('#charts svg').length >= 3`, 'charts');
});

await check('follow an animal: readout and conditions', async () => {
  await js(`const a = ttm.state.data.get('wildebeest').animals[0]; await ttm.startFollow('wildebeest', a);`);
  await until(`!document.querySelector('#hud').hidden && !document.querySelector('#hud-cond').hidden`, 'the follow readout with greenness');
  await until(`document.querySelectorAll('#hud-profile svg').length`, 'the journey profile');
});

await check('a shared link opens a flying stork with its flight height', async () => {
  await open('/#s=white-stork&f=93412A');
  await until(`ttm.state.follow?.animal.id === '93412A' && !document.querySelector('#hud-alt').hidden`, 'the stork and its flight height');
  await js(`document.querySelector('#hud-alt-3d').click();`);
  await until(`document.querySelector('#hud-alt-3d').getAttribute('aria-pressed') === 'true'`, 'the 3D close-up');
});

await check('a story plays', async () => {
  await open('/#s=blue-whale&st=1');
  await until(`ttm.state.story && !document.querySelector('#story').hidden`, 'the story card');
});

await check('the journey atlas lists and filters journeys', async () => {
  await open('/');
  await js(`document.querySelector('[data-act="atlas"]').click();`);
  await until(`document.querySelectorAll('.atlas-card').length > 300`, 'atlas cards');
  await js(`const s = document.querySelector('#atlas-species'); s.value = 'osprey'; s.dispatchEvent(new Event('change'));`);
  await until(`[...document.querySelectorAll('.atlas-card')].length > 0 && /journey/.test(document.querySelector('#atlas-count').textContent)`, 'filtered cards');
  const n = await js(`return document.querySelectorAll('.atlas-card').length;`);
  assert(n > 0 && n < 300, `osprey filter shows ${n} cards`);
});

await check('A year on Earth starts', async () => {
  await open('/#tour=1');
  await until(`ttm.state.tour && !document.querySelector('#tour').hidden`, 'the tour card');
});

await check('who passed near: a shared place lists passing animals', async () => {
  await open('/#near=36.817,-1.286,100&nm=Nairobi');
  await until(`document.querySelectorAll('.near-row').length > 3`, 'animals near Nairobi');
  await js(`document.querySelector('.near-row').click();`);
  await until(`ttm.state.follow && !ttm.state.playing`, 'a paused ride-along at the closest moment');
});

await check('a journey poster draws', async () => {
  const r = await js(`const { makePoster } = await import(new URL('js/poster.js', location.href).href);
    const { blob, name } = await makePoster(ttm.state.follow.species, ttm.state.follow.animal);
    return { size: blob.size, type: blob.type, name };`);
  assert(r.type === 'image/png' && r.size > 100000, `poster was ${r.size} bytes of ${r.type}`);
});

await check('bird charts: wind and timing', async () => {
  await open('/#s=white-stork');
  await js(`document.querySelector('[data-act="charts"]').click();`);
  await until(`[...document.querySelectorAll('#charts figcaption')].some((f) => /Then vs now/.test(f.textContent))`, 'the timing chart');
});

await check('this week in migration, and an animal\'s diary', async () => {
  await open('/');
  await until(`document.querySelectorAll('.thisweek .tw-row').length >= 2`, 'the This week card');
  await js(`const a = [...ttm.state.data.get('white-stork')?.animals || (await (await fetch('data/white-stork.json')).json()).animals].sort((x, y) => y.km - x.km)[0];
    await ttm.startFollow('white-stork', a); document.querySelector('#hud-tab-diary').click();`);
  await until(`document.querySelectorAll('.diary-row').length >= 5`, 'diary entries');
  await js(`document.querySelectorAll('.diary-row')[3].click();`);
  await until(`document.querySelector('.diary-row.now')`, 'the current entry marked');
});

await check('barriers they crossed', async () => {
  await open('/#s=white-stork');
  await js(`document.querySelector('[data-act="charts"]').click();`);
  await until(`[...document.querySelectorAll('#charts figcaption')].some((f) => /Barriers they crossed/.test(f.textContent))`, 'the crossings chart');
  await js(`document.querySelector('#charts figure:has(.site-row) .site-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));`);
});

await check('embed mode', async () => {
  await open('/?embed=1');
  await until(`document.body.classList.contains('embed') && !document.querySelector('#embed-link').hidden`, 'the embed link');
});

for (const lang of ['es', 'fr']) {
  await check(`in ${lang === 'es' ? 'Spanish' : 'French'}`, async () => {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('ttm.settings', JSON.stringify({ lang: '${lang}' })) } catch {}` }).then((r) => { langScript = r.result?.identifier; });
    await open('/');
    const r = await js(`const dict = (await import(new URL('js/lang/${lang}.js', location.href).href)).default;
      return { lang: document.documentElement.lang, html: document.body.innerText, word: dict['A year on Earth'] };`);
    const word = r.word;
    assert(r.lang === lang, `page language is ${r.lang}`);
    assert(r.html.includes(word), `no "${word}" on the page`);
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: langScript });
    await js(`localStorage.removeItem('ttm.settings')`);
  });
}

await check('phone layout has no sideways scroll', async () => {
  await open('/', { width: 390, height: 844, mobile: true });
  const r = await js(`return { sw: document.documentElement.scrollWidth, vw: innerWidth };`);
  assert(r.sw <= r.vw, `page is ${r.sw}px wide in a ${r.vw}px viewport`);
});

ws.close();
chrome.kill();
server.close();
await wait(300);
try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* Chrome may still be closing; the OS cleans temp */ }

for (const [status, name, err] of results) console.log(`${status === 'ok' ? '✓' : '✗'} ${name}${err ? `\n    ${err}` : ''}`);
const failed = results.filter((r) => r[0] !== 'ok').length;
console.log(failed ? `\n${failed} of ${results.length} smoke checks failed` : `\nall ${results.length} smoke checks passed`);
process.exit(failed ? 1 : 0);
