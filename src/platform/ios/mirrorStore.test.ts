import { describe, expect, it } from 'vitest';
import { SafeStore } from '../types';
import { MirrorStore } from './mirrorStore';

describe('MirrorStore', () => {
  it('writes to localStorage and the native copy', () => {
    const local = new SafeStore(null);
    const pushed: [string, string][] = [];
    const store = new MirrorStore({}, (k, v) => pushed.push([k, v]), local);
    store.setItem('ps.save', '{"crystals":5}');
    expect(local.getItem('ps.save')).toBe('{"crystals":5}');
    expect(pushed).toEqual([['ps.save', '{"crystals":5}']]);
    expect(store.getItem('ps.save')).toBe('{"crystals":5}');
  });

  it('restores from the native copy when WebKit lost its storage', () => {
    const store = new MirrorStore({ 'ps.save': '{"crystals":9}' }, () => {}, new SafeStore(null));
    expect(store.getItem('ps.save')).toBe('{"crystals":9}');
    expect(store.getItem('ps.other')).toBeNull();
  });

  it('prefers localStorage over the launch copy after a reload', () => {
    const local = new SafeStore(null);
    local.setItem('ps.save', '{"crystals":12}');
    const store = new MirrorStore({ 'ps.save': '{"crystals":9}' }, () => {}, local);
    expect(store.getItem('ps.save')).toBe('{"crystals":12}');
  });

  it('keeps working when either side throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
    const store = new MirrorStore({ a: '1' }, () => { throw new Error('gone'); }, broken);
    expect(store.getItem('a')).toBe('1');
    expect(() => store.setItem('b', '2')).toThrow('quota');
    expect(store.getItem('b')).toBe('2');
  });
});
