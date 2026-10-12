// Languages. English is written in the code; Spanish and French come from
// site/js/lang/<code>.js, keyed by the English text. t('…') returns the
// translation (or the English when there isn't one) with {placeholders}
// filled in. Dates and numbers use the browser's formatting for the language.
// Changing the language reloads the page.

import { settings } from './settings.js';

export const LANGS = { en: 'English', es: 'Español', fr: 'Français' };

function resolve(choice) {
  if (LANGS[choice]) return choice;
  const nav = (globalThis.navigator?.languages || [globalThis.navigator?.language || 'en']).map((l) => String(l).slice(0, 2).toLowerCase());
  return nav.find((l) => LANGS[l]) || 'en';
}

export const lang = resolve(settings.lang);
export const locale = lang === 'en' ? 'en-GB' : lang;

const DICT = lang === 'en' ? {} : (await import(`./lang/${lang}.js`)).default;

export function t(text, vars) {
  let out = DICT[text] ?? text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}

// Plural pick: tn(n, 'animal', 'animals') → the right form, translated.
export const tn = (n, one, many) => t(n === 1 ? one : many);

// Number in the language's style (1,234 / 1.234 / 1 234).
const nf = new Intl.NumberFormat(locale);
export const num = (v) => nf.format(v);

// Month names: English as written ("Sep", "2 Mar 2002"); other languages
// from the browser's own date formatting.
const monthNames = (style) => Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' })
  .format(new Date(Date.UTC(2001, m, 15))).replace(/\.$/, ''));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const MONTHS = lang === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : monthNames('short').map(cap);
export const MONTHS_LONG = lang === 'en'
  ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  : monthNames('long').map(cap);

// "2 Mar 2002", "2 mar 2002", "2 mars 2002"
export const fmtDayMonthYear = (d) => `${d.getUTCDate()} ${lang === 'en' ? MONTHS[d.getUTCMonth()] : MONTHS[d.getUTCMonth()].toLowerCase()} ${d.getUTCFullYear()}`;
export const fmtDayMonth = (d) => `${d.getUTCDate()} ${lang === 'en' ? MONTHS[d.getUTCMonth()] : MONTHS[d.getUTCMonth()].toLowerCase()}`;
export const fmtMonthYearDate = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

// Translate the static page: elements marked data-i18n have their whole inner
// HTML translated (for sentences with markup inside); elsewhere, text nodes
// and a few attributes that match a key exactly.
export function translatePage(root = document.body) {
  document.documentElement.lang = lang;
  if (lang === 'en') return;
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.innerHTML.replace(/\s+/g, ' ').trim();
    if (DICT[key]) el.innerHTML = DICT[key];
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement?.closest('[data-i18n], script, style')) continue;
    const key = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (key && DICT[key]) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), DICT[key]);
  }
  for (const attr of ['placeholder', 'aria-label', 'title']) {
    for (const el of root.querySelectorAll(`[${attr}]`)) {
      const key = el.getAttribute(attr).replace(/\s+/g, ' ').trim();
      if (DICT[key]) el.setAttribute(attr, DICT[key]);
    }
  }
}
