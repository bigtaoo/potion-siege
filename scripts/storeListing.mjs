// Checks the store listing text in store/<lang>/ against each field's limits.
// node scripts/storeListing.mjs prints every field's length per language and exits 1 on a problem;
// src/i18n/store.test.ts runs the same check inside npm test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'store');

/** Every field: where it lives, its limit, and whether it must stay on one line.
 *  App Store limits are App Store Connect's own; the CrazyGames ones are ours (the portal shows the
 *  short description as one line under the title, and the controls as a short list). */
export const FIELDS = {
  name: { dir: 'app-store', max: 30, oneLine: true },
  subtitle: { dir: 'app-store', max: 30, oneLine: true },
  promotional_text: { dir: 'app-store', max: 170, oneLine: true },
  description: { dir: 'app-store', max: 4000, oneLine: false },
  keywords: { dir: 'app-store', max: 100, oneLine: true },
  short_description: { dir: 'crazygames', max: 160, oneLine: true },
  controls: { dir: 'crazygames', max: 500, oneLine: false },
};

/** Our language code to App Store Connect's locale. */
export const ASC_LOCALE = {
  en: 'en-US', zh: 'zh-Hans', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it', pt: 'pt-BR', pl: 'pl',
  ru: 'ru', ja: 'ja', ko: 'ko', vi: 'vi', tr: 'tr', th: 'th', id: 'id',
};

/** Length as App Store Connect counts it, in UTF-16 units: the same as characters for every
 *  script here, and never less (Thai tone marks count, as they do there). */
export const length = (s) => s.length;

/** A field's text as it is pasted: the file without its trailing newline. */
export function readField(lang, field, root = ROOT) {
  const file = path.join(root, lang, FIELDS[field].dir, `${field}.txt`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd() : null;
}

/** Every problem in one language's listing, as readable lines (empty when it is fine). */
export function checkLang(lang, root = ROOT) {
  const out = [];
  const text = {};
  for (const [field, rule] of Object.entries(FIELDS)) {
    const s = readField(lang, field, root);
    text[field] = s;
    if (s === null) { out.push(`${lang}/${field}: missing`); continue; }
    if (!s.trim()) out.push(`${lang}/${field}: empty`);
    if (length(s) > rule.max) out.push(`${lang}/${field}: ${length(s)} > ${rule.max}`);
    if (rule.oneLine && s.includes('\n')) out.push(`${lang}/${field}: must be one line`);
    if (s !== s.normalize('NFC')) out.push(`${lang}/${field}: not NFC`);
    if (s !== s.trim()) out.push(`${lang}/${field}: leading or trailing space`);
  }
  const kw = text.keywords;
  if (kw) {
    const words = kw.split(',');
    if (words.some((w) => w !== w.trim())) out.push(`${lang}/keywords: space around a comma`);
    if (words.some((w) => !w.trim())) out.push(`${lang}/keywords: empty keyword`);
    const seen = new Set();
    for (const w of words.map((x) => x.trim().toLowerCase())) {
      if (seen.has(w)) out.push(`${lang}/keywords: "${w}" twice`);
      seen.add(w);
    }
    // the name is indexed already; repeating it wastes the 100 characters
    if (text.name && seen.has(text.name.toLowerCase())) out.push(`${lang}/keywords: repeats the name`);
  }
  return out;
}

/** The languages that have a folder under store/. */
export const storeLangs = (root = ROOT) =>
  fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const langs = storeLangs();
  const short = { promotional_text: 'promo', short_description: 'cg short', description: 'desc' };
  const cols = Object.keys(FIELDS);
  console.log(['lang', ...cols.map((c) => `${short[c] ?? c} /${FIELDS[c].max}`)].join('\t'));
  const problems = [];
  for (const lang of langs) {
    console.log([lang, ...cols.map((c) => length(readField(lang, c) ?? ''))].join('\t'));
    problems.push(...checkLang(lang));
  }
  for (const p of problems) console.log('PROBLEM ' + p);
  if (problems.length) process.exit(1);
  console.log(`${langs.length} languages, all within limits`);
}
