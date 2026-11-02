// Where a cast lands (commander.ts doCast): at the point the player dragged it to, kept on the
// road; with no point (a tap, the self-cast, the bot, an old replay's command) on the thickest
// crowd; and either way played back the same from the replay.

import { describe, expect, it } from 'vitest';
import { botAct } from './bot';
import { Battle } from './battle';
import { charged, grunt } from './commanderKit';
import { K } from './field';
import { toFp } from './math/fixed';
import { checkReplay, takeReplay } from './replay';
import { BALANCE } from './types';

const C = BALANCE.commander;

describe('cast point', () => {
  it('throws the flask where it was dragged, and says so', () => {
    const b = charged();
    b.enemies.push(grunt(1, 300, 500, 1e6), grunt(2, 800, 900, 1e6));
    expect(b.cast({ x: toFp(800), y: toFp(880) })).toBe(true);
    expect(b.flasks[0]).toMatchObject({ x: toFp(800), y: toFp(880), how: 'drag' });
    expect(b.drain().find((e) => e.type === 'cast')).toMatchObject({ x: 800, y: 880, how: 'drag' });
    expect(b.commands[b.commands.length - 1]).toMatchObject({ type: 'cast', x: toFp(800), y: toFp(880) });
  });

  it('keeps a point off the road on it: within the sides, below the top, before the wall', () => {
    const b = charged();
    b.cast({ x: toFp(-500), y: toFp(5000) });
    expect(b.flasks[0]).toMatchObject({ x: K.left, y: b.wallFront(K.left) });
    b.charge = C.charge;
    b.cast({ x: toFp(5000), y: toFp(-50) });
    expect(b.flasks[1]).toMatchObject({ x: K.right, y: K.top });
    b.charge = C.charge;
    b.cast({ x: 500_400.6, y: 700_000.4 });
    expect(b.flasks[2]).toMatchObject({ x: 500_401, y: 700_000 });
  });

  it('lands a dragged one on an empty road too (a trap laid ahead), a tap only with someone to hit', () => {
    const b = charged();
    expect(b.cast()).toBe(false);
    expect(b.charge).toBe(C.charge);
    expect(b.cast({ x: toFp(500), y: toFp(600) })).toBe(true);
  });

  it('throws an old command with no point, or a broken one, at the thickest crowd', () => {
    const b = charged();
    const lone = grunt(1, 200, 700, 1e6);
    const pack = [grunt(2, 700, 600, 1e6), grunt(3, 740, 620, 1e6), grunt(4, 680, 650, 1e6)];
    b.enemies.push(lone, ...pack);
    expect(b.apply({ type: 'cast' })).toBe(true);
    expect(b.flasks[0].how).toBe('tap');
    expect(Math.abs(b.flasks[0].x - toFp(720))).toBeLessThan(toFp(60));
    b.charge = C.charge;
    expect(b.apply({ type: 'cast', x: Number.NaN, y: toFp(100) })).toBe(true);
    expect(b.flasks[1].how).toBe('tap');
  });

  it('plays back dragged, tapped and self-cast spells to the same battle', () => {
    const b = new Battle(11);
    let dragged = 0;
    for (let i = 0; i < 30 * 240 && !b.result; i++) {
      if (b.canCast() && i % 2 === 0) {
        const e = b.enemies.find((o) => o.hp > 0);
        if (e && b.cast({ x: e.x, y: e.y + toFp(40) })) dragged++;
      }
      botAct(b);
      b.step();
      b.drain();
    }
    expect(dragged).toBeGreaterThan(0);
    expect(checkReplay(takeReplay(b))).toBe(true);
  });
});
