import { describe, expect, it } from 'vitest';
import { accountOwner, compareProgress, GUEST, isFresh, pickCopy, progressOf, type SaveCopy } from './saveCopies';
import { saveWith } from './testSaves';

const A = 'pg:aaaa';
const B = 'pg:bbbb';
const copy = (owner: string, save: string, at = 1, from?: string): SaveCopy => ({ owner, save, at, ...(from ? { from } : {}) });

describe('progress', () => {
  it('counts battles first, then levels, then stages won', () => {
    expect(progressOf(null)).toEqual([0, 6, 0]);
    expect(progressOf(saveWith(3, 2, 1))).toEqual([3, 8, 1]);
    expect(compareProgress(saveWith(2, 9, 9), saveWith(3))).toBeLessThan(0);
    expect(compareProgress(saveWith(3, 1), saveWith(3, 0, 9))).toBeGreaterThan(0);
    expect(compareProgress(saveWith(3, 0, 2), saveWith(3, 0, 1))).toBeGreaterThan(0);
    expect(compareProgress(saveWith(3), saveWith(3))).toBe(0);
  });

  it('calls a save with no battle fresh, a broken one too', () => {
    expect([isFresh(null), isFresh('{oops'), isFresh(saveWith(0, 5)), isFresh(saveWith(1))]).toEqual([true, true, true, false]);
  });
});

describe('accountOwner', () => {
  it('hashes the portal id into a stable owner of its own', () => {
    expect(accountOwner('u1')).toMatch(/^pg:[0-9a-f]{16}$/);
    expect(accountOwner('u1')).toBe(accountOwner('u1'));
    expect(accountOwner('u1')).not.toBe(accountOwner('u2'));
    expect([accountOwner('u1', 'cg'), accountOwner('u1', 'gc')]).toEqual([accountOwner('u1').replace('pg:', 'cg:'), accountOwner('u1').replace('pg:', 'gc:')]);
  });
});

describe('pickCopy', () => {
  it("keeps the host's save when it is the best of the owner's", () => {
    expect(pickCopy(GUEST, saveWith(5), [copy(GUEST, saveWith(4))], null)).toBeNull();
    expect(pickCopy(A, saveWith(5), [copy(A, saveWith(5))], copy(A, saveWith(5)))).toBeNull();
    expect(pickCopy(GUEST, null, [], null)).toBeNull();
  });

  it("brings back the owner's own copy when the host lost or rolled back the save", () => {
    expect(pickCopy(GUEST, null, [copy(GUEST, saveWith(4))], null)).toEqual({ save: saveWith(4), source: 'mirror' });
    expect(pickCopy(A, saveWith(2), [copy(A, saveWith(4))], copy(A, saveWith(7), 9))).toEqual({ save: saveWith(7), source: 'server' });
    // as much progress: the newer copy
    expect(pickCopy(A, null, [copy(A, saveWith(4), 5)], copy(A, saveWith(4), 9))?.source).toBe('server');
    expect(pickCopy(A, null, [copy(A, saveWith(4), 9)], copy(A, saveWith(4), 5))?.source).toBe('mirror');
  });

  it("never takes another account's progress, own or as a guest copy", () => {
    expect(pickCopy(B, null, [copy(A, saveWith(9))], null)).toBeNull();
    expect(pickCopy(B, null, [copy(GUEST, saveWith(9), 1, A)], null)).toBeNull();
    // a server copy of someone else is no copy of B's
    expect(pickCopy(B, null, [], copy(A, saveWith(9)))).toBeNull();
  });

  it("lets a fresh account take the device's guest progress", () => {
    expect(pickCopy(A, null, [copy(GUEST, saveWith(6))], null)).toEqual({ save: saveWith(6), source: 'mirror', adopted: GUEST });
    // its own guest copy back (the guest had taken it from A)
    expect(pickCopy(A, saveWith(0), [copy(GUEST, saveWith(6), 1, A)], null)?.adopted).toBe(GUEST);
    // an account with progress of its own keeps it
    expect(pickCopy(A, saveWith(1), [copy(GUEST, saveWith(6))], null)).toBeNull();
    expect(pickCopy(A, null, [copy(A, saveWith(1)), copy(GUEST, saveWith(6))], null)?.save).toBe(saveWith(1));
    // a fresh guest copy is nothing to take
    expect(pickCopy(A, null, [copy(GUEST, saveWith(0, 3))], null)).toBeNull();
  });

  it("lets a fresh guest take the device's latest account, marked as its", () => {
    const mirror = [copy(A, saveWith(3), 5), copy(B, saveWith(8), 7)];
    expect(pickCopy(GUEST, null, mirror, null)).toEqual({ save: saveWith(8), source: 'mirror', adopted: B, from: B });
    expect(pickCopy(GUEST, saveWith(1), mirror, null)).toBeNull();
    expect(pickCopy(GUEST, null, [copy(A, saveWith(0), 9)], null)).toBeNull();
  });
});
