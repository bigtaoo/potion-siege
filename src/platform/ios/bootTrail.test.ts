import { describe, expect, it } from 'vitest';
import { BootTrail, errorText, PENDING_KEY, PENDING_MAX, TRAIL_ERRORS, TRAIL_KEY, unfinished } from './bootTrail';

function memory() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

describe('BootTrail', () => {
  it('a finished launch leaves nothing to report', () => {
    const kv = memory();
    let now = 100;
    const trail = new BootTrail(kv, '1.0.18.2', '18', () => now);
    now = 400;
    trail.step('boot');
    expect(JSON.parse(kv.store.get(TRAIL_KEY)!)).toMatchObject({ stage: 'boot', ms: 300, bundle: '1.0.18.2' });
    trail.done();
    expect(new BootTrail(kv, '1.0.18.2', '18', () => 0).take()).toEqual([]);
  });

  it('the next launch takes an unfinished one as boot_fail, with its first errors', () => {
    const kv = memory();
    let now = 0;
    const first = new BootTrail(kv, '1.0.18.2', '18', () => now);
    now = 1234.4;
    first.step('boot', 'ipad');
    for (let i = 0; i < TRAIL_ERRORS + 2; i++) first.error(`e${i}`);
    // the web view dies here: no done()
    const next = new BootTrail(kv, '1.0.18.3', '18', () => 0);
    expect(next.take()).toEqual([{
      kind: 'boot_fail',
      props: { place: 'boot', stage: 'boot', ms: 1234, bundle: '1.0.18.2', build: '18', info: 'ipad', msg: 'e0', errors: TRAIL_ERRORS },
    }]);
    expect(next.take()).toEqual([]);
  });

  it('keeps reports through launches that fail before they can send, the newest few', () => {
    const kv = memory();
    for (let i = 0; i < PENDING_MAX + 3; i++) new BootTrail(kv, `1.0.18.${i}`, '18', () => 0);
    const out = new BootTrail(kv, 'last', '18', () => 0).take();
    expect(out).toHaveLength(PENDING_MAX);
    expect(out[out.length - 1].props.bundle).toBe(`1.0.18.${PENDING_MAX + 2}`);
  });

  it('adds rolled-back bundles to the reports', () => {
    const kv = memory();
    const trail = new BootTrail(kv, '1.0.18.2', '18', () => 0);
    trail.push({ kind: 'ota_fail', props: { place: 'boot', bundle: '1.0.18.3' } });
    expect(trail.take()).toEqual([{ kind: 'ota_fail', props: { place: 'boot', bundle: '1.0.18.3' } }]);
  });

  it('survives a bad record and a storage that throws', () => {
    const kv = memory();
    kv.store.set(TRAIL_KEY, '{not json');
    kv.store.set(PENDING_KEY, '[{"kind":"other","props":{}},5]');
    expect(new BootTrail(kv, '1', '1', () => 0).take()).toEqual([]);
    const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    const trail = new BootTrail(broken, '1', '1', () => 0);
    trail.step('boot');
    trail.error('x');
    trail.done();
    expect(trail.take()).toEqual([]);
  });

  it('reads nothing into a clean launch, and cuts long messages', () => {
    expect(unfinished(null)).toBeNull();
    expect(errorText(new Error('x'.repeat(100)))).toHaveLength(64);
    expect(errorText('short')).toBe('short');
  });
});
