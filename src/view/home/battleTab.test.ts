// The battle tab's commander (battleTab.ts): painted once the art is in, as tall as the room
// between the stage card and the start button allows.
import '../layout/measure';
import { Container, Sprite } from 'pixi.js';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { newMeta } from '../../sim/meta';
import { commanderTexture } from '../art';
import { fakeArt } from '../fakeArt';
import { battleTab } from './battleTab';
import type { HomeActions } from './types';

afterAll(() => vi.unstubAllGlobals());

const act = new Proxy({}, { get: () => vi.fn() }) as HomeActions;

function painted(h: number): Sprite[] {
  const root = new Container();
  battleTab(root, newMeta(), act, { x: 0, y: 150, w: 1080, h, wide: false }, '2026-10-28', false);
  return root.children.filter((c): c is Sprite => c instanceof Sprite && c.texture === commanderTexture());
}

describe('the commander on the battle tab', () => {
  it('stands painted on its feet once the art is in, and not in a room too low for it', async () => {
    expect(commanderTexture()).toBeUndefined();
    await fakeArt();
    const [s] = painted(1770);
    expect([s.anchor.x, s.anchor.y]).toEqual([0.5, 1]);
    expect(s.x).toBe(540);
    expect(s.scale.y).toBeGreaterThanOrEqual(160);
    expect(painted(700)).toEqual([]);
  });
});
