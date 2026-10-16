// One battle: the wall, the heroes on it, the waves and the skill picks. Pure logic, no drawing;
// the view reads the state and the events each frame and sends the player's commands through
// apply() (summon, move, upgrade, choose, reroll, revive).
//
// It is deterministic: the state is all integers (see types.ts for the units), it steps at a
// fixed TICK_RATE, and its dice are one Prng. The same seed, setup and commands at the same
// ticks play the same battle on every engine (replay.ts), which determinismLint.test.ts and
// replay.test.ts hold it to.

import { resist } from './enemies';
import { dist, dist2, FP, muldiv, perTick, TICK_RATE, ticks, toFp } from './math/fixed';
import { pick } from './math/pick';
import { Prng } from './math/prng';
import { BRAD_FULL, sinB, TRIG_ONE } from './math/trig';
import { BASE_SETUP, type BattleSetup } from './meta';
import { emptySkills, mods, perksFor, rollChoices, type Mods, type PerkId, type SkillId, type SkillLevels } from './skills';
import { BALANCE, type BattleEvent, type Enemy, type EnemyKind, type Hero, type HeroKind, type OfferReason, type Projectile, type Vortex } from './types';
import { isBossWave, planWave, type Spawn } from './waves';

const B = BALANCE;
export const SLOT_COUNT = B.grid.cols * B.grid.rows;

/** A slot's centre in world units. */
export function slotCenter(slot: number): { x: number; y: number } {
  const g = B.grid;
  return { x: g.x0 + g.cellW * ((slot % g.cols) + 0.5), y: g.y0 + g.cellH * (Math.floor(slot / g.cols) + 0.5) };
}

/** The bottom row of the grid is the wall itself; the rows above are built onto it. */
export const WALL_ROW = B.grid.rows - 1;

const C = B.commander;

/** A multiplier or chance in permille, for configuration values. */
export function pm(x: number): number {
  return Math.round(x * 1000);
}

/** `v` times a permille multiplier, truncated. */
function times(v: number, permille: number): number {
  return muldiv(v, permille, 1000);
}

/** Seconds as thousandths of a tick, the unit of the shot cooldowns. */
function cool(seconds: number): number {
  return Math.round(seconds * TICK_RATE * 1000);
}

/** World units to FP of the configuration, worked out once. */
const K = {
  reach: perTick(B.projectileSpeed),
  left: toFp(B.field.left),
  right: toFp(B.field.right),
  top: toFp(B.field.top),
  x0: toFp(B.grid.x0),
  cellW: toFp(B.grid.cellW),
  summonCooldown: cool(0.2),
  idleCooldown: cool(0.07),
  commanderInterval: cool(C.interval),
  /** Each hero kind's shot interval at each level. */
  interval: Object.fromEntries(Object.entries(B.heroes).map(([k, h]) => [k, B.starSpeed.map((s) => Math.round((h.interval * TICK_RATE * 1000) / s))])) as Record<HeroKind, number[]>,
  wallDps: Object.fromEntries(Object.entries(B.enemies).map(([k, e]) => [k, perTick(e.wallDps)])) as Record<EnemyKind, number>,
  weave: toFp(B.flyer.weave),
  /** The flyer's swing in brads a second, and the start of it per enemy id (2.399 radians). */
  weaveRate: Math.round((B.flyer.weaveRate * BRAD_FULL) / (2 * Math.PI)),
  weavePhase: Math.round((2.399 * BRAD_FULL) / (2 * Math.PI)),
  vortexPull: perTick(B.skills.vortexPull),
};

/** The skill and perk multipliers in integer form, worked out again on every pick. */
interface Fixed {
  /** The shot damage of each kind at each level, in FP. */
  damage: Record<HeroKind, number[]>;
  /** The poison a corrosion hit leaves at each level, in FP a second. */
  poison: number[];
  /** Thousandths of a tick off the cooldown per tick: every hero, and a wind hero. */
  speed: number;
  windSpeed: number;
  crit: number;
  fireRadius: number;
  burn: number;
  mark: number;
  freezeChance: number;
  freezeTime: number;
  static: number;
  plasmaBurn: number;
  rustStep: number;
  push: number;
}

