import { describe, expect, it } from 'vitest';
import { en } from './en';
import { zh } from './zh';

/** Every string in a table by its dotted key. */
function flatten(o: object, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(o)) {
    const key = prefix + k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of flatten(v as object, key + '.')) out.set(kk, vv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n', () => {
  const E = flatten(en);
  const Z = flatten(zh);

  it('has the same keys in both languages', () => {
    expect([...Z.keys()].sort()).toEqual([...E.keys()].sort());
  });

  it('fills the same placeholders in both languages', () => {
    const bad = [...E].filter(([k, v]) => placeholders(v).join() !== placeholders(Z.get(k) ?? '').join());
    expect(bad.map(([k, v]) => `${k}: ${v} | ${Z.get(k)}`)).toEqual([]);
  });

  it('keeps the hard line breaks of fixed-layout labels', () => {
    // Chinese may break wrapped text where it reads best (full.hint), but a label that English
    // splits on purpose (a button's two lines) needs the same lines in Chinese
    const lines = (s: string) => s.split('\n').length;
    const bad = [...E].filter(([k, v]) => lines(v) > 1 && lines(v) !== lines(Z.get(k) ?? ''));
    expect(bad.map(([k, v]) => `${k}: ${JSON.stringify(v)} | ${JSON.stringify(Z.get(k))}`)).toEqual([]);
  });

  it('has no empty or untranslated Chinese strings', () => {
    // a string that is only placeholders, numbers and symbols needs no translation
    const words = /[A-Za-z]{2,}/;
    const same = new Set(['mvp', 'sound.policyPage']);
    const bad = [...Z].filter(([k, v]) => !v.trim() || (!same.has(k) && words.test(v.replace(/\{\w+\}/g, '')) && v === E.get(k)));
    expect(bad.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });

  it('uses full-width punctuation next to Chinese', () => {
    const bad = [...Z].filter(([, v]) => /[一-鿿][!:;?,()]|[!:;?,()][一-鿿]/.test(v));
    expect(bad.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });

  it('leaves no stray braces', () => {
    const stray = (s: string) => /[{}]/.test(s.replace(/\{\w+\}/g, ''));
    const bad = [...E, ...Z].filter(([, v]) => stray(v));
    expect(bad.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });
});
