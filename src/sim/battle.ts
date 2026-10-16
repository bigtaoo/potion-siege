// One battle: the wall, the heroes on it, the waves and the skill picks. Pure logic, no drawing;
// the view reads the state and the events each frame and only calls the player commands
// (summon, move, upgrade, choose).

import { resist } from './enemies';
import { BASE_SETUP, type BattleSetup } from './meta';
import { Rng } from './rng';
import { emptySkills, mods, perksFor, rollChoices, type Mods, type PerkId, type SkillId, type SkillLevels } from './skills';
import { BALANCE, type BattleEvent, type Enemy, type Hero, type HeroKind, type OfferReason, type Projectile } from './types';
import { isBossWave, planWave, type Spawn } from './waves';

const B = BALANCE;
export const SLOT_COUNT = B.grid.cols * B.grid.rows;

export function slotCenter(slot: number): { x: number; y: number } {
  const g = B.grid;
  return { x: g.x0 + g.cellW * ((slot % g.cols) + 0.5), y: g.y0 + g.cellH * (Math.floor(slot / g.cols) + 0.5) };
}

/** The bottom row of the grid is the wall itself; the rows above are built onto it. */
export const WALL_ROW = B.grid.rows - 1;

const C = B.commander;

export class Battle {
  readonly rng: Rng;
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
  commanderCooldown = 0.5;
  kills = 0;
  time = 0;
  /** The skill offer waiting for the player; the battle is paused while it is set. */
  choices: SkillId[] | null = null;
  choiceReason: OfferReason = 'upgrade';
  /** Whether the waiting offer has been rerolled already (once per offer). */
  rerolled = false;
  result: 'won' | 'lost' | null = null;
  readonly slots: (Hero | null)[] = new Array(SLOT_COUNT).fill(null);
  /** The damage of the shots each potion has fired this battle (the result screen's MVP). */
  /** The damage each potion has dealt, overkill left out (the commander's is not counted). */
  readonly dealt: Record<HeroKind, number> = { arcane: 0, fire: 0, ice: 0, lightning: 0, poison: 0 };
  /** Which cells exist: the wall row from the start, then whatever the commander builds. */
  readonly open: boolean[] = Array.from({ length: SLOT_COUNT }, (_, s) => Math.floor(s / B.grid.cols) === WALL_ROW);
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  skills: SkillLevels = emptySkills();
  /** Milestone perks of the heroes' levels. */
  readonly perks: ReadonlySet<PerkId>;
  private mods: Mods;
  /** Shots per hero id, for the lightning sky strike. */
  private shotCount = new Map<number, number>();
  private pending: Spawn[] = [];
  private events: BattleEvent[] = [];
  private nextId = 1;
  private offerFocus: HeroKind | undefined;

  /** The stage and the upgrades bought between battles. */
  constructor(
    seed: number,
    readonly setup: BattleSetup = BASE_SETUP,
  ) {
    this.rng = new Rng(seed);
    this.perks = perksFor(setup.heroLevels);
    this.mods = mods(this.skills, this.perks);
    this.gold = setup.startGold;
    this.wallMax = this.wall = setup.wallHp;
    this.startWave(1);
  }

