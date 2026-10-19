// One battle: the wall, the heroes on it, the waves and the skill picks. Pure logic, no drawing;
// the view reads the state and the events each frame and sends the player's commands through
// apply() (summon, move, upgrade, choose, reroll, revive).
//
// It is deterministic: the state is all integers (see types.ts for the units), it steps at a
// fixed TICK_RATE, and its dice are Prng streams from the seed, one per concern: the enemies'
// (the waves, where each enemy comes in, how fast), the summons' (the cell and kind of each
// summon and merge, the cells built), the shots' (crits, freezes) and the skill cards'. What the
// player does never draws from the enemies' stream, so a seed sends the same waves whatever the
// player does; and since shots fire on their own clock, the n-th summon rolls the same dice
// however long the player waits for it. The same seed, setup and commands at the same ticks play
// the same battle on every engine (replay.ts), which determinismLint.test.ts and replay.test.ts
// hold it to.
//
// This file holds the state, the player's commands and the order of a tick; what happens in a
// tick lives in its own modules, each a set of functions on the battle: spawn.ts (the waves
// coming in), enemyTick.ts (the enemies moving and at the wall), bosses.ts, shots.ts (the
// potions firing), hits.ts (what each potion's hit does), damage.ts (damage and the statuses),
// kills.ts, commander.ts, targets.ts (finding enemies) and field.ts (the grid and the units).

import { doCast, stepCommander, stepFlasks } from './commander';
import { stepEnemies } from './enemyTick';
import { K, SLOT_COUNT, WALL_ROW } from './field';
import { fixedMods, type Fixed } from './fixedMods';
import { Shares } from './horde';
import { reapDead } from './kills';
import { pm, TICK_RATE, times, toFp } from './math/fixed';
import { pick } from './math/pick';
import { Prng } from './math/prng';
import { BASE_SETUP, type BattleSetup } from './meta';
import { stepHeroes, stepProjectiles } from './shots';
import { emptySkills, mods, perksFor, rollChoices, type Mods, type PerkId, type SkillId, type SkillLevels } from './skills';
import { startWave, stepWaves } from './spawn';
import { BALANCE, isBoss, type BattleEvent, type CommanderSkill, type Enemy, type Flask, type Hero, type HeroKind, type OfferReason, type Projectile, type Vortex } from './types';
import type { Spawn } from './waves';

export { SLOT_COUNT, slotCenter, WALL_ROW } from './field';

const B = BALANCE;
/** Mixed into the seed for each stream but the enemies' (Prng hashes its seed, so the streams
 *  are unrelated). */
const STREAM = { summon: 0x5bd1e995, shot: 0x27d4eb2f, card: 0x165667b1 } as const;
const C = B.commander;

/** A player command. Every change the player makes goes through Battle.apply as one of these,
 *  so a battle is its seed, its setup and its commands (replay.ts). */
export type Command =
  | { type: 'summon' }
  | { type: 'upgrade' }
  | { type: 'move'; from: number; to: number }
  | { type: 'choose'; id: SkillId }
  | { type: 'reroll' }
  /** The reroll was offered and not taken (the ad failed): the offer keeps its cards. */
  | { type: 'noReroll' }
  | { type: 'revive' }
  /** Tapping the commander once it is charged: the next of its skills. */
  | { type: 'cast' };

/** A command and the tick it was applied on. */
export type Stamped = Command & { tick: number };

