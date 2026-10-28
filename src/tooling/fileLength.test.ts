import { describe, expect, it } from 'vitest';
import { countLines, lengthErrors, MAX_LINES } from '../../scripts/fileLength.mjs';

// The file-size rule (CLAUDE.md "File size", scripts/checkFileLength.mjs): the count, the limit
// and the ratchet a baseline puts on a file that waits to be split.

describe('countLines', () => {
  it('counts lines as an editor numbers them', () => {
    // an empty file shows one (empty) line
    expect([countLines(''), countLines('a'), countLines('a\n'), countLines('a\nb'), countLines('a\nb\n'), countLines('\n\n')]).toEqual([1, 1, 1, 2, 2, 2]);
  });
});

describe('lengthErrors', () => {
  it('passes files at the limit and fails the ones over it', () => {
    expect(MAX_LINES).toBe(500);
    expect(lengthErrors([['src/a.ts', 500], ['src/b.ts', 10]], {})).toEqual([]);
    expect(lengthErrors([['src/a.ts', 501]], {})).toEqual(['src/a.ts: 501 lines, over 500']);
    expect(lengthErrors([['src/a.ts', 11]], {}, 10)).toEqual(['src/a.ts: 11 lines, over 10']);
  });

  it('holds a baseline file at its count: never longer, and the cap follows it down', () => {
    const baseline = { 'src/big.ts': 620 };
    expect(lengthErrors([['src/big.ts', 620]], baseline)).toEqual([]);
    expect(lengthErrors([['src/big.ts', 621]], baseline)).toEqual(['src/big.ts: 621 lines, grew past its 620; move the new code to its own file']);
    expect(lengthErrors([['src/big.ts', 580]], baseline)).toEqual([
      'src/big.ts: down to 580 lines; lower its BASELINE entry in scripts/checkFileLength.mjs from 620 to 580',
    ]);
  });

  it('wants a baseline file off the list once it is at the limit, or gone', () => {
    const baseline = { 'src/big.ts': 620, 'src/old.ts': 700 };
    expect(lengthErrors([['src/big.ts', 500]], baseline)).toEqual([
      'src/big.ts: down to 500 lines; take it out of BASELINE in scripts/checkFileLength.mjs',
      'src/old.ts: gone; take it out of BASELINE in scripts/checkFileLength.mjs',
    ]);
  });

  it('takes the counts from a generator, as the walk over the disk gives them', () => {
    function* counts(): Generator<[string, number]> {
      yield ['scripts/x.mjs', 900];
      yield ['server/y.mjs', 3];
    }
    expect(lengthErrors(counts(), {})).toEqual(['scripts/x.mjs: 900 lines, over 500']);
  });
});
