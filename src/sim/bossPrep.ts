// A breath before the last boss (audit G3): as the stage's last wave sets out with its boss, the
// player gets one free skill offer, leaning to a fielded potion the boss is weak to, and the
// commander half a charge. The wave walks in as usual once a card is picked, so the field never
// stands empty (the view's bossPreview.ts shows the boss meanwhile).
import type { Battle } from './battle';
import { resist } from './enemies';
import { BALANCE, HERO_KINDS, isBoss, type HeroKind } from './types';
import { isBossWave } from './waves';

/** Of a full charge, what the commander gets before the last boss. */
export const BOSS_CHARGE = 0.5;

/** Right after the last wave started (spawn.ts startWave): the offer and the charge, once. */
export function prepBoss(b: Battle): void {
  if (b.waveTime !== 0 || b.wave !== BALANCE.waves.count || b.setup.endless) return;
  if (!isBossWave(b.wave, b.setup.modifiers?.bossWaves)) return;
  const C = BALANCE.commander;
  b.charge = Math.min(C.charge, b.charge + Math.round(C.charge * BOSS_CHARGE));
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