function fixedMods(m: Mods, setup: BattleSetup): Fixed {
  const damage = {} as Record<HeroKind, number[]>;
  for (const [k, h] of Object.entries(B.heroes) as [HeroKind, { damage: number }][]) {
    damage[k] = B.starDamage.map((s) => Math.round(h.damage * s * m.damage(k) * setup.heroDamage[k] * FP));
  }
  const speed = pm(m.speed);
  return {
    damage,
    poison: B.starDamage.map((s) => Math.round(B.heroes.poison.poisonDps * s * m.damage('poison') * setup.heroDamage.poison * FP)),
    speed,
    windSpeed: times(speed, pm(m.windSpeed)),
    crit: pm(m.crit + (setup.modifiers?.crit ?? 0)),
    fireRadius: Math.round(B.heroes.fire.splash * m.fireRadius * FP),
    burn: pm(m.burn),
    mark: pm(m.mark),
    freezeChance: pm(m.freezeChance),
    freezeTime: pm(m.freezeTime),
    static: pm(m.static),
    plasmaBurn: pm(Math.max(m.burn, B.skills.plasmaBurn)),
    rustStep: pm(m.rustStep),
    push: pm(m.push),
  };
}

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
  | { type: 'revive' };

/** A command and the tick it was applied on. */
export type Stamped = Command & { tick: number };

export class Battle {
  readonly rng: Prng;
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
  /** The commander below the wall shoots too, harder with every cell built. */
  commanderCooldown = cool(0.5);
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
  /** The damage each potion has dealt, overkill left out (the commander's is not counted), in FP:
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
  private mods: Mods;
  private fixed: Fixed;
  /** Shots per hero id, for the lightning sky strike and the wind gust. */
  private shotCount = new Map<number, number>();
  private pending: Spawn[] = [];
  private events: BattleEvent[] = [];
  /** The array drain() handed out last time, refilled after the next drain. */
  private drained: BattleEvent[] = [];
  /** The enemies reapDead() takes out, reused every step. */
  private readonly dead: Enemy[] = [];
  private nextId = 1;
  private offerFocus: HeroKind | undefined;