export class Battle {
  /** The enemies' dice: the wave plans and each spawn's place and speed. */
  readonly enemyRng: Prng;
  /** Summon cells and kinds, merged kinds, the cells the commander builds. */
  readonly summonRng: Prng;
  /** Crits and freezes. */
  readonly shotRng: Prng;
  /** The skill cards offered. */
  readonly cardRng: Prng;
  gold: number;
  wallMax: number;
  wall: number;
  /** 1-based; 0 before the first wave starts. */
  wave = 0;
  waveTime = 0;
  summons = 0;
  /** Skill offers bought so far; each one costs more. */
  upgrades = 0;
  /** Cells the commander has built onto the wall, one every `summonsPerCell` summons. */
  built = 0;
  /** The commander's charge, one a kill (more for a boss), up to `commander.charge`; full, it can
   *  cast, and casts by itself once it has waited `autoCast` seconds. */
  charge = 0;
  /** Ticks the charge has been full. */
  chargedFor = 0;
  /** What the horde's deaths have earned towards the next charge, coin and burst; the battle's
   *  own, like the fields after `commands`. */
  readonly shares = new Shares();
  /** Skills cast so far: they go in turn, the flask first. */
  casts = 0;
  /** Ticks of the brew left: every potion throws faster while it lasts. */
  brewTime = 0;
  /** The commander's flasks in the air. */
  flasks: Flask[] = [];
  kills = 0;
  /** Ticks played (the pauses for a pick do not count). */
  time = 0;
  /** The skill offer waiting for the player; the battle is paused while it is set. */
  choices: SkillId[] | null = null;
  choiceReason: OfferReason = 'upgrade';
  /** Whether the waiting offer has been rerolled already (once per offer). */
  rerolled = false;
  result: 'won' | 'lost' | null = null;
  readonly slots: (Hero | null)[] = new Array(SLOT_COUNT).fill(null);
  /** The damage each potion has dealt, overkill left out (the commander's flask is not counted), in FP:
   *  the result screen's MVP. */
  readonly dealt: Record<HeroKind, number> = { arcane: 0, fire: 0, ice: 0, lightning: 0, poison: 0, wind: 0 };
  /** Which cells exist: the wall row from the start, then whatever the commander builds. */
  readonly open: boolean[] = Array.from({ length: SLOT_COUNT }, (_, s) => Math.floor(s / B.grid.cols) === WALL_ROW);
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  /** Whirlwinds of the wind vortex skill still turning. */
  vortices: Vortex[] = [];
  skills: SkillLevels = emptySkills();
  /** Milestone perks of the heroes' levels. */
  readonly perks: ReadonlySet<PerkId>;
  /** Every command applied, with its tick: with the seed and the setup, the replay. */
  readonly commands: Stamped[] = [];
  // The battle's own from here on: open to the modules that step it (spawn.ts, hits.ts and the
  // rest), not to be touched from outside the sim; the view reads the events through drain().
  mods: Mods;
  fixed: Fixed;
  /** Shots per hero id, for the lightning sky strike and the wind gust. */
  readonly shotCount = new Map<number, number>();
  pending: Spawn[] = [];
  /** Enemies let out on the field this tick, brought on after the enemies have moved. */
  readonly hatch: { s: Spawn; x: number; y: number }[] = [];
  events: BattleEvent[] = [];
  /** The array drain() handed out last time, refilled after the next drain. */
  private drained: BattleEvent[] = [];
  /** The enemies reapDead() takes out, reused every step. */
  readonly dead: Enemy[] = [];
  nextId = 1;
  private offerFocus: HeroKind | undefined;

  /** The stage and the upgrades bought between battles. */
  constructor(
    readonly seed: number,
    readonly setup: BattleSetup = BASE_SETUP,
  ) {
    this.enemyRng = new Prng(seed);
    this.summonRng = new Prng(seed ^ STREAM.summon);
    this.shotRng = new Prng(seed ^ STREAM.shot);
    this.cardRng = new Prng(seed ^ STREAM.card);
    this.perks = perksFor(setup.heroLevels);
    this.mods = mods(this.skills, this.perks);
    this.fixed = fixedMods(this.mods, setup);
    this.gold = setup.startGold;
    this.wallMax = this.wall = toFp(setup.wallHp);
    startWave(this, 1);
  }

  get paused(): boolean {
    return this.choices !== null || this.result !== null;
  }

  /** Seconds played. */
  get seconds(): number {
    return this.time / TICK_RATE;
  }

  /** 1, plus one per cell built. */
  get commanderLevel(): number {
    return 1 + this.built;
  }

  /** The skill the commander casts next. */
  get nextCast(): CommanderSkill {
    return this.casts % 2 === 0 ? 'bomb' : 'brew';
  }

  canCast(): boolean {
    return !this.paused && this.charge >= C.charge;
  }

  isOpen(slot: number): boolean {
    return slot >= 0 && slot < SLOT_COUNT && this.open[slot];
  }

  /** Summons still needed before the commander builds the next cell, or null once all are built. */
  summonsToNextCell(): number | null {
    if (this.built >= C.extraCells) return null;
    return C.summonsPerCell - (this.summons % C.summonsPerCell);
  }

  /** The wall's front edge above x, both in FP: every built cell makes its column of the wall
   *  one cell thicker, so the front is the top of the column's outermost cell, less the parapet. */
  wallFront(x: number): number {
    const g = B.grid;
    const col = Math.min(g.cols - 1, Math.max(0, Math.floor((x - K.x0) / K.cellW)));
    let row = WALL_ROW;
    while (row > 0 && this.open[(row - 1) * g.cols + col]) row--;
    return toFp(g.y0 + g.cellH * row - B.field.parapet);
  }

