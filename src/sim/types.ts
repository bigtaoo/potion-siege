import balanceJson from './balance.json';

export type Balance = typeof balanceJson;
export const BALANCE: Balance = balanceJson;

export const HERO_KINDS = ['arcane', 'fire', 'ice', 'lightning', 'poison', 'wind'] as const;
export type HeroKind = (typeof HERO_KINDS)[number];

/** The four heroes a new save brings into battle; the player can swap one for another unlocked
 *  potion (MetaSave.lineup), and every summon and merge rolls one of the four. */
export const LINEUP = BALANCE.lineup as readonly HeroKind[];

export type OfferReason = 'upgrade' | 'ultimate';

/** The clockwork army: the first four from stage 1, weakest first, then the two that join on
 *  later stages. */
export const ENEMY_KINDS = ['grunt', 'runner', 'brute', 'boss', 'flyer', 'winder'] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

export interface Hero {
  id: number;
  kind: HeroKind;
  /** 1-based level: 1-3 show as that many copies in the cell, 4 is the single ultimate hero. */
  star: number;
  /** Grid slot index (row * cols + col); the bottom row is the wall. */
  slot: number;
  /** Thousandths of a tick until the next shot (attack speed takes off a fraction of a tick). */
  cooldown: number;
}

// The battle state is all integers (src/sim/math/fixed.ts): positions, radii and hit points in
// FP units (1000 per world unit or hit point), speeds per tick, times in ticks at TICK_RATE,
// multipliers and chances in permille. The view divides by FP to draw. Events carry world units.


export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  /** Where it was before the last tick, for the view to draw in between. */
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  /** FP per tick. */
  speed: number;
  radius: number;
  /** Permille of its speed while slowTime > 0. */
  slowFactor: number;
  slowTime: number;
  freezeTime: number;
  /** FP hit points a second. */
  poisonDps: number;
  poisonTime: number;
  /** Rust stacks from corrosion hits: each one makes it take more damage from everything. They
   *  all wear off after rustTime without a new corrosion hit. */
  rust: number;
  rustTime: number;
  /** Burning from the fire skill, like poison (FP a second). */
  burnDps: number;
  burnTime: number;
  /** The potion whose fire set the burn going, credited with its damage. */
  burnBy?: HeroKind;
  /** The last fire hit and how long it still counts: a death meanwhile is a death by fire. */
  scorch: number;
  scorchTime: number;
  /** The potion of that fire hit, credited with the chain blast. */
  scorchBy?: HeroKind;
  /** Arcane mark: takes more damage from every source while it lasts. */
  markTime: number;
  /** Frostbite stacks from ice hits; enough of them freeze it. They wear off after chillTime
   *  without a new ice hit. */
  chill: number;
  chillTime: number;
  /** Static from lightning: extra damage the next hit of another potion sets off. */
  charge: number;
  chargeTime: number;
  /** Ticks before a wind hit can knock it back again. */
  pushTime: number;
  /** True once it reached the wall and is hitting it. */
  atWall: boolean;
  /** A flyer weaves from side to side about this x, at this point of its swing (brads). */
  x0?: number;
  phase?: number;
  /** A winder's ticks until it next winds back the enemies around it. */
  windTime?: number;
}

export interface Projectile {
  id: number;
  kind: HeroKind;
  star: number;
  x: number;
  y: number;
  /** Where it was before the last tick, for the view. */
  px: number;
  py: number;
  targetId: number;
  /** Last known target position, so a shot still lands where its target died. */
  tx: number;
  ty: number;
  damage: number;
  /** Shot by the commander: the hero skill lines leave it alone. */
  commander?: boolean;
  /** A bolt split off a kill; it does not split again. */
  split?: boolean;
  /** A lightning shot that also calls down a sky strike where it lands. */
  strike?: boolean;
  /** A wind shot that lands as a gust: a wall of wind across the whole field. */
  gust?: boolean;
}

/** A whirlwind left where a wind shot killed (the vortex skill): it pulls the enemies around it
 *  in until it dies down. */
export interface Vortex {
  x: number;
  y: number;
  time: number;
}

/** What the view needs to know happened this step, beyond the plain state. */
export type BattleEvent =
  | { type: 'hit'; kind: HeroKind; x: number; y: number; radius: number }
  | { type: 'chain'; points: { x: number; y: number }[] }
  | { type: 'kill'; kind: EnemyKind; x: number; y: number; gold: number; boss: boolean }
  /** A hero in this slot just threw. */
  | { type: 'shot'; slot: number; projectile: number }
  | { type: 'summon'; slot: number }
  | { type: 'merge'; slot: number; star: number; kind: HeroKind }
  /** Enough summons for the commander to build a new cell onto the wall. */
  | { type: 'cellOpen'; slot: number; last: boolean }
  | { type: 'wave'; wave: number; boss: boolean }
  /** A skill offer opened: bought with gold, or the bonus for making an ultimate hero. */
  | { type: 'offer'; reason: OfferReason }
  | { type: 'wallHit' }
  /** A winder wound back the enemies within `radius`: healed, thawed and sped up again. */
  | { type: 'rewind'; x: number; y: number; radius: number }
  /** A wind gust swept the field `depth` deep either side of y. */
  | { type: 'gust'; x: number; y: number; depth: number }
  /** A wind hit knocked an enemy back from (x, y). */
  | { type: 'push'; x: number; y: number; id: number }
  | { type: 'end'; won: boolean };
