// The codex's taps: a tab turns the page (and the page stays turned for the next build), and an
// enemy card asks for that enemy's panel. What fits where is layout.test.ts's job.
import './layout/measure';
import { afterEach, describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { newMeta } from '../sim/meta';
import { ENEMY_KINDS, type EnemyKind } from '../sim/types';
import { buildCodex, isEnemy, setCodexPage } from './Codex';

const AREA = { x: 0, y: 150, w: 1080, h: 1978, wide: false };

/** Everything under `c` that answers a tap, in drawing order. */
function taps(c: Container): Container[] {
  const out: Container[] = [];
  const walk = (n: Container): void => {
    if (n.listenerCount('pointertap') > 0) out.push(n);
    for (const k of n.children) walk(k);
  };
  walk(c);
  return out;
}

const tap = (c: Container): void => void c.emit('pointertap', {} as never);
const page = (root: Container): Container => root.children[0];
const tabs = (root: Container): Container => root.children[1];

afterEach(() => setCodexPage('potions'));

describe('codex', () => {
  it('turns to the tapped page and stays there', async () => {
    const root = buildCodex(newMeta(), AREA, () => {}, () => {});
    // the open page's tab takes no tap: potions is lit, enemies and achievements are not
    expect(taps(tabs(root))).toHaveLength(2);
    tap(taps(tabs(root))[0]);
    await Promise.resolve();
    expect(taps(page(root)).length).toBe(ENEMY_KINDS.length);
    const again = buildCodex(newMeta(), AREA, () => {}, () => {});
    expect(taps(page(again)).length).toBe(ENEMY_KINDS.length);
  });

  it('opens the tapped enemy', () => {
    setCodexPage('enemies');
    const opened: EnemyKind[] = [];
    const root = buildCodex(newMeta(), AREA, () => {}, (k) => opened.push(k));
    for (const card of taps(page(root))) tap(card);
    expect(new Set(opened)).toEqual(new Set(ENEMY_KINDS));
  });

  it('tells an enemy panel from the others', () => {
    expect(ENEMY_KINDS.every(isEnemy)).toBe(true);
    expect(isEnemy('fire')).toBe(false);
    expect(isEnemy('settings')).toBe(false);
    expect(isEnemy(null)).toBe(false);
  });
});
