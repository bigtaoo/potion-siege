import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../platform/types';
import { GUEST } from './saveCopies';
import { MAX_OWNERS, MIRROR_KEY, SaveMirror, hexId } from './saveMirror';

function memory(init: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** Ids counting up, 2·bytes hex digits like hexId's. */
function counter() {
  let n = 0;
  return (bytes: number) => String(++n).padStart(bytes * 2, '0');
}

describe('SaveMirror', () => {
  it('makes random hex ids of the given size', () => {
    expect(hexId(12)).toMatch(/^[0-9a-f]{24}$/);
    expect(hexId(12)).not.toBe(hexId(12));
  });

  it("keeps one copy per owner, its server id for the owner's later saves", () => {
    const store = memory();
    const m = new SaveMirror(store, counter());
    const first = m.put(GUEST, 's1', 10);
    expect(first).toEqual({ owner: GUEST, save: 's1', at: 10, id: '1'.padStart(24, '0'), token: '2'.padStart(32, '0') });
    const later = m.put(GUEST, 's2', 20);
    expect([later.id, later.token, later.save]).toEqual([first.id, first.token, 's2']);
    // a new page reads the same
    expect(new SaveMirror(store).all()).toEqual([later]);
  });

  it('keeps which account a guest copy belongs to', () => {
    const m = new SaveMirror(memory(), counter());
    m.put(GUEST, 's1', 1, { from: 'pg:a' });
    expect(m.put(GUEST, 's2', 2).from).toBe('pg:a');
    expect(m.put(GUEST, 's3', 3, { from: 'pg:b' }).from).toBe('pg:b');
    m.claim(GUEST, 'pg:c');
    m.claim('pg:none', 'pg:c');
    expect(new SaveMirror(m['store']).all().map((c) => [c.owner, c.from])).toEqual([[GUEST, 'pg:c']]);
  });

  it('keeps the latest owners only, the latest written first', () => {
    const m = new SaveMirror(memory(), counter());
    for (let i = 0; i < MAX_OWNERS + 2; i++) m.put(`pg:${i}`, 's', i);
    m.put('pg:3', 's', 99);
    expect(m.all().map((c) => c.owner)).toEqual(['pg:3', 'pg:5', 'pg:4', 'pg:2']);
  });

  it('reads nothing from a broken or foreign value, and skips broken copies', () => {
    expect(new SaveMirror(memory({ [MIRROR_KEY]: '{oops' })).all()).toEqual([]);
    expect(new SaveMirror(memory({ [MIRROR_KEY]: '{"copies":5}' })).all()).toEqual([]);
    expect(new SaveMirror(null).all()).toEqual([]);
    const good = { owner: GUEST, at: 1, save: 's', id: 'a'.repeat(24), token: 'b'.repeat(32), from: 'pg:x' };
    const copies = [good, { ...good, id: 'NOT HEX' }, { ...good, at: 'soon' }, { ...good, owner: '' }, null, { ...good, from: 7 }];
    const kept = new SaveMirror(memory({ [MIRROR_KEY]: JSON.stringify({ copies }) })).all();
    expect(kept).toEqual([good, { owner: GUEST, at: 1, save: 's', id: good.id, token: good.token }]);
  });

  it('carries on in memory when the store throws', () => {
    const m = new SaveMirror({ getItem: () => null, setItem: () => { throw new Error('full'); } }, counter());
    m.put(GUEST, 's', 1);
    expect(m.of(GUEST)?.save).toBe('s');
  });
});