  /** The stage and the upgrades bought between battles. */
  constructor(
    readonly seed: number,
    readonly setup: BattleSetup = BASE_SETUP,
  ) {
    this.rng = new Prng(seed);
    this.perks = perksFor(setup.heroLevels);
    this.mods = mods(this.skills, this.perks);
    this.fixed = fixedMods(this.mods, setup);
    this.gold = setup.startGold;
    this.wallMax = this.wall = toFp(setup.wallHp);
    this.startWave(1);
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

  /** Runs a player command on this tick; whether it did anything. A command that changed the
   *  state (or rolled the dice) is kept in `commands`, stamped with the tick. */
  apply(cmd: Command): boolean {
    const dice = this.rng.peek();
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
    }
    if (done || this.rng.peek() !== dice) this.commands.push({ ...cmd, tick: this.time });
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

  /** Puts the wall back up after a lost battle (the rewarded revive). */
  revive(): boolean {
    return this.apply({ type: 'revive' });
  }

  private doSummon(): boolean {
    if (!this.canSummon()) return false;
    this.gold -= this.summonCost();
    const slot = pick(this.rng, this.freeSlots());
    this.summons++;
    this.slots[slot] = { id: this.nextId++, kind: pick(this.rng, this.setup.lineup), star: 1, slot, cooldown: K.summonCooldown };
    this.events.push({ type: 'summon', slot });
    if (this.summons % C.summonsPerCell === 0 && this.built < C.extraCells) {
      const cell = pick(this.rng, this.buildable());
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
    const kind = pick(this.rng, this.setup.lineup);
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

  private doRevive(): boolean {
    if (this.result !== 'lost') return false;
    this.wall = Math.trunc(this.wallMax / 2);
    this.enemies = this.enemies.filter((e) => e.kind === 'boss');
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
    this.stepWaves();
    this.stepEnemies();
    this.stepHeroes();
    this.stepCommander();
    this.stepProjectiles();
    this.reapDead();
    if (this.wall <= 0) this.end(false);
    else if (this.wave === B.waves.count && this.pending.length === 0 && this.enemies.length === 0) this.end(true);
  }

  private end(won: boolean): void {
    this.result = won ? 'won' : 'lost';
    this.events.push({ type: 'end', won });
  }

  private startWave(wave: number): void {
    this.wave = wave;
    this.waveTime = 0;
    const bossWaves = this.setup.modifiers?.bossWaves;
    this.pending = planWave(wave, this.rng, this.setup.stage, bossWaves).map((s) => ({ ...s, hp: Math.round(s.hp * this.setup.enemyHp) }));
    if (wave > 1) this.gold += Math.round(B.waves.waveBonusGold * (this.setup.modifiers?.waveGold ?? 1));
    this.events.push({ type: 'wave', wave, boss: isBossWave(wave, bossWaves) });
  }

  private stepWaves(): void {
    this.waveTime++;
    while (this.pending.length > 0 && this.pending[0].at <= this.waveTime) this.spawn(this.pending.shift()!);
    const w = B.waves;
    const bossAlive = this.enemies.some((e) => e.kind === 'boss');
    if (this.wave < w.count && this.pending.length === 0 && this.waveTime >= ticks(w.spawnWindow + w.gap) && !bossAlive) {
      this.startWave(this.wave + 1);
    }
  }

  private spawn(s: Spawn): void {
    const def = B.enemies[s.kind];
    const radius = toFp(def.radius);
    const id = this.nextId;
    const x = this.rng.range(K.left + radius, K.right - radius);
    const y = K.top - radius;
    const speed = times(times(perTick(def.speed), this.rng.range(900, 1100)), pm(this.setup.modifiers?.enemySpeed ?? 1));
    const e: Enemy = {
      id: this.nextId++,
      kind: s.kind,
      x,
      y,
      px: x,
      py: y,
      hp: s.hp,
      maxHp: s.hp,
      speed,
      radius,
      slowFactor: 1000,
      slowTime: 0,
      freezeTime: 0,
      poisonDps: 0,
      poisonTime: 0,
      rust: 0,
      rustTime: 0,
      burnDps: 0,
      burnTime: 0,
      scorch: 0,
      scorchTime: 0,
      markTime: 0,
      chill: 0,
      chillTime: 0,
      charge: 0,
      chargeTime: 0,
      pushTime: 0,
      atWall: false,
    };
    if (s.kind === 'flyer') {
      // its swing starts at a point set by its id, so the dice stay as they were before flyers
      e.x0 = Math.min(K.right - radius - K.weave, Math.max(K.left + radius + K.weave, e.x));
      e.phase = (id * K.weavePhase) % BRAD_FULL;
    }
    if (s.kind === 'winder') e.windTime = ticks(B.winder.every);
    this.enemies.push(e);
  }

  /** The y of the frontmost enemy that is not a winder, or -Infinity with none on the field. */
  private frontY(): number {
    let y = -Infinity;
    for (const e of this.enemies) if (e.kind !== 'winder' && e.hp > 0) y = Math.max(y, e.y);
    return y;
  }

  /** Whether `o` is within `range` (FP) of (x, y), counting its own radius. */
  private within(o: Enemy, x: number, y: number, range: number): boolean {
    const r = range + o.radius;
    return dist2(o.x - x, o.y - y) <= r * r;
  }

  /** A winder winds back the enemies around it: a share of their hit points back, and no more
   *  frost or slow on them (rust stays). The boss is too big for it. */
  private rewind(w: Enemy): void {
    const R = B.winder;
    for (const o of this.enemies) {
      if (o === w || o.hp <= 0 || o.kind === 'boss' || !this.within(o, w.x, w.y, toFp(R.range))) continue;
      o.hp = Math.min(o.maxHp, o.hp + times(o.maxHp, pm(R.heal)));
      o.freezeTime = 0;
      o.slowTime = 0;
      o.chill = 0;
      o.chillTime = 0;
    }
    this.events.push({ type: 'rewind', x: w.x / FP, y: w.y / FP, radius: R.range });
  }

  private stepEnemies(): void {
    let hitWall = false;
    const front = this.frontY();
    for (const v of this.vortices) v.time--;
    this.vortices = this.vortices.filter((v) => v.time > 0);
    for (const e of this.enemies) {
      if (e.poisonTime > 0) {
        this.harm(e, Math.trunc(e.poisonDps / TICK_RATE), 'poison');
        if (--e.poisonTime <= 0) e.poisonDps = 0;
      }
      if (e.burnTime > 0) {
        this.harm(e, Math.trunc(e.burnDps / TICK_RATE), e.burnBy);
        if (--e.burnTime <= 0) e.burnDps = 0;
      }
      e.scorchTime = Math.max(0, e.scorchTime - 1);
      e.markTime = Math.max(0, e.markTime - 1);
      e.rustTime = Math.max(0, e.rustTime - 1);
      if (e.rustTime <= 0) e.rust = 0;
      e.chargeTime = Math.max(0, e.chargeTime - 1);
      if (e.chargeTime <= 0) e.charge = 0;
      e.chillTime = Math.max(0, e.chillTime - 1);
      if (e.chillTime <= 0) e.chill = 0;
      e.slowTime = Math.max(0, e.slowTime - 1);
      e.pushTime = Math.max(0, e.pushTime - 1);
      if (e.freezeTime > 0) {
        e.freezeTime--;
        continue;
      }
      if (e.kind === 'flyer' && !e.atWall) {
        // weaves from side to side on the way down; at the wall it hovers where it stopped
        e.x = e.x0! + muldiv(K.weave, sinB(e.phase! + muldiv(this.time, K.weaveRate, TICK_RATE)), TRIG_ONE);
      }
      if (e.kind !== 'boss') for (const v of this.vortices) this.pull(e, v);
      if (e.kind === 'winder' && !e.atWall) {
        if (--e.windTime! <= 0) {
          e.windTime = ticks(B.winder.every);
          this.rewind(e);
        }
      }
      const wall = this.wallFront(e.x) - e.radius;
      // a winder keeps behind the crowd it winds, and waits for it
      const stop = e.kind === 'winder' && front > -Infinity ? Math.min(wall, Math.max(e.y, front - toFp(B.winder.gap))) : wall;
      if (e.y < stop) {
        e.y = Math.min(stop, e.y + (e.slowTime > 0 ? times(e.speed, e.slowFactor) : e.speed));
      } else if (e.y >= wall) {
        // a cell just built under it pushes it back to the new front
        e.y = wall;
        e.atWall = true;
        this.wall -= K.wallDps[e.kind];
        hitWall = true;
      }
    }
    if (hitWall) this.events.push({ type: 'wallHit' });
  }

  /** Alive enemies, front (closest to the wall) first. */
  private targets(): Enemy[] {
    return this.enemies.filter((e) => e.hp > 0).sort((a, b) => b.y - a.y);
  }

  private stepHeroes(): void {
    let targets: Enemy[] | null = null;
    for (const h of this.slots) {
      if (!h) continue;
      h.cooldown -= h.kind === 'wind' ? this.fixed.windSpeed : this.fixed.speed;
      if (h.cooldown > 0) continue;
      targets ??= this.targets();
      if (targets.length === 0) {
        // waiting: a small offset per hero, so the first enemy is not met by one big volley
        h.cooldown = (h.id % 5) * K.idleCooldown;
        continue;
      }
      h.cooldown += K.interval[h.kind][h.star - 1];
      if (h.kind === 'wind') {
        // the wind goes for what it can catch: the flying ornithopter and the winder's big key
        this.fire(h, targets.find((e) => e.kind === 'flyer' || e.kind === 'winder') ?? targets[0]);
        continue;
      }
      const shots = h.kind === 'arcane' ? 1 + this.mods.extraArrows : 1;
      // the extra bolts of the arcane multishot go to the enemies behind, weaker
      for (let i = 0; i < shots && i < targets.length; i++) this.fire(h, targets[i], i === 0 ? 1000 : pm(B.skills.multiBolt));
    }
  }

  /** The commander shoots plain arcane bolts, harder with each level; only the all-hero skills
   *  (damage, speed, crit) apply to it. */
  private stepCommander(): void {
    this.commanderCooldown -= this.fixed.speed;
    if (this.commanderCooldown > 0) return;
    const target = this.targets()[0];
    if (!target) {
      this.commanderCooldown = 0;
      return;
    }
    this.commanderCooldown += K.commanderInterval;
    const damage = Math.round(C.damage * (1 + C.damageStep * (this.commanderLevel - 1)) * (1 + B.skills.allDamage * this.skills.allDamage) * FP);
    this.shoot('arcane', 1, toFp(C.x), toFp(C.y - 120), target, damage, { commander: true });
  }

  /** A hero's shot at `target`, `scale` permille of its damage. */
  private fire(h: Hero, target: Enemy, scale = 1000): void {
    const from = slotCenter(h.slot);
    this.events.push({ type: 'shot', slot: h.slot, projectile: this.nextId });
    let strike = false;
    let gust = false;
    if ((h.kind === 'lightning' && this.mods.thunder) || (h.kind === 'wind' && this.mods.gust)) {
      const n = (this.shotCount.get(h.id) ?? 0) + 1;
      this.shotCount.set(h.id, n);
      if (h.kind === 'lightning') strike = n % B.skills.thunderEvery === 0;
      else gust = n % B.skills.gustEvery === 0;
    }
    const base = times(this.fixed.damage[h.kind][h.star - 1], scale);
    this.shoot(h.kind, h.star, toFp(from.x), toFp(from.y - 40), target, base, strike ? { strike } : gust ? { gust } : {});
  }

  private shoot(kind: HeroKind, star: number, x: number, y: number, target: Enemy, base: number, extra: Partial<Projectile> = {}): void {
    const crit = this.rng.chance(this.fixed.crit, 1000);
    this.projectiles.push({
      ...extra,
      id: this.nextId++,
      kind,
      star,
      x,
      y,
      px: x,
      py: y,
      targetId: target.id,
      tx: target.x,
      ty: target.y,
      damage: crit ? times(base, pm(B.critMultiplier)) : base,
    });
  }

  private stepProjectiles(): void {
    const reach = K.reach;
    const live: Projectile[] = [];
    for (const p of this.projectiles) {
      const t = this.enemies.find((e) => e.id === p.targetId && e.hp > 0);
      if (t) {
        p.tx = t.x;
        p.ty = t.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = dist(dx, dy);
      if (d <= reach) {
        this.impact(p, t ?? null);
      } else {
        p.x += muldiv(dx, reach, d);
        p.y += muldiv(dy, reach, d);
        live.push(p);
      }
    }
    this.projectiles = live;
  }

  private impact(p: Projectile, target: Enemy | null): void {
    const h = B.heroes;
    const S = B.skills;
    const by = p.commander ? undefined : p.kind;
    switch (p.kind) {
      case 'fire': {
        const radius = this.fixed.fireRadius;
        for (const e of this.enemies) {
          if (!this.within(e, p.tx, p.ty, radius)) continue;
          this.scorch(e, e.id === p.targetId ? p.damage : times(p.damage, this.splash(e)), by);
          this.discharge(e);
        }
        this.events.push({ type: 'hit', kind: 'fire', x: p.tx / FP, y: p.ty / FP, radius: radius / FP });
        return;
      }
      case 'lightning': {
        if (!target) return;
        const points = [{ x: p.x / FP, y: p.y / FP }];
        const hit = new Set<number>();
        let cur: Enemy | undefined = target;
        let damage = p.damage;
        for (let i = 0; cur && i <= h.lightning.chains + this.mods.extraChains; i++) {
          this.shock(cur, damage);
          hit.add(cur.id);
          points.push({ x: cur.x / FP, y: cur.y / FP });
          damage = times(damage, pm(h.lightning.chainFalloff));
          cur = this.nearest(cur, toFp(h.lightning.chainRange), hit);
        }
        this.events.push({ type: 'chain', points });
        if (p.strike) {
          // the sky strike: a bolt from above onto the first target, hitting all around it
          const radius = toFp(S.thunderRadius);
          for (const e of this.enemies) {
            if (e.hp > 0 && this.within(e, target.x, target.y, radius)) this.shock(e, times(p.damage, pm(S.thunderstrike)));
          }
          const x = target.x / FP;
          const y = target.y / FP;
          this.events.push({ type: 'chain', points: [{ x: x + 40, y: y - 700 }, { x: x - 20, y: y - 350 }, { x, y }] });
          this.events.push({ type: 'hit', kind: 'lightning', x, y, radius: S.thunderRadius });
        }
        return;
      }
      case 'wind': {
        if (!p.gust) break;
        // the gust: a wall of wind across the whole field, as deep as the target's front and back
        const depth = toFp(S.gustDepth);
        for (const e of this.enemies) {
          if (e.hp <= 0 || Math.abs(e.y - p.ty) > depth + e.radius) continue;
          this.harm(e, times(p.damage, pm(S.gust)), by);
          this.discharge(e);
          this.windHit(e, p, e.id === p.targetId);
        }
        this.events.push({ type: 'gust', x: p.tx / FP, y: p.ty / FP, depth: S.gustDepth });
        return;
      }
    }
    if (!target) return;
    this.harm(target, p.damage, by);
    this.discharge(target);
    if (p.kind === 'arcane' && !p.commander) this.arcaneHit(p, target);
    if (p.kind === 'ice') {
      this.slow(target, h.ice.slow, ticks(h.ice.slowTime));
      if (this.rng.chance(this.fixed.freezeChance, 1000)) this.freeze(target, S.iceFreezeTime, p.damage);
      if (this.mods.frostbite && target.freezeTime <= 0) {
        // no stacking while it is frozen anyway
        target.chillTime = ticks(S.frostbiteTime);
        if (++target.chill >= S.frostbiteStacks) {
          target.chill = 0;
          this.freeze(target, S.frostbiteFreeze, p.damage);
        }
      }
    } else if (p.kind === 'poison') {
      const dps = this.fixed.poison[p.star - 1];
      this.corrode(target, dps);
      if (this.mods.acidSplash) {
        // the acid splashes: poison and rust on everything close to the target
        const radius = toFp(S.acidRadius);
        for (const e of this.enemies) {
          if (e !== target && e.hp > 0 && this.within(e, target.x, target.y, radius)) this.corrode(e, times(dps, this.splash(e)));
        }
        this.events.push({ type: 'hit', kind: 'poison', x: target.x / FP, y: target.y / FP, radius: S.acidRadius });
      }
    }
    if (p.kind === 'wind') this.windHit(target, p, true);
    this.events.push({ type: 'hit', kind: p.kind, x: target.x / FP, y: target.y / FP, radius: 30 });
  }

  /** What a wind shot (or its gust) does to `e` after the damage: the knockback, and the wind
   *  line's skills. `direct` is the one it was aimed at. */
  private windHit(e: Enemy, p: Projectile, direct: boolean): void {
    const S = B.skills;
    if (!p.commander) this.push(e, p.star);
    if (p.commander) return;
    if (this.mods.vortex && direct && e.hp <= 0) this.vortices.push({ x: e.x, y: e.y, time: ticks(S.vortexTime) });
    if (this.mods.windFire && (e.burnTime > 0 || e.scorchTime > 0)) {
      // the wind-and-fire recipe: the wind fans the flames on what it hits and blows them onto
      // everything close by
      const heat = Math.max(e.burnDps, times(e.scorch, pm(S.windFire)));
      const radius = toFp(S.windFireRadius);
      for (const o of this.enemies) {
        if (o.hp <= 0 || !this.within(o, e.x, e.y, radius)) continue;
        if (heat >= o.burnDps) {
          o.burnDps = heat;
          o.burnBy = 'wind';
        }
        o.burnTime = ticks(S.burnTime);
      }
      this.events.push({ type: 'hit', kind: 'fire', x: e.x / FP, y: e.y / FP, radius: S.windFireRadius });
    }
  }

  /** Knocks `e` back up the field, off the wall if it was at it: lighter ones further, the boiler
   *  golem half as far (all the way with the perk, or frozen stiff), the boss not at all (the
   *  wind only slows it). Each one at most once every `pushTime`. A winder blown back also has
   *  its key spun the wrong way: its rewind starts over. */
  private push(e: Enemy, star: number): void {
    const W = B.heroes.wind;
    if (e.kind === 'boss') {
      this.slow(e, W.bossSlow, ticks(W.bossSlowTime));
      return;
    }
    if (e.pushTime > 0 || e.hp <= 0) return;
    let weight = W.weight[e.kind];
    if (e.kind === 'brute' && (this.mods.pushHeavy || e.freezeTime > 0)) weight = W.weight.grunt;
    const d = times(times(times(toFp(W.push), pm(W.pushStar[star - 1])), this.fixed.push), pm(weight));
    const top = K.top - e.radius;
    if (d <= 0) return;
    e.pushTime = ticks(W.pushTime);
    this.events.push({ type: 'push', x: e.x / FP, y: e.y / FP, id: e.id });
    e.y = Math.max(top, e.y - d);
    e.atWall = false;
    if (e.kind === 'winder') e.windTime = ticks(B.winder.every);
  }

  /** A whirlwind draws `e` towards its eye while it is within reach. */
  private pull(e: Enemy, v: Vortex): void {
    const dx = v.x - e.x;
    const dy = v.y - e.y;
    const d = dist(dx, dy);
    if (d < FP || d > toFp(B.skills.vortexRadius) + e.radius) return;
    const step = Math.min(d, K.vortexPull);
    if (e.kind === 'flyer') e.x0! += muldiv(dx, step, d);
    else e.x += muldiv(dx, step, d);
    e.y += muldiv(dy, step, d);
  }

  /** What the arcane line adds to a hero's bolt that has just hit. */
  private arcaneHit(p: Projectile, target: Enemy): void {
    const S = B.skills;
    if (this.fixed.mark > 0) target.markTime = ticks(S.markTime);
    if (this.mods.frostBolts) this.slow(target, S.frostBoltSlow, ticks(S.frostBoltTime));
    if (this.mods.burstBolts) {
      // the fire-and-arcane recipe: the bolt bursts and singes what stands around its target
      const radius = toFp(S.burstBoltRadius);
      for (const e of this.enemies) {
        if (e === target || e.hp <= 0 || !this.within(e, target.x, target.y, radius)) continue;
        this.scorch(e, times(times(p.damage, pm(S.burstBolt)), this.splash(e)), 'arcane');
        this.discharge(e);
      }
      this.events.push({ type: 'hit', kind: 'fire', x: target.x / FP, y: target.y / FP, radius: S.burstBoltRadius });
    }
    if (this.mods.splitBolts && !p.split && target.hp <= 0) {
      // the bolt that killed splits towards the nearest enemies left
      const skip = new Set([target.id]);
      for (let i = 0; i < S.splitBolts; i++) {
        const next = this.nearest(target, toFp(S.splitRange), skip);
        if (!next) break;
        skip.add(next.id);
        const { x, y } = target;
        this.projectiles.push({ id: this.nextId++, kind: 'arcane', star: p.star, x, y, px: x, py: y, targetId: next.id, tx: next.x, ty: next.y, damage: times(p.damage, pm(S.splitBolt)), split: true });
      }
    }
  }

  /** What a blast aimed at something else does to `e`, in permille: a flyer is up in the air,
   *  above most of it. */
  private splash(e: Enemy): number {
    return e.kind === 'flyer' ? pm(B.flyer.splash) : 1000;
  }

  /** Every bit of damage goes through here, for the enemy's resistance to the potion it came
   *  from (`by`; the commander's shots have none), the arcane mark and the corrosion's rust (all
   *  multiply), and for crediting that potion with what the enemy had left of it. */
  private harm(e: Enemy, damage: number, by: HeroKind | undefined): void {
    let dealt = by ? times(damage, pm(resist(e.kind, by))) : damage;
    if (e.markTime > 0) dealt = times(dealt, 1000 + this.fixed.mark);
    dealt = times(dealt, 1000 + this.fixed.rustStep * e.rust);
    if (by) this.dealt[by] += Math.max(0, Math.min(e.hp, dealt));
    e.hp -= dealt;
  }

  /** A hit by another potion sets off the static a lightning hit left. */
  private discharge(e: Enemy): void {
    if (e.charge <= 0) return;
    const charge = e.charge;
    e.charge = 0;
    e.chargeTime = 0;
    this.harm(e, charge, 'lightning');
  }

  /** Lightning damage: harder on chilled enemies with the ice recipe, leaving static, and with
   *  the fire recipe it counts as a fire hit that sets them alight. */
  private shock(e: Enemy, damage: number): void {
    const S = B.skills;
    if (this.mods.superconduct && (e.slowTime > 0 || e.freezeTime > 0)) damage = times(damage, 1000 + pm(S.superconduct));
    if (this.mods.plasma) this.scorch(e, damage, 'lightning', this.fixed.plasmaBurn);
    else this.harm(e, damage, 'lightning');
    if (this.mods.electrolysis) this.corrode(e);
    if (this.fixed.static > 0) {
      e.charge = Math.max(e.chargeTime > 0 ? e.charge : 0, times(damage, this.fixed.static));
      e.chargeTime = ticks(S.staticTime);
    }
  }

  /** Rusts by `stacks` and, with `dps` (FP a second), poisons: what a corrosion hit does. */
  private corrode(e: Enemy, dps = 0, stacks = 1): void {
    const P = B.heroes.poison;
    if (dps > 0) {
      e.poisonDps = Math.max(e.poisonDps, dps);
      e.poisonTime = ticks(P.poisonTime);
    }
    e.rust = Math.min(this.mods.rustMax, e.rust + stacks);
    e.rustTime = ticks(P.rustTime);
  }

  /** Slows by `amount` (a fraction) for `time` ticks. A weaker slow leaves a stronger one still
   *  running alone (it must not stretch it); a stronger one replaces it with its own time; the
   *  same one refreshes it. */
  private slow(e: Enemy, amount: number, time: number): void {
    const factor = 1000 - pm(amount);
    if (e.slowTime > 0) {
      if (factor > e.slowFactor) return;
      if (factor === e.slowFactor) {
        e.slowTime = Math.max(e.slowTime, time);
        return;
      }
    }
    e.slowFactor = factor;
    e.slowTime = time;
  }

  /** Freezes for `seconds`, for `hit`, the damage of the ice hit that froze it. A boss is too
   *  big to freeze: the frost slows it hard instead and, with shatter, chips shards off it. A
   *  flyer cannot freeze either, its wings keep beating: it only slows. */
  private freeze(e: Enemy, seconds: number, hit: number): void {
    const S = B.skills;
    const time = times(ticks(seconds), this.fixed.freezeTime);
    if (e.kind !== 'boss' && e.kind !== 'flyer') {
      e.freezeTime = Math.max(e.freezeTime, time);
      return;
    }
    this.slow(e, S.bossFreezeSlow, time);
    if (this.mods.shatter && e.kind === 'boss') {
      this.harm(e, times(hit, pm(S.bossShatter)), 'ice');
      this.events.push({ type: 'hit', kind: 'ice', x: e.x / FP, y: e.y / FP, radius: e.radius / FP });
    }
  }

  /** Fire damage: remembered for a while (a death soon after counts as burnt, for the chain
   *  explosion) and, with the burn skill (permille of the hit a second), it keeps burning. */
  private scorch(e: Enemy, damage: number, by: HeroKind | undefined, burn = this.fixed.burn): void {
    this.harm(e, damage, by);
    if (damage >= (e.scorchTime > 0 ? e.scorch : 0)) {
      e.scorch = damage;
      e.scorchBy = by;
    }
    e.scorchTime = ticks(B.skills.burnTime);
    if (burn > 0) {
      const dps = times(damage, burn);
      if (dps >= e.burnDps) {
        e.burnDps = dps;
        e.burnBy = by;
      }
      e.burnTime = ticks(B.skills.burnTime);
    }
  }

  private nearest(from: Enemy, range: number, skip: Set<number>): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = range * range;
    for (const e of this.enemies) {
      if (e.hp <= 0 || skip.has(e.id)) continue;
      const d = dist2(e.x - from.x, e.y - from.y);
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private reapDead(): void {
    if (!this.enemies.some((e) => e.hp <= 0)) return;
    // the living move up in place, in order; the dead go to a reused list
    const all = this.enemies;
    const dead = this.dead;
    let n = 0;
    for (const e of all) {
      if (e.hp > 0) all[n++] = e;
      else dead.push(e);
    }
    all.length = n;
    for (const e of dead) {
      const def = B.enemies[e.kind];
      const gold = Math.round((def.gold + this.mods.goldPerKill) * (this.setup.modifiers?.killGold ?? 1));
      this.gold += gold;
      this.kills++;
      this.events.push({ type: 'kill', kind: e.kind, x: e.x / FP, y: e.y / FP, gold, boss: e.kind === 'boss' });
      if (this.mods.fireChain && e.scorchTime > 0) {
        // burnt to death: it bursts once more (the blast itself does not count as fire, so it
        // cannot set off an endless chain)
        const radius = times(this.fixed.fireRadius, pm(B.skills.fireChainRadius));
        for (const o of this.enemies) if (this.within(o, e.x, e.y, radius)) this.harm(o, times(times(e.scorch, pm(B.skills.fireChain)), this.splash(o)), e.scorchBy);
        this.events.push({ type: 'hit', kind: 'fire', x: e.x / FP, y: e.y / FP, radius: radius / FP });
      }
      if (this.mods.melt && e.rust > 0) {
        // died rusted: it falls apart and its rust eats into what stands around it
        const radius = toFp(B.skills.meltRadius);
        for (const o of this.enemies) if (this.within(o, e.x, e.y, radius)) this.corrode(o, 0, o.kind === 'flyer' ? Math.ceil(e.rust * B.flyer.splash) : e.rust);
        this.events.push({ type: 'hit', kind: 'poison', x: e.x / FP, y: e.y / FP, radius: B.skills.meltRadius });
      }
      if (this.mods.shatter && e.freezeTime > 0) {
        // died frozen: it shatters into shards that cut and chill what stands around it
        const radius = toFp(B.skills.shatterRadius);
        for (const o of this.enemies) {
          if (!this.within(o, e.x, e.y, radius)) continue;
          this.harm(o, times(times(e.maxHp, pm(B.skills.shatter)), this.splash(o)), 'ice');
          this.slow(o, B.heroes.ice.slow, ticks(B.heroes.ice.slowTime));
        }
        this.events.push({ type: 'hit', kind: 'ice', x: e.x / FP, y: e.y / FP, radius: B.skills.shatterRadius });
      }
    }
    dead.length = 0;
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
    return rollChoices(this.rng, this.skills, fielded, this.setup.heroLevels, focus, exclude, this.setup.modifiers?.banned);
  }
}
