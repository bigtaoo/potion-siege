// The waves coming in: each wave's plan and bonus, the next wave once this one is out and its
// boss is down, and each enemy brought onto the field with its place, speed and boss timers.

import type { Battle } from './battle';
import { K } from './field';
import { laneSpan } from './horde';
import { perTick, pm, ticks, times, toFp } from './math/fixed';
import { BRAD_FULL } from './math/trig';
import { BALANCE, isBoss, type Enemy } from './types';
import { endlessSpeed, isBossWave, planWave, type Spawn } from './waves';

const B = BALANCE;

export function startWave(b: Battle, wave: number): void {
  b.wave = wave;
  b.waveTime = 0;
  const bossWaves = b.setup.modifiers?.bossWaves;
  const endless = b.setup.endless === true;
  b.pending = planWave(wave, b.enemyRng, b.setup.stage, b.setup.modifiers, endless).map((s) => ({ ...s, hp: Math.round(s.hp * b.setup.enemyHp) }));
  if (wave > 1) b.gold += Math.round(B.waves.waveBonusGold * (b.setup.modifiers?.waveGold ?? 1));
  b.events.push({ type: 'wave', wave, boss: isBossWave(wave, bossWaves, endless) });
}

export function stepWaves(b: Battle): void {
  b.waveTime++;
  while (b.pending.length > 0 && b.pending[0].at <= b.waveTime) spawn(b, b.pending.shift()!);
  const w = B.waves;
  const bossAlive = b.enemies.some((e) => isBoss(e.kind));
  if ((b.setup.endless || b.wave < w.count) && b.pending.length === 0 && b.waveTime >= ticks(w.spawnWindow + w.gap) && !bossAlive) {
    startWave(b, b.wave + 1);
  }
}

/** Brings `s` onto the field: at the top at a random x (within its lane, a rank behind the
 *  edge, for one of a rush), or at `at` (FP) when something on the field let it out. */
export function spawn(b: Battle, s: Spawn, at?: { x: number; y: number }): void {
  const def = B.enemies[s.kind];
  const radius = toFp(((s.elite ? def.radius * B.elite.radius : def.radius) * (s.size ?? 1000)) / 1000);
  const id = b.nextId;
  const [lo, hi] = laneSpan(s, K.left + radius, K.right - radius);
  const x = at ? Math.min(K.right - radius, Math.max(K.left + radius, at.x)) : b.enemyRng.range(lo, hi);
  const y = at ? at.y : K.top - radius - toFp(s.lane?.back ?? 0);
  const speed = times(times(perTick(def.speed), b.enemyRng.range(900, 1100)), pm((b.setup.modifiers?.enemySpeed ?? 1) * (b.setup.endless ? endlessSpeed(b.wave) : 1)));
  const e: Enemy = {
    id: b.nextId++,
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
    brittleTime: 0,
    charge: 0,
    chargeTime: 0,
    pushTime: 0,
    atWall: false,
    gold: s.gold ?? 1000,
    heft: s.heft ?? 1000,
  };
  if (s.elite) e.elite = true;
  if (s.kind === 'flyer') {
    // its swing starts at a point set by its id, so the dice stay as they were before flyers
    e.x0 = Math.min(K.right - radius - K.weave, Math.max(K.left + radius + K.weave, e.x));
    e.phase = (id * K.weavePhase) % BRAD_FULL;
  }
  if (s.kind === 'winder') e.windTime = ticks(B.winder.every);
  if (s.kind === 'clock') e.broodTime = ticks(B.bosses.clock.first);
  if (s.kind === 'tripod') {
    e.shield = e.shieldMax = times(s.hp, pm(B.bosses.tripod.shield));
    e.shieldTime = 0;
  }
  if (s.kind === 'anvil') {
    e.hopTime = ticks(B.bosses.anvil.every);
    e.leapTime = 0;
  }
  b.enemies.push(e);
}