  /** Closed cells standing on an open one: new cells always join on top of what is built. */
  buildable(): number[] {
    const cols = B.grid.cols;
    return this.open.flatMap((o, s) => (!o && s + cols < SLOT_COUNT && this.open[s + cols] ? [s] : []));
  }

  /** Open slots with nobody on them. */
  freeSlots(): number[] {
    return this.slots.flatMap((h, i) => (h || !this.isOpen(i) ? [] : [i]));
  }

  /** Rises a little faster with every summon, rounded to 5. */
  summonCost(): number {
    const n = this.summons;
    const cost = (B.summonCostBase + B.summonCostStep * n + B.summonCostSquare * n * n) * (this.setup.modifiers?.summonCost ?? 1);
    return Math.round(cost / 5) * 5;
  }

  upgradeCost(): number {
    const U = B.upgrade;
    const n = this.upgrades;
    return n < U.costs.length ? U.costs[n] : U.costs[U.costs.length - 1] + U.costStep * (n - U.costs.length + 1);
  }

  canSummon(): boolean {
    return !this.paused && this.gold >= this.summonCost() && this.freeSlots().length > 0;
  }

  canUpgrade(): boolean {
    return !this.paused && this.gold >= this.upgradeCost();
  }

  canMerge(from: number, to: number): boolean {
    const a = this.slots[from];
    const b = this.slots[to];
    return from !== to && !!a && !!b && a.kind === b.kind && a.star === b.star && a.star < B.maxStar;
  }

  canReroll(): boolean {
    return this.choices !== null && !this.rerolled;
  }

  /** Where all the dice stand: a command that rolled any of them changed the battle. */
  private dice(): string {
    return `${this.enemyRng.peek()} ${this.summonRng.peek()} ${this.shotRng.peek()} ${this.cardRng.peek()}`;
  }

  /** Runs a player command on this tick; whether it did anything. A command that changed the
   *  state (or rolled the dice) is kept in `commands`, stamped with the tick. */
  apply(cmd: Command): boolean {
    const dice = this.dice();
    let done: boolean;
    switch (cmd.type) {
      case 'summon':
        done = this.doSummon();
        break;
      case 'upgrade':
        done = this.doUpgrade();
        break;
      case 'move':
        done = this.doMove(cmd.from, cmd.to);
        break;
      case 'choose':
        done = this.doChoose(cmd.id);
        break;
      case 'reroll':
        done = this.doReroll();
        break;
      case 'noReroll':
        done = this.canReroll();
        if (done) this.rerolled = true;
        break;
      case 'revive':
        done = this.doRevive();
        break;
      case 'cast':
        done = doCast(this);
        break;
    }
    if (done || this.dice() !== dice) this.commands.push({ ...cmd, tick: this.time });
    return done;
  }

  /** A level-1 hero from the save's lineup on a random free cell; every few summons the commander
   *  builds a new cell onto the wall. */
  summon(): boolean {
    return this.apply({ type: 'summon' });
  }

  /** Spends gold on a skill offer; the battle pauses until one is chosen. */
  upgrade(): boolean {
    return this.apply({ type: 'upgrade' });
  }

  /** Drops the hero in `from` onto `to`: a move onto a free cell, or a merge into a random
   *  lineup hero one level up. Making an ultimate (top level) hero earns a skill offer for it. */
  move(from: number, to: number): boolean {
    return this.apply({ type: 'move', from, to });
  }

  /** Swaps the waiting offer for other cards, once per offer (the rewarded refresh). */
  reroll(): boolean {
    return this.apply({ type: 'reroll' });
  }

  choose(id: SkillId): boolean {
    return this.apply({ type: 'choose', id });
  }

  /** Casts the commander's next skill once it is charged. */
  cast(): boolean {
    return this.apply({ type: 'cast' });
  }

  /** Puts the wall back up after a lost battle (the rewarded revive). */
  revive(): boolean {
    return this.apply({ type: 'revive' });
  }

  private doSummon(): boolean {
    if (!this.canSummon()) return false;
    this.gold -= this.summonCost();
    const slot = pick(this.summonRng, this.freeSlots());
    this.summons++;
    this.slots[slot] = { id: this.nextId++, kind: pick(this.summonRng, this.setup.lineup), star: 1, slot, cooldown: K.summonCooldown };
    this.events.push({ type: 'summon', slot });
    if (this.summons % C.summonsPerCell === 0 && this.built < C.extraCells) {
      const cell = pick(this.summonRng, this.buildable());
      this.open[cell] = true;
      this.built++;
      this.events.push({ type: 'cellOpen', slot: cell, last: this.built === C.extraCells });
    }
    return true;
  }

