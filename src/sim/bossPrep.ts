// A breath before the last boss (audit G3): as the stage's last wave sets out with its boss, the
// player gets one free skill offer, leaning to a fielded potion the boss is weak to (no extra
// commander charge: with it the bosses fell far too easily). The wave walks in as usual once a card is picked, so the field never
// stands empty (the view's bossPreview.ts shows the boss meanwhile). Not on stages 1-3: their
// bosses are meant to stay a wall, and lossStreak.ts helps there instead.
import type { Battle } from './battle';
import { resist } from './enemies';
import { BALANCE, HERO_KINDS, isBoss, type HeroKind } from './types';
import { isBossWave } from './waves';

/** The first stage with the help: without it stage 3 goes from 36 to 52 bot wins in 60. */
export const PREP_FROM = 4;

/** Right after the last wave started (spawn.ts startWave): the offer, once. */
export function prepBoss(b: Battle): void {
  if (b.waveTime !== 0 || b.wave !== BALANCE.waves.count || b.setup.endless || b.setup.stage < PREP_FROM) return;
  if (!isBossWave(b.wave, b.setup.modifiers?.bossWaves)) return;
  b.offer('boss', weakFielded(b));
}

/** The fielded potion the coming boss is weakest to, if it is weak to any. */
export function weakFielded(b: Battle): HeroKind | undefined {
  const boss = b.pending.find((s) => isBoss(s.kind))?.kind;
  if (!boss) return undefined;
  const fielded = new Set(b.slots.flatMap((h) => (h ? [h.kind] : [])));
  let best: HeroKind | undefined;
  for (const k of HERO_KINDS) if (fielded.has(k) && resist(boss, k) > (best ? resist(boss, best) : 1)) best = k;
  return best;
}
