// No battle can stall, in any mode: the bot (bot.ts) has a potion on the wall within a few
// seconds, a pause always has a card to take, the state stays finite, and every battle ends
// (won or lost) inside the time cap, even one the player never touches. Played on story stages
// across the chapters (the bosses' finales among them), endless, the challenge under each
// modifier and each pair, and the revive.
import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import { botAct } from './bot';
import { challengeSetup } from './challenge';
import { endlessSetup } from './endless';
import { TICK_RATE } from './math/fixed';
import { battleSetup, newMeta, type BattleSetup } from './meta';
import { arrive, challengeFor, modifierSets, SAVES, spentSave } from './setupCatalog';

/** Story and challenge battles end inside this; endless runs inside ENDLESS_CAP. */
const CAP = 1200;
const ENDLESS_CAP = 7200;
/** The bot has a potion on the wall by then. */
const FIRST_POTION = 5;
const SEEDS = [1, 2, 3];

/** What went wrong in one battle the bot plays (or, `idle`, nobody plays); empty when nothing. */
function playChecked(name: string, seed: number, setup: BattleSetup, cap: number, opts: { idle?: boolean; revive?: boolean } = {}): string[] {
  const b = new Battle(seed, setup);
  const out: string[] = [];
  const at = `${name} seed ${seed}`;
  let first = Infinity;
  let revived = !opts.revive;
  for (let t = 0; t < cap * TICK_RATE; t++) {
    if (b.result === 'lost' && !revived) {
      revived = true;
      if (!b.revive()) out.push(`${at}: the revive did not take`);
    }
    if (b.result !== null) break;
    if (!opts.idle) botAct(b);
    if (b.paused && b.result === null && !b.choices?.length) return [...out, `${at}: paused at ${b.seconds} s with nothing to choose`];
    b.step();
    b.drain();
    if (first === Infinity && b.slots.some((h) => h)) first = b.seconds;
    if (t % TICK_RATE === 0) {
      const bad = insane(b);
      if (bad) return [...out, `${at}: ${bad} at ${b.seconds} s`];
    }
  }
  if (b.result === null) out.push(`${at}: still going at the ${cap} s cap (wave ${b.wave})`);
  if (!opts.idle && first > FIRST_POTION) out.push(`${at}: first potion at ${first} s`);
  if (opts.idle && b.result !== 'lost') out.push(`${at}: an untouched battle ended ${b.result}`);
  return out;
}

/** A number in the state that cannot be: NaN, infinite, negative where it may not be. */
function insane(b: Battle): string | null {
  if (!Number.isInteger(b.gold) || b.gold < 0) return `gold ${b.gold}`;
  if (!Number.isFinite(b.wall) || !Number.isFinite(b.wallMax) || b.wallMax <= 0) return `wall ${b.wall}/${b.wallMax}`;
  if (!Number.isFinite(b.charge) || b.charge < 0) return `charge ${b.charge}`;
  for (const e of b.enemies) if (![e.x, e.y, e.hp, e.maxHp, e.speed].every(Number.isFinite) || e.maxHp <= 0) return `enemy ${e.kind} x ${e.x} y ${e.y} hp ${e.hp}/${e.maxHp}`;
  for (const p of b.projectiles) if (![p.x, p.y].every(Number.isFinite)) return `projectile at ${p.x}, ${p.y}`;
  return null;
}

const story = [1, 3, 5, 10, 15, 20, 30, 40, 50];

describe('no soft lock', () => {
  it('on story stages across the chapters, bosses included', () => {
    const bad = story.flatMap((stage) => {
      const m = spentSave(stage - 1, arrive(stage));
      return SEEDS.flatMap((seed) => playChecked(`stage ${stage}`, seed, battleSetup(m, stage), CAP));
    });
    expect(bad).toEqual([]);
  }, 120_000);

  it('on a brand-new save and a maxed one', () => {
    const fresh = newMeta();
    const max = SAVES.maxed();
    const bad = SEEDS.flatMap((seed) => [
      ...playChecked('new save stage 1', seed, battleSetup(fresh, 1), CAP),
      ...playChecked('maxed save stage 50', seed, battleSetup(max, 50), CAP),
    ]);
    expect(bad).toEqual([]);
  }, 120_000);

  it('in endless, which ends only when the wall falls', () => {
    const m = spentSave(10, arrive(11));
    expect(SEEDS.flatMap((seed) => playChecked('endless', seed, endlessSetup(m), ENDLESS_CAP))).toEqual([]);
  }, 120_000);

  it('in the challenge under every modifier and every pair', () => {
    const m = SAVES.fresh();
    const bad = [[], ...modifierSets(1), ...modifierSets(2)].flatMap((mods) =>
      SEEDS.flatMap((seed) => playChecked(`challenge ${mods.join('+') || 'plain'}`, seed, challengeSetup(m, challengeFor(m, mods, seed)), CAP)),
    );
    expect(bad).toEqual([]);
  }, 120_000);

  it('after a revive, in a stage and in endless', () => {
    const bad = SEEDS.flatMap((seed) => [
      ...playChecked('stage 30 revived', seed, battleSetup(spentSave(29, arrive(30)), 30), CAP, { revive: true }),
      ...playChecked('endless revived', seed, endlessSetup(spentSave(10, arrive(11))), ENDLESS_CAP, { revive: true }),
    ]);
    expect(bad).toEqual([]);
  }, 120_000);

  it('with nobody playing: the waves still come and the wall falls', () => {
    const m = SAVES.fresh();
    const bad = [
      ...playChecked('idle stage 1', 1, battleSetup(newMeta(), 1), CAP, { idle: true }),
      ...playChecked('idle stage 10', 1, battleSetup(m, 10), CAP, { idle: true }),
      ...playChecked('idle endless', 1, endlessSetup(m), CAP, { idle: true }),
      ...modifierSets(1).flatMap((mods) => playChecked(`idle challenge ${mods}`, 1, challengeSetup(m, challengeFor(m, mods, 1)), CAP, { idle: true })),
    ];
    expect(bad).toEqual([]);
  }, 120_000);
});