  private doUpgrade(): boolean {
    if (!this.canUpgrade()) return false;
    const cost = this.upgradeCost();
    if (!this.offer('upgrade')) return false;
    this.gold -= cost;
    this.upgrades++;
    return true;
  }

  private doMove(from: number, to: number): boolean {
    const a = this.slots[from];
    if (this.paused || !a || from === to || !this.isOpen(to)) return false;
    if (!this.slots[to]) {
      this.slots[to] = { ...a, slot: to };
      this.slots[from] = null;
      return true;
    }
    if (!this.canMerge(from, to)) return false;
    const star = a.star + 1;
    // the merged hero is a new one: its sky-strike count starts over
    this.shotCount.delete(a.id);
    this.shotCount.delete(this.slots[to]!.id);
    this.slots[from] = null;
    const kind = pick(this.summonRng, this.setup.lineup);
    this.slots[to] = { id: this.nextId++, kind, star, slot: to, cooldown: K.summonCooldown };
    this.events.push({ type: 'merge', slot: to, star, kind });
    if (star === B.maxStar) this.offer('ultimate', kind);
    return true;
  }

  private doReroll(): boolean {
    if (!this.canReroll()) return false;
    this.choices = this.roll(this.offerFocus, this.choices ?? []);
    this.rerolled = true;
    return true;
  }

  private doChoose(id: SkillId): boolean {
    if (!this.choices?.includes(id)) return false;
    this.skills[id]++;
    if (id === 'wallRepair') {
      this.wallMax = times(this.wallMax, 1000 + pm(B.skills.wallMax));
      this.wall = Math.min(this.wallMax, this.wall + times(this.wallMax, pm(B.skills.wallRepair)));
    }
    this.mods = mods(this.skills, this.perks);
    this.fixed = fixedMods(this.mods, this.setup);
    this.choices = null;
    return true;
  }

  /** The wall comes back whole and the alchemist full, so the bomb is ready for the next wave:
   *  with half a wall and no charge a revive saved far fewer early runs than the plain attack did. */
  private doRevive(): boolean {
    if (this.result !== 'lost') return false;
    this.wall = this.wallMax;
    this.enemies = this.enemies.filter((e) => isBoss(e.kind));
    this.charge = C.charge;
    this.chargedFor = 0;
    this.result = null;
    return true;
  }

  /** Events since the last drain, oldest first. The array is reused: it is valid until the
   *  next drain, so a caller that keeps it longer copies it. */
  drain(): BattleEvent[] {
    const out = this.events;
    this.events = this.drained;
    this.events.length = 0;
    this.drained = out;
    return out;
  }

  /** One tick, 1 / TICK_RATE of a second; nothing while paused. */
  step(): void {
    if (this.paused) return;
    this.time++;
    for (const e of this.enemies) {
      e.px = e.x;
      e.py = e.y;
    }
    for (const p of this.projectiles) {
      p.px = p.x;
      p.py = p.y;
    }
    stepWaves(this);
    stepEnemies(this);
    stepHeroes(this);
    stepCommander(this);
    stepFlasks(this);
    stepProjectiles(this);
    reapDead(this);
    if (this.wall <= 0) this.end(false);
    else if (!this.setup.endless && this.wave === B.waves.count && this.pending.length === 0 && this.enemies.length === 0) this.end(true);
  }

  private end(won: boolean): void {
    this.result = won ? 'won' : 'lost';
    this.events.push({ type: 'end', won });
  }

  /** Opens a skill offer (the battle pauses); false when there is nothing left to offer. */
  private offer(reason: OfferReason, focus?: HeroKind): boolean {
    const offer = this.roll(focus);
    if (offer.length === 0) return false;
    this.choices = offer;
    this.choiceReason = reason;
    this.offerFocus = focus;
    this.rerolled = false;
    this.events.push({ type: 'offer', reason });
    return true;
  }

  private roll(focus?: HeroKind, exclude: readonly SkillId[] = []): SkillId[] {
    const fielded = new Set(this.slots.flatMap((h) => (h ? [h.kind] : [])));
    return rollChoices(this.cardRng, this.skills, fielded, this.setup.heroLevels, focus, exclude, this.setup.modifiers?.banned);
  }
}
