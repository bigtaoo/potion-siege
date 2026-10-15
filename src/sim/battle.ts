// One battle: the wall, the heroes on it, the waves and the skill picks. Pure logic, no drawing;
// the view reads the state and the events each frame and only calls the player commands
// (summon, move, upgrade, choose).

import { Rng } from './rng';
import { emptySkills, mods, rollChoices, type Mods, type SkillId, type SkillLevels } from './skills';
import { BALANCE, LINEUP, type BattleEvent, type Enemy, type Hero, type HeroKind, type OfferReason, type Projectile } from './types';
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
  gold = B.startGold;
  wallMax = B.wallHp;
  wall = B.wallHp;
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
  result: 'won' | 'lost' | null = null;
  readonly slots: (Hero | null)[] = new Array(SLOT_COUNT).fill(null);
  /** Which cells exist: the wall row from the start, then whatever the commander builds. */
  readonly open: boolean[] = Array.from({ length: SLOT_COUNT }, (_, s) => Math.floor(s / B.grid.cols) === WALL_ROW);
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  skills: SkillLevels = emptySkills();
  private mods: Mods = mods(this.skills);
  private pending: Spawn[] = [];
  private events: BattleEvent[] = [];
  private nextId = 1;

  constructor(seed: number) {
    this.rng = new Rng(seed);
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

  /** A level-1 hero from the lineup on a random free cell; every few summons the commander
   *  builds a new cell onto the wall. */
  summon(): boolean {
    if (!this.canSummon()) return false;
    this.gold -= this.summonCost();
    const slot = this.rng.pick(this.freeSlots());
    this.summons++;
    this.slots[slot] = { id: this.nextId++, kind: this.rng.pick(LINEUP), star: 1, slot, cooldown: 0.2 };
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
    this.slots[from] = null;
    const kind = this.rng.pick(LINEUP);
    this.slots[to] = { id: this.nextId++, kind, star, slot: to, cooldown: 0.2 };
    this.events.push({ type: 'merge', slot: to, star });
    if (star === B.maxStar) this.offer('ultimate', kind);
    return true;
  }

  choose(id: SkillId): void {
    if (!this.choices?.includes(id)) return;
    this.skills[id]++;
    if (id === 'wallRepair') {
      this.wallMax *= 1 + B.skills.wallMax;
      this.wall = Math.min(this.wallMax, this.wall + this.wallMax * B.skills.wallRepair);
    }
    this.mods = mods(this.skills);
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
    this.pending = planWave(wave, this.rng);
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
    this.enemies.push({
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
      atWall: false,
    });
  }

  private stepEnemies(dt: number): void {
    let hitWall = false;
    for (const e of this.enemies) {
      if (e.poisonTime > 0) {
        e.hp -= e.poisonDps * Math.min(dt, e.poisonTime);
        e.poisonTime -= dt;
        if (e.poisonTime <= 0) e.poisonDps = 0;
      }
      e.slowTime = Math.max(0, e.slowTime - dt);
      if (e.freezeTime > 0) {
        e.freezeTime -= dt;
        continue;
      }
      const stop = B.field.wallY - e.radius;
      if (e.y < stop) {
        e.y = Math.min(stop, e.y + e.speed * (e.slowTime > 0 ? e.slowFactor : 1) * dt);
      } else {
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
        h.cooldown = 0;
        continue;
      }
      h.cooldown += B.heroes[h.kind].interval / B.starSpeed[h.star - 1];
      const shots = h.kind === 'slime' ? 1 + this.mods.extraArrows : 1;
      for (let i = 0; i < shots && i < targets.length; i++) this.fire(h, targets[i]);
    }
  }

  /** The commander shoots plain slime shots, harder with each level; only the all-hero skills
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
    this.shoot('slime', 1, C.x, C.y - 120, target, damage);
  }

  private fire(h: Hero, target: Enemy): void {
    const from = slotCenter(h.slot);
    this.events.push({ type: 'shot', slot: h.slot, projectile: this.nextId });
    this.shoot(h.kind, h.star, from.x, from.y - 40, target, B.heroes[h.kind].damage * B.starDamage[h.star - 1] * this.mods.damage(h.kind));
  }

  private shoot(kind: HeroKind, star: number, x: number, y: number, target: Enemy, base: number): void {
    const crit = this.rng.next() < this.mods.crit ? B.critMultiplier : 1;
    const damage = base * crit;
    this.projectiles.push({
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
    switch (p.kind) {
      case 'fire': {
        const radius = h.fire.splash * this.mods.fireRadius;
        for (const e of this.enemies) if (Math.hypot(e.x - p.tx, e.y - p.ty) <= radius + e.radius) e.hp -= p.damage;
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
          cur.hp -= damage;
          hit.add(cur.id);
          points.push({ x: cur.x, y: cur.y });
          damage *= h.lightning.chainFalloff;
          cur = this.nearest(cur, h.lightning.chainRange, hit);
        }
        this.events.push({ type: 'chain', points });
        return;
      }
    }
    if (!target) return;
    target.hp -= p.damage;
    if (p.kind === 'ice') {
      target.slowFactor = 1 - h.ice.slow;
      target.slowTime = h.ice.slowTime;
      if (target.kind !== 'boss' && this.rng.next() < this.mods.freezeChance) target.freezeTime = B.skills.iceFreezeTime;
    } else if (p.kind === 'poison') {
      const dps = h.poison.poisonDps * B.starDamage[p.star - 1] * this.mods.damage('poison');
      target.poisonDps = Math.max(target.poisonDps, dps);
      target.poisonTime = h.poison.poisonTime;
    }
    this.events.push({ type: 'hit', kind: p.kind, x: target.x, y: target.y, radius: 30 });
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
      if (this.mods.poisonSpread && e.poisonTime > 0) {
        for (const o of this.enemies) {
          if (Math.hypot(o.x - e.x, o.y - e.y) > B.skills.poisonSpreadRadius) continue;
          o.poisonDps = Math.max(o.poisonDps, e.poisonDps);
          o.poisonTime = B.heroes.poison.poisonTime;
        }
      }
    }
  }

  /** Opens a skill offer (the battle pauses); false when there is nothing left to offer. */
  private offer(reason: OfferReason, focus?: HeroKind): boolean {
    const fielded = new Set(this.slots.flatMap((h) => (h ? [h.kind] : [])));
    const offer = rollChoices(this.rng, this.skills, fielded, focus);
    if (offer.length === 0) return false;
    this.choices = offer;
    this.choiceReason = reason;
    this.events.push({ type: 'offer', reason });
    return true;
  }
}
