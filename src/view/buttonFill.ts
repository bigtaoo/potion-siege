// What a grey 召唤 or 强化 button is waiting for, as a bar filling along its bottom: the first
// battle's next free summon counting down, and in a player's first battles (nudges.ts topPick)
// the gold coming in toward the price, so a grey button says how long until it lights.
import type { Graphics } from 'pixi.js';
import { GIFT_EVERY, type Battle } from '../sim/battle';
import { COLORS } from './ui';

/** How full the bar is, 0 to 1, or null when the button has none: it can be used, or the wait is
 *  not one the bar shows. */
export function buttonFill(b: Battle, which: 'summon' | 'upgrade', early: boolean): number | null {
  if (b.paused || b.result) return null;
  if (which === 'upgrade') return early && !b.canUpgrade() ? Math.min(1, b.gold / b.upgradeCost()) : null;
  const gift = b.giftLeft();
  if (gift > 0) return 1 - gift / GIFT_EVERY;
  const cost = b.summonCost();
  return early && !b.canSummon() && cost > 0 && b.freeSlots().length > 0 ? Math.min(1, b.gold / cost) : null;
}

/** The bar just under a `w` x `h` button centred on the origin, `fill` of the way along, or
 *  nothing; under it, clear of the price on the button. */
export function drawFill(g: Graphics, fill: number | null, w: number, h: number): void {
  g.clear();
  if (fill === null) return;
  const x = -w / 2 + 22;
  const y = h / 2 + 12;
  const room = w - 44;
  g.roundRect(x, y, room, 16, 8).fill({ color: 0x000000, alpha: 0.3 });
  if (fill > 0) g.roundRect(x, y, Math.max(16, room * fill), 16, 8).fill(COLORS.gold);
}
