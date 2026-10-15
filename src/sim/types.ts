import balanceJson from './balance.json';

export type Balance = typeof balanceJson;
export const BALANCE: Balance = balanceJson;

export const HERO_KINDS = ['arcane', 'fire', 'ice', 'lightning', 'poison'] as const;
export type HeroKind = (typeof HERO_KINDS)[number];

/** The four heroes brought into battle: every summon and every merge rolls one of them. */
export const LINEUP = BALANCE.lineup as readonly HeroKind[];

export type OfferReason = 'upgrade' | 'ultimate';

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'boss';

export interface Hero {
  id: number;
  kind: HeroKind;
  /** 1-based level: 1-3 show as that many copies in the cell, 4 is the single ultimate hero. */
  star: number;
  /** Grid slot index (row * cols + col); the bottom row is the wall. */
  slot: number;
  /** Seconds until the next shot. */
  cooldown: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  /** Multiplier on speed while slowTime > 0. */
  slowFactor: number;
  slowTime: number;
  freezeTime: number;
  poisonDps: number;
  poisonTime: number;
  /** True once it reached the wall and is hitting it. */
  atWall: boolean;
}

export interface Projectile {
  id: number;
  kind: HeroKind;
  star: number;
  x: number;
  y: number;
  targetId: number;
  /** Last known target position, so a shot still lands where its target died. */
  tx: number;
  ty: number;
  damage: number;
}

/** What the view needs to know happened this step, beyond the plain state. */
export type BattleEvent =
  | { type: 'hit'; kind: HeroKind; x: number; y: number; radius: number }
  | { type: 'chain'; points: { x: number; y: number }[] }
  | { type: 'kill'; x: number; y: number; gold: number; boss: boolean }
  /** A hero in this slot just threw. */
  | { type: 'shot'; slot: number; projectile: number }
  | { type: 'summon'; slot: number }
  | { type: 'merge'; slot: number; star: number }
  /** Enough summons for the commander to build a new cell onto the wall. */
  | { type: 'cellOpen'; slot: number; last: boolean }
  | { type: 'wave'; wave: number; boss: boolean }
  /** A skill offer opened: bought with gold, or the bonus for making an ultimate hero. */
  | { type: 'offer'; reason: OfferReason }
  | { type: 'wallHit' }
  | { type: 'end'; won: boolean };
