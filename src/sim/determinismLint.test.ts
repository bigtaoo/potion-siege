import { describe, expect, it } from 'vitest';

// Keeps the battle deterministic (after standing's determinismLint.test.ts): no call whose
// result can differ between JS engines or between runs, and nothing from the host. Comments
// and strings are blanked before scanning, so prose quoting a rule does not trip it. The
// allowlist carries a reason per entry and must stay minimal: an exception that stops being
// needed fails the test. Only the files a battle runs through are scanned; the meta, daily and
// challenge rules work out the setup, which a replay records.

const BANNED: readonly { pattern: RegExp; why: string }[] = [
  { pattern: /\bMath\.random\s*\(/, why: 'use the battle Prng' },
  { pattern: /\bMath\.sqrt\s*\(/, why: 'use isqrt (math/fixed.ts)' },
  { pattern: /\bMath\.(?:sin|cos|tan|asin|acos|atan2?)\s*\(/, why: 'use sinB/cosB/atan2B (math/trig.ts)' },
  { pattern: /\bMath\.hypot\s*\(/, why: 'use dist (math/fixed.ts)' },
  { pattern: /\bMath\.(?:log2?|log10|exp|pow|cbrt)\s*\(/, why: 'transcendental: not bit-identical across engines' },
  { pattern: /\*\*/, why: 'exponentiation goes through pow: multiply instead' },
  { pattern: /\bDate\b|\bperformance\b|\bsetTimeout\b|\brequestAnimationFrame\b/, why: 'clocks: the battle advances on ticks' },
  { pattern: /\bwindow\b|\bdocument\b|\bnavigator\b/, why: 'browser: the battle knows nothing of the host' },
];

const ALLOWED: readonly { file: string; pattern: RegExp; why: string }[] = [
  { file: 'math/fixed.ts', pattern: /\bMath\.sqrt\s*\(/, why: 'first guess of isqrt, corrected to the exact integer root' },
];

const BATTLE = /^(battle|bot|enemies|hash|replay|skills|types|waves|math\/(?!.*\.test\.ts$).*)\.ts$/;

/** Blanks comments and string literals, keeping line breaks so line numbers stay true. */
export function strip(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) out += src[i++] === '\n' ? '\n' : ' ';
      i++;
    } else if (c === "'" || c === '"' || c === '`') {
      out += c;
      for (i++; i < src.length && src[i] !== c; i++) {
        if (src[i] === '\\') i++;
        out += src[i] === '\n' ? '\n' : ' ';
      }
      out += c;
    } else out += c;
  }
  return out;
}

const sources = import.meta.glob<string>('./**/*.ts', { query: '?raw', import: 'default', eager: true });
const files = Object.entries(sources)
  .map(([path, text]) => ({ rel: path.slice(2), text }))
  .filter((f) => BATTLE.test(f.rel) && !f.rel.endsWith('.test.ts'))
  .map((f) => ({ ...f, code: strip(f.text) }));

describe('determinism lint', () => {
  it('scans the battle sources', () => {
    const rels = files.map((f) => f.rel);
    for (const f of ['battle.ts', 'waves.ts', 'skills.ts', 'math/fixed.ts', 'math/trig.ts']) expect(rels).toContain(f);
  });

  it('finds no banned call outside the allowlist', () => {
    const found: string[] = [];
    for (const f of files) {
      f.code.split('\n').forEach((line, i) => {
        for (const b of BANNED) {
          if (!b.pattern.test(line)) continue;
          if (ALLOWED.some((a) => a.file === f.rel && a.pattern.test(line))) continue;
          found.push(`${f.rel}:${i + 1} ${line.trim()}  (${b.why})`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it('imports nothing from outside the sim (no Pixi, no view code)', () => {
    const outside = files.flatMap((f) =>
      [...f.text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]).filter((m) => !m.startsWith('./') && !m.startsWith('../sim/')).map((m) => `${f.rel}: ${m}`),
    );
    expect(outside).toEqual([]);
  });

  it('keeps every allowlist entry in use', () => {
    for (const a of ALLOWED) expect(files.find((f) => f.rel === a.file)?.code).toMatch(a.pattern);
  });

  it('strips comments and strings but keeps code', () => {
    expect(strip("a(); // Math.random()\nb('Math.sqrt(')")).toBe("a(); \nb('          ')");
  });
});