  get paused(): boolean {
    return this.choices !== null || this.result !== null;
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

  /** The wall's front edge above x: every built cell makes its column of the wall one cell
   *  thicker, so the front is the top of the column's outermost cell, less the parapet. */
  wallFront(x: number): number {
    const g = B.grid;
    const col = Math.min(g.cols - 1, Math.max(0, Math.floor((x - g.x0) / g.cellW)));
    let row = WALL_ROW;
    while (row > 0 && this.open[(row - 1) * g.cols + col]) row--;
    return g.y0 + g.cellH * row - B.field.parapet;
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
    return Math.round((B.summonCostBase + B.summonCostStep * n + B.summonCostSquare * n * n) / 5) * 5;
  }

  upgradeCost(): number {
    const U = B.upgrade;
    const n = this.upgrades;
    return n < U.costs.length ? U.costs[n] : U.costs[U.costs.length - 1] + U.costStep * (n - U.costs.length + 1);
  }

  canSummon(): boolean {
    return !this.paused && this.gold >= this.summonCost() && this.freeSlots().length > 0;
  }

  /** A level-1 hero from the save's lineup on a random free cell; every few summons the commander
   *  builds a new cell onto the wall. */
  summon(): boolean {
    if (!this.canSummon()) return false;
    this.gold -= this.summonCost();
    const slot = this.rng.pick(this.freeSlots());
    this.summons++;
    this.slots[slot] = { id: this.nextId++, kind: this.rng.pick(this.setup.lineup), star: 1, slot, cooldown: 0.2 };
    this.events.push({ type: 'summon', slot });
    if (this.summons % C.summonsPerCell === 0 && this.built < C.extraCells) {
      const cell = this.rng.pick(this.buildable());
      this.open[cell] = true;
      this.built++;
      this.events.push({ type: 'cellOpen', slot: cell, last: this.built === C.extraCells });
    }
    return true;
  }

  canUpgrade(): boolean {
    return !this.paused && this.gold >= this.upgradeCost();
  }

  /** Spends gold on a skill offer; the battle pauses until one is chosen. */
  upgrade(): boolean {
    if (!this.canUpgrade()) return false;
    const cost = this.upgradeCost();
    if (!this.offer('upgrade')) return false;
    this.gold -= cost;
    this.upgrades++;
    return true;
  }

  canMerge(from: number, to: number): boolean {
    const a = this.slots[from];
    const b = this.slots[to];
    return from !== to && !!a && !!b && a.kind === b.kind && a.star === b.star && a.star < B.maxStar;
  }

  /** Drops the hero in `from` onto `to`: a move onto a free cell, or a merge into a random
   *  lineup hero one level up. Making an ultimate (top level) hero earns a skill offer for it. */
  move(from: number, to: number): boolean {
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
    const kind = this.rng.pick(this.setup.lineup);
    this.slots[to] = { id: this.nextId++, kind, star, slot: to, cooldown: 0.2 };
    this.events.push({ type: 'merge', slot: to, star });
    if (star === B.maxStar) this.offer('ultimate', kind);
    return true;
  }

  canReroll(): boolean {
    return this.choices !== null && !this.rerolled;
  }

  /** Swaps the waiting offer for other cards, once per offer (the rewarded refresh). */
  reroll(): boolean {
    if (!this.canReroll()) return false;
    this.choices = this.roll(this.offerFocus, this.choices ?? []);
    this.rerolled = true;
    return true;
  }

  choose(id: SkillId): void {
    if (!this.choices?.includes(id)) return;
    this.skills[id]++;
    if (id === 'wallRepair') {
      this.wallMax *= 1 + B.skills.wallMax;
      this.wall = Math.min(this.wallMax, this.wall + this.wallMax * B.skills.wallRepair);
    }
    this.mods = mods(this.skills, this.perks);
    this.choices = null;
  }

  /** Events since the last drain, oldest first. */
  drain(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  step(dt: number): void {
    if (this.paused) return;
    this.time += dt;
    this.stepWaves(dt);
    this.stepEnemies(dt);
    this.stepHeroes(dt);
    this.stepCommander(dt);
    this.stepProjectiles(dt);
    this.reapDead();
    if (this.wall <= 0) this.end(false);
    else if (this.wave === B.waves.count && this.pending.length === 0 && this.enemies.length === 0) this.end(true);
  }

  /** Puts the wall back up after a lost battle (the rewarded revive). */
  revive(): void {
    if (this.result !== 'lost') return;
    this.wall = this.wallMax * 0.5;
    this.enemies = this.enemies.filter((e) => e.kind === 'boss');
    this.result = null;
  }

  private end(won: boolean): void {
    this.result = won ? 'won' : 'lost';
    this.events.push({ type: 'end', won });
  }

  private startWave(wave: number): void {
    this.wave = wave;
    this.waveTime = 0;
    this.pending = planWave(wave, this.rng, this.setup.stage).map((s) => ({ ...s, hp: s.hp * this.setup.enemyHp }));
    if (wave > 1) this.gold += B.waves.waveBonusGold;
    this.events.push({ type: 'wave', wave, boss: isBossWave(wave) });
  }

  private stepWaves(dt: number): void {
    this.waveTime += dt;
    while (this.pending.length > 0 && this.pending[0].at <= this.waveTime) this.spawn(this.pending.shift()!);
    const w = B.waves;
    const bossAlive = this.enemies.some((e) => e.kind === 'boss');
    if (this.wave < w.count && this.pending.length === 0 && this.waveTime >= w.spawnWindow + w.gap && !bossAlive) {
      this.startWave(this.wave + 1);
    }
  }

  private spawn(s: Spawn): void {
    const def = B.enemies[s.kind];
    const f = B.field;
    const id = this.nextId;
    const e: Enemy = {
      id: this.nextId++,
      kind: s.kind,
      x: this.rng.range(f.left + def.radius, f.right - def.radius),
      y: f.top - def.radius,
      hp: s.hp,
      maxHp: s.hp,
      speed: def.speed * this.rng.range(0.9, 1.1),
      radius: def.radius,
      slowFactor: 1,
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
      atWall: false,
    };
    if (s.kind === 'flyer') {
      // its swing starts at a point set by its id, so the dice stay as they were before flyers
      const a = B.flyer.weave;
      e.x0 = Math.min(f.right - def.radius - a, Math.max(f.left + def.radius + a, e.x));
      e.phase = id * 2.399;
    }
    if (s.kind === 'winder') e.windTime = B.winder.every;
    this.enemies.push(e);
  }

  /** The y of the frontmost enemy that is not a winder, or -Infinity with none on the field. */
  private frontY(): number {
    let y = -Infinity;
    for (const e of this.enemies) if (e.kind !== 'winder' && e.hp > 0) y = Math.max(y, e.y);
    return y;
  }

  /** A winder winds back the enemies around it: a share of their hit points back, and no more
   *  frost or slow on them (rust stays). The boss is too big for it. */
  private rewind(w: Enemy): void {
    const R = B.winder;
    for (const o of this.enemies) {
      if (o === w || o.hp <= 0 || o.kind === 'boss' || Math.hypot(o.x - w.x, o.y - w.y) > R.range + o.radius) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * R.heal);
      o.freezeTime = 0;
      o.slowTime = 0;
      o.chill = 0;
      o.chillTime = 0;
    }
    this.events.push({ type: 'rewind', x: w.x, y: w.y, radius: R.range });
  }

  private stepEnemies(dt: number): void {
    let hitWall = false;
    const front = this.frontY();
    for (const e of this.enemies) {
      if (e.poisonTime > 0) {
        this.harm(e, e.poisonDps * Math.min(dt, e.poisonTime), 'poison');
        e.poisonTime -= dt;
        if (e.poisonTime <= 0) e.poisonDps = 0;
      }
      if (e.burnTime > 0) {
        this.harm(e, e.burnDps * Math.min(dt, e.burnTime), e.burnBy);
        e.burnTime -= dt;
        if (e.burnTime <= 0) e.burnDps = 0;
      }
      e.scorchTime = Math.max(0, e.scorchTime - dt);
      e.markTime = Math.max(0, e.markTime - dt);
      e.rustTime = Math.max(0, e.rustTime - dt);
      if (e.rustTime <= 0) e.rust = 0;
      e.chargeTime = Math.max(0, e.chargeTime - dt);
      if (e.chargeTime <= 0) e.charge = 0;
      e.chillTime = Math.max(0, e.chillTime - dt);
      if (e.chillTime <= 0) e.chill = 0;
      e.slowTime = Math.max(0, e.slowTime - dt);
      if (e.freezeTime > 0) {
        e.freezeTime -= dt;
        continue;
      }
      if (e.kind === 'flyer' && !e.atWall) {
        // weaves from side to side on the way down; at the wall it hovers where it stopped
        const f = B.flyer;
        e.x = e.x0! + f.weave * Math.sin(e.phase! + this.time * f.weaveRate);
      }
      if (e.kind === 'winder' && !e.atWall) {
        e.windTime! -= dt;
        if (e.windTime! <= 0) {
          e.windTime = B.winder.every;
          this.rewind(e);
        }
      }
      const wall = this.wallFront(e.x) - e.radius;
      // a winder keeps behind the crowd it winds, and waits for it
      const stop = e.kind === 'winder' && front > -Infinity ? Math.min(wall, Math.max(e.y, front - B.winder.gap)) : wall;
      if (e.y < stop) {
        e.y = Math.min(stop, e.y + e.speed * (e.slowTime > 0 ? e.slowFactor : 1) * dt);
      } else if (e.y >= wall) {
        // a cell just built under it pushes it back to the new front
        e.y = wall;
        e.atWall = true;
        this.wall -= B.enemies[e.kind].wallDps * dt;
        hitWall = true;
      }
    }
    if (hitWall) this.events.push({ type: 'wallHit' });
  }

  /** Alive enemies, front (closest to the wall) first. */
  private targets(): Enemy[] {
    return this.enemies.filter((e) => e.hp > 0).sort((a, b) => b.y - a.y);
  }

  private stepHeroes(dt: number): void {
    let targets: Enemy[] | null = null;
    for (const h of this.slots) {
      if (!h) continue;
      h.cooldown -= dt * this.mods.speed;
      if (h.cooldown > 0) continue;
      targets ??= this.targets();
      if (targets.length === 0) {
        // waiting: a small offset per hero, so the first enemy is not met by one big volley
        h.cooldown = (h.id % 5) * 0.07;
        continue;
      }
      h.cooldown += B.heroes[h.kind].interval / B.starSpeed[h.star - 1];
      const shots = h.kind === 'arcane' ? 1 + this.mods.extraArrows : 1;
      // the extra bolts of the arcane multishot go to the enemies behind, weaker
      for (let i = 0; i < shots && i < targets.length; i++) this.fire(h, targets[i], i === 0 ? 1 : B.skills.multiBolt);
    }
  }

  /** The commander shoots plain arcane bolts, harder with each level; only the all-hero skills
   *  (damage, speed, crit) apply to it. */
  private stepCommander(dt: number): void {
    this.commanderCooldown -= dt * this.mods.speed;
    if (this.commanderCooldown > 0) return;
    const target = this.targets()[0];
    if (!target) {
      this.commanderCooldown = 0;
      return;
    }
    this.commanderCooldown += C.interval;
    const damage = C.damage * (1 + C.damageStep * (this.commanderLevel - 1)) * (1 + B.skills.allDamage * this.skills.allDamage);
    this.shoot('arcane', 1, C.x, C.y - 120, target, damage, { commander: true });
  }

  private fire(h: Hero, target: Enemy, scale = 1): void {
    const from = slotCenter(h.slot);
    this.events.push({ type: 'shot', slot: h.slot, projectile: this.nextId });
    let strike = false;
    if (h.kind === 'lightning' && this.mods.thunder) {
      const n = (this.shotCount.get(h.id) ?? 0) + 1;
      this.shotCount.set(h.id, n);
      strike = n % B.skills.thunderEvery === 0;
    }
    const base = B.heroes[h.kind].damage * B.starDamage[h.star - 1] * this.mods.damage(h.kind) * this.setup.heroDamage[h.kind] * scale;
    this.shoot(h.kind, h.star, from.x, from.y - 40, target, base, strike ? { strike } : {});
  }

  private shoot(kind: HeroKind, star: number, x: number, y: number, target: Enemy, base: number, extra: Partial<Projectile> = {}): void {
    const crit = this.rng.next() < this.mods.crit ? B.critMultiplier : 1;
    const damage = base * crit;
    this.projectiles.push({
      ...extra,
      id: this.nextId++,
      kind,
      star,
      x,
      y,
      targetId: target.id,
      tx: target.x,
      ty: target.y,
      damage,
    });
  }

  private stepProjectiles(dt: number): void {
    const reach = B.projectileSpeed * dt;
    const live: Projectile[] = [];
    for (const p of this.projectiles) {
      const t = this.enemies.find((e) => e.id === p.targetId && e.hp > 0);
      if (t) {
        p.tx = t.x;
        p.ty = t.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= reach) {
        this.impact(p, t ?? null);
      } else {
        p.x += (dx / d) * reach;
        p.y += (dy / d) * reach;
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
        const radius = h.fire.splash * this.mods.fireRadius;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - p.tx, e.y - p.ty) > radius + e.radius) continue;
          this.scorch(e, p.damage * (e.id === p.targetId ? 1 : this.splash(e)), by);
          this.discharge(e);
        }
        this.events.push({ type: 'hit', kind: 'fire', x: p.tx, y: p.ty, radius });
        return;
      }
      case 'lightning': {
        if (!target) return;
        const points = [{ x: p.x, y: p.y }];
        const hit = new Set<number>();
        let cur: Enemy | undefined = target;
        let damage = p.damage;
        for (let i = 0; cur && i <= h.lightning.chains + this.mods.extraChains; i++) {
          this.shock(cur, damage);
          hit.add(cur.id);
          points.push({ x: cur.x, y: cur.y });
          damage *= h.lightning.chainFalloff;
          cur = this.nearest(cur, h.lightning.chainRange, hit);
        }
        this.events.push({ type: 'chain', points });
        if (p.strike) {
          // the sky strike: a bolt from above onto the first target, hitting all around it
          const radius = S.thunderRadius;
          for (const e of this.enemies) {
            if (e.hp > 0 && Math.hypot(e.x - target.x, e.y - target.y) <= radius + e.radius) this.shock(e, p.damage * S.thunderstrike);
          }
          this.events.push({ type: 'chain', points: [{ x: target.x + 40, y: target.y - 700 }, { x: target.x - 20, y: target.y - 350 }, { x: target.x, y: target.y }] });
          this.events.push({ type: 'hit', kind: 'lightning', x: target.x, y: target.y, radius });
        }
        return;
      }
    }
    if (!target) return;
    this.harm(target, p.damage, by);
    this.discharge(target);
    if (p.kind === 'arcane' && !p.commander) this.arcaneHit(p, target);
    if (p.kind === 'ice') {
      this.slow(target, h.ice.slow, h.ice.slowTime);
      if (this.rng.next() < this.mods.freezeChance) this.freeze(target, S.iceFreezeTime, p.damage);
      if (this.mods.frostbite && target.freezeTime <= 0) {
        // no stacking while it is frozen anyway
        target.chillTime = S.frostbiteTime;
        if (++target.chill >= S.frostbiteStacks) {
          target.chill = 0;
          this.freeze(target, S.frostbiteFreeze, p.damage);
        }
      }
    } else if (p.kind === 'poison') {
      const dps = h.poison.poisonDps * B.starDamage[p.star - 1] * this.mods.damage('poison') * this.setup.heroDamage.poison;
      this.corrode(target, dps);
      if (this.mods.acidSplash) {
        // the acid splashes: poison and rust on everything close to the target
        const radius = S.acidRadius;
        for (const e of this.enemies) {
          if (e !== target && e.hp > 0 && Math.hypot(e.x - target.x, e.y - target.y) <= radius + e.radius) this.corrode(e, dps * this.splash(e));
        }
        this.events.push({ type: 'hit', kind: 'poison', x: target.x, y: target.y, radius });
      }
    }
    this.events.push({ type: 'hit', kind: p.kind, x: target.x, y: target.y, radius: 30 });
  }

  /** What the arcane line adds to a hero's bolt that has just hit. */
  private arcaneHit(p: Projectile, target: Enemy): void {
    const S = B.skills;
    if (this.mods.mark > 0) target.markTime = S.markTime;
    if (this.mods.frostBolts) this.slow(target, S.frostBoltSlow, S.frostBoltTime);
    if (this.mods.burstBolts) {
      // the fire-and-arcane recipe: the bolt bursts and singes what stands around its target
      const radius = S.burstBoltRadius;
      for (const e of this.enemies) {
        if (e === target || e.hp <= 0 || Math.hypot(e.x - target.x, e.y - target.y) > radius + e.radius) continue;
        this.scorch(e, p.damage * S.burstBolt * this.splash(e), 'arcane');
        this.discharge(e);
      }
      this.events.push({ type: 'hit', kind: 'fire', x: target.x, y: target.y, radius });
    }
    if (this.mods.splitBolts && !p.split && target.hp <= 0) {
      // the bolt that killed splits towards the nearest enemies left
      const skip = new Set([target.id]);
      for (let i = 0; i < S.splitBolts; i++) {
        const next = this.nearest(target, S.splitRange, skip);
        if (!next) break;
        skip.add(next.id);
        this.projectiles.push({ id: this.nextId++, kind: 'arcane', star: p.star, x: target.x, y: target.y, targetId: next.id, tx: next.x, ty: next.y, damage: p.damage * S.splitBolt, split: true });
      }
    }
  }

  /** What a blast aimed at something else does to `e`: a flyer is up in the air, above most of it. */
  private splash(e: Enemy): number {
    return e.kind === 'flyer' ? B.flyer.splash : 1;
  }

  /** Every bit of damage goes through here, for the enemy's resistance to the potion it came
   *  from (`by`; the commander's shots have none), the arcane mark and the corrosion's rust (all
   *  multiply), and for crediting that potion with what the enemy had left of it. */
  private harm(e: Enemy, damage: number, by: HeroKind | undefined): void {
    let dealt = by ? damage * resist(e.kind, by) : damage;
    if (e.markTime > 0) dealt *= 1 + this.mods.mark;
    dealt *= 1 + this.mods.rustStep * e.rust;
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
    if (this.mods.superconduct && (e.slowTime > 0 || e.freezeTime > 0)) damage *= 1 + S.superconduct;
    if (this.mods.plasma) this.scorch(e, damage, 'lightning', Math.max(this.mods.burn, S.plasmaBurn));
    else this.harm(e, damage, 'lightning');
    if (this.mods.electrolysis) this.corrode(e);
    if (this.mods.static > 0) {
      e.charge = Math.max(e.chargeTime > 0 ? e.charge : 0, damage * this.mods.static);
      e.chargeTime = S.staticTime;
    }
  }

  /** Rusts by `stacks` and, with `dps`, poisons: what a corrosion hit does to an enemy. */
  private corrode(e: Enemy, dps = 0, stacks = 1): void {
    const P = B.heroes.poison;
    if (dps > 0) {
      e.poisonDps = Math.max(e.poisonDps, dps);
      e.poisonTime = P.poisonTime;
    }
    e.rust = Math.min(this.mods.rustMax, e.rust + stacks);
    e.rustTime = P.rustTime;
  }

  /** Slows. A weaker slow leaves a stronger one still running alone (it must not stretch it);
   *  a stronger one replaces it with its own time; the same one refreshes it. */
  private slow(e: Enemy, amount: number, time: number): void {
    const factor = 1 - amount;
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

  /** Freezes, for `hit`, the damage of the ice hit that froze it. A boss is too big to freeze:
   *  the frost slows it hard instead and, with shatter, chips shards off it. A flyer cannot
   *  freeze either, its wings keep beating: it only slows. */
  private freeze(e: Enemy, time: number, hit: number): void {
    const S = B.skills;
    if (e.kind !== 'boss' && e.kind !== 'flyer') {
      e.freezeTime = Math.max(e.freezeTime, time * this.mods.freezeTime);
      return;
    }
    this.slow(e, S.bossFreezeSlow, time * this.mods.freezeTime);
    if (this.mods.shatter && e.kind === 'boss') {
      this.harm(e, hit * S.bossShatter, 'ice');
      this.events.push({ type: 'hit', kind: 'ice', x: e.x, y: e.y, radius: e.radius });
    }
  }

  /** Fire damage: remembered for a while (a death soon after counts as burnt, for the chain
   *  explosion) and, with the burn skill, it keeps burning. */
  private scorch(e: Enemy, damage: number, by: HeroKind | undefined, burn = this.mods.burn): void {
    this.harm(e, damage, by);
    if (damage >= (e.scorchTime > 0 ? e.scorch : 0)) {
      e.scorch = damage;
      e.scorchBy = by;
    }
    e.scorchTime = B.skills.burnTime;
    if (burn > 0) {
      if (damage * burn >= e.burnDps) {
        e.burnDps = damage * burn;
        e.burnBy = by;
      }
      e.burnTime = B.skills.burnTime;
    }
  }

  private nearest(from: Enemy, range: number, skip: Set<number>): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.hp <= 0 || skip.has(e.id)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private reapDead(): void {
    if (!this.enemies.some((e) => e.hp <= 0)) return;
    const dead = this.enemies.filter((e) => e.hp <= 0);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const e of dead) {
      const def = B.enemies[e.kind];
      const gold = def.gold + this.mods.goldPerKill;
      this.gold += gold;
      this.kills++;
      this.events.push({ type: 'kill', x: e.x, y: e.y, gold, boss: e.kind === 'boss' });
      if (this.mods.fireChain && e.scorchTime > 0) {
        // burnt to death: it bursts once more (the blast itself does not count as fire, so it
        // cannot set off an endless chain)
        const radius = B.heroes.fire.splash * this.mods.fireRadius * B.skills.fireChainRadius;
        for (const o of this.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) <= radius + o.radius) this.harm(o, e.scorch * B.skills.fireChain * this.splash(o), e.scorchBy);
        this.events.push({ type: 'hit', kind: 'fire', x: e.x, y: e.y, radius });
      }
      if (this.mods.melt && e.rust > 0) {
        // died rusted: it falls apart and its rust eats into what stands around it
        const radius = B.skills.meltRadius;
        for (const o of this.enemies) if (Math.hypot(o.x - e.x, o.y - e.y) <= radius + o.radius) this.corrode(o, 0, o.kind === 'flyer' ? Math.ceil(e.rust * B.flyer.splash) : e.rust);
        this.events.push({ type: 'hit', kind: 'poison', x: e.x, y: e.y, radius });
      }
      if (this.mods.shatter && e.freezeTime > 0) {
        // died frozen: it shatters into shards that cut and chill what stands around it
        const radius = B.skills.shatterRadius;
        for (const o of this.enemies) {
          if (Math.hypot(o.x - e.x, o.y - e.y) > radius + o.radius) continue;
          this.harm(o, e.maxHp * B.skills.shatter * this.splash(o), 'ice');
          this.slow(o, B.heroes.ice.slow, B.heroes.ice.slowTime);
        }
        this.events.push({ type: 'hit', kind: 'ice', x: e.x, y: e.y, radius });
      }
    }
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
    return rollChoices(this.rng, this.skills, fielded, this.setup.heroLevels, focus, exclude);
  }
}
