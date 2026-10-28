import './layout/measure';
import { Container, Graphics, Text } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { BASE_SETUP, type BattleModifiers, type BattleSetup } from '../sim/meta';
import { BALANCE, type HeroKind } from '../sim/types';
import { P } from './kit';
import { REST_ALPHA, SIDE } from './sideLook';
import { SideInfo } from './SideInfo';
import type { MenuFit } from './viewport';

const FIT: MenuFit = { scale: 0.5, w: 1920, h: 1080, wide: true };
const BOARD_X = 600;
const DASH = '–';

function battle(setup: Partial<BattleSetup> = {}): Battle {
  return new Battle(1, { ...BASE_SETUP, ...setup });
}

function mods(bossWaves: number[]): BattleModifiers {
  return { enemySpeed: 1, summonCost: 1, waveGold: 1, killGold: 1, crit: 0, bossWaves, banned: [] };
}

function sides(s: SideInfo): { left: Container; right: Container } {
  return { left: s.children[0] as Container, right: s.children[1] as Container };
}

/** The board a side shows: its only child, rebuilt on a new layout. */
function board(side: Container): Container {
  return side.children[0] as Container;
}

/** The waves board's rows, one plain container each (the heading's left out). */
function rows(s: SideInfo): Container[] {
  return board(sides(s).right)
    .children.filter((k): k is Container => k.constructor === Container)
    .slice(1);
}

function texts(c: Container): Text[] {
  const out: Text[] = [];
  const walk = (n: Container) => {
    if (n instanceof Text) out.push(n);
    for (const k of n.children) walk(k as Container);
  };
  walk(c);
  return out;
}

function words(c: Container): string[] {
  return texts(c).map((x) => x.text);
}

function find(c: Container, text: string): Text {
  const hit = texts(c).find((x) => x.text === text);
  if (!hit) throw new Error(`no "${text}" in ${JSON.stringify(words(c))}`);
  return hit;
}

/** The damage rows' share texts, in lineup order. */
function shares(s: SideInfo, b: Battle): string[] {
  return texts(board(sides(s).left))
    .slice(-b.setup.lineup.length)
    .map((x) => x.text);
}

/** The skills' names: the only left-anchored words on the board. */
function names(s: SideInfo): Text[] {
  return texts(board(sides(s).left)).filter((x) => x.anchor.x === 0);
}

function shown(b: Battle, s = new SideInfo(), boardX = BOARD_X, m = FIT): SideInfo {
  s.update(b, boardX, m, true, 0);
  return s;
}

describe('SideInfo, when it shows', () => {
  it('hides without a battle, when told to, or when the columns are too narrow', () => {
    const s = new SideInfo();
    s.update(null, BOARD_X, FIT, true, 0);
    expect(s.visible).toBe(false);
    s.update(battle(), BOARD_X, FIT, false, 0);
    expect(s.visible).toBe(false);
    s.update(battle(), 399, FIT, true, 0);
    expect(s.visible).toBe(false);
    expect(sides(s).left.children).toHaveLength(0);
    s.update(battle(), 400, FIT, true, 0);
    expect(s.visible).toBe(true);
  });

  it('scales to the menu and centres each board in its column, below the name plate', () => {
    const s = shown(battle());
    const { left, right } = sides(s);
    expect(s.scale.x).toBe(0.5);
    expect([left.x, left.y]).toEqual([BOARD_X / 2, 1080 / 2 + 30]);
    expect([right.x, right.y]).toEqual([1920 - BOARD_X / 2, 1080 / 2 + 30]);
  });

  it('grows the boards with the column up to 560 wide, and keeps them short of the page height', () => {
    // the panel's bounds take in its 3-wide edge and the shadow 8 below
    const panel = (s: SideInfo, side: 'left' | 'right') => (board(sides(s)[side]).children[0] as Graphics).getLocalBounds();
    expect(panel(shown(battle(), new SideInfo(), 500), 'left').width).toBeCloseTo(436 + 3);
    const big = shown(battle(), new SideInfo(), 1200, { scale: 1, w: 3000, h: 2400, wide: true });
    expect(panel(big, 'left').width).toBeCloseTo(560 + 3);
    expect(panel(big, 'left').height).toBeCloseTo(1500 + 9.5);
    expect(panel(shown(battle()), 'right').height).toBeCloseTo(1080 - 150 + 9.5);
  });

  it('rebuilds after being hidden, for a new battle, a new size or a new wave, and not otherwise', () => {
    const b = battle();
    const s = shown(b);
    const first = board(sides(s).left);
    s.update(b, BOARD_X, FIT, true, 1);
    expect(board(sides(s).left)).toBe(first);
    expect(first.destroyed).toBe(false);
    s.update(b, BOARD_X, FIT, false, 0);
    s.update(b, BOARD_X, FIT, true, 0);
    const again = board(sides(s).left);
    expect(again).not.toBe(first);
    expect(first.destroyed).toBe(true);
    const b2 = battle();
    s.update(b2, BOARD_X, FIT, true, 0);
    expect(board(sides(s).left)).not.toBe(again);
    const sized = board(sides(s).right);
    s.update(b2, BOARD_X, { ...FIT, w: 2000 }, true, 0);
    expect(board(sides(s).right)).not.toBe(sized);
    const before = board(sides(s).right);
    b2.wave = 2;
    s.update(b2, BOARD_X, { ...FIT, w: 2000 }, true, 0);
    expect(board(sides(s).right)).not.toBe(before);
  });
});

describe('the skills board', () => {
  it('steps back with a hint and a dash for every potion until there is something to show', () => {
    const b = battle();
    const s = shown(b);
    const { left } = sides(s);
    expect(left.alpha).toBeCloseTo(0.35);
    const all = words(left);
    expect(all).toContain('Skills this run');
    expect(all).toContain('Skills you pick on upgrades show up here');
    expect(all).toContain('Damage dealt');
    expect(shares(s, b)).toEqual(b.setup.lineup.map(() => DASH));
  });

  it('comes forward once any damage is done, and shows each potion its share', () => {
    const b = battle();
    const s = shown(b);
    const [a, c] = b.setup.lineup;
    b.dealt[a] = 300;
    b.dealt[c] = 100;
    s.update(b, BOARD_X, FIT, true, 0.25);
    expect(sides(s).left.alpha).toBe(1);
    expect(shares(s, b)).toEqual(b.setup.lineup.map((k) => (k === a ? '75%' : k === c ? '25%' : '0%')));
  });

  it('lists the potions best first, with a bar only for those that dealt damage', () => {
    const b = battle();
    const s = shown(b);
    const [a, c, d] = b.setup.lineup;
    b.dealt[c] = 500;
    b.dealt[d] = 100;
    s.update(b, BOARD_X, FIT, true, 0.25);
    const pcts = texts(board(sides(s).left)).filter((x) => x.text.endsWith('%'));
    const y = (text: string) => pcts.find((x) => x.text === text)!.y;
    expect(y('83%')).toBeLessThan(y('17%'));
    expect(y('17%')).toBeLessThan(pcts.filter((x) => x.text === '0%')[0].y);
    // each row is a bar, a bottle and a share, the last children of the board
    const kids = board(sides(s).left).children;
    const n = b.setup.lineup.length;
    const bar = (k: HeroKind) => kids[kids.length - 3 * (n - b.setup.lineup.indexOf(k))] as Graphics;
    const drawn = (k: HeroKind) => bar(k).context.instructions.length;
    expect(drawn(c)).toBeGreaterThan(drawn(a));
    expect(drawn(d)).toBe(drawn(c));
    expect(bar(a).y).toBe(0);
  });

  it('redraws changing shares at most every quarter second', () => {
    const b = battle();
    const s = shown(b);
    const [a, c] = b.setup.lineup;
    b.dealt[a] = 100;
    s.update(b, BOARD_X, FIT, true, 0.1);
    expect(shares(s, b)[0]).toBe(DASH);
    expect(sides(s).left.alpha).toBe(1);
    s.update(b, BOARD_X, FIT, true, 0.15);
    expect(shares(s, b)[0]).toBe('100%');
    b.dealt[c] = 100;
    s.update(b, BOARD_X, FIT, true, 0.1);
    expect(shares(s, b)[0]).toBe('100%');
    s.update(b, BOARD_X, FIT, true, 0.2);
    expect(shares(s, b).slice(0, 2)).toEqual(['50%', '50%']);
  });

  it('names each skill taken, with pips filled to its level, and drops the hint', () => {
    const b = battle();
    const s = shown(b);
    b.skills.allDamage = 2;
    s.update(b, BOARD_X, FIT, true, 0);
    const { left } = sides(s);
    expect(left.alpha).toBe(1);
    expect(words(left)).not.toContain('Skills you pick on upgrades show up here');
    expect(names(s)).toHaveLength(1);
    // five pips 24 apart, 9 round with a 3-wide edge
    const pips = board(left).children.filter((k): k is Graphics => k instanceof Graphics && Math.round(k.getLocalBounds().width) === 4 * 24 + 18 + 3);
    expect(pips).toHaveLength(1);
    const fills = pips[0].context.instructions.filter((i) => i.action === 'fill').map((i) => (i.data as { style: { color: number } }).style.color);
    expect(fills).toHaveLength(5);
    expect(fills.filter((f) => f !== fills[fills.length - 1])).toHaveLength(2);
  });

  it('shows the repair, which has no real cap, as a count and counts it up without a rebuild', () => {
    const b = battle();
    b.skills.wallRepair = 1;
    const s = shown(b);
    const first = board(sides(s).left);
    expect(words(first)).toContain('×1');
    b.skills.wallRepair = 3;
    s.update(b, BOARD_X, FIT, true, 0.01);
    expect(board(sides(s).left)).toBe(first);
    expect(words(first)).toContain('×3');
    expect(words(first)).not.toContain('×1');
  });

  it('shows a new level at once, even while the shares wait', () => {
    const b = battle();
    b.skills.wallRepair = 1;
    const s = shown(b);
    b.dealt[b.setup.lineup[0]] = 10;
    s.update(b, BOARD_X, FIT, true, 0.3);
    b.dealt[b.setup.lineup[1]] = 10;
    b.skills.wallRepair = 2;
    s.update(b, BOARD_X, FIT, true, 0.01);
    expect(words(sides(s).left)).toContain('×2');
    expect(shares(s, b).slice(0, 2)).toEqual(['50%', '50%']);
  });

  it('rebuilds for a newly taken skill, and draws potion, recipe and plain skills alike', () => {
    const lineup: HeroKind[] = ['fire', 'arcane', 'ice', 'lightning'];
    const b = battle({ lineup });
    const s = shown(b);
    const first = board(sides(s).left);
    b.skills.fireDamage = 1;
    b.skills.fireArcane = 1;
    b.skills.crit = 4;
    b.skills.gold = 1;
    s.update(b, BOARD_X, FIT, true, 0);
    expect(board(sides(s).left)).not.toBe(first);
    const ys = names(s).map((x) => x.y);
    expect(ys).toHaveLength(4);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys);
  });

  it('fits many skills into the room above the damage chart', () => {
    const b = battle();
    const many = ['allDamage', 'allSpeed', 'crit', 'gold', 'wallRepair', 'fireDamage', 'fireRadius', 'iceFreeze', 'iceDamage', 'windPush', 'windDamage', 'poisonDamage', 'poisonRust', 'arcanePower', 'arcaneMark', 'lightningChain'] as const;
    for (const id of many) b.skills[id] = 1;
    const s = shown(b);
    const ys = names(s).map((x) => x.y);
    expect(ys).toHaveLength(many.length);
    expect(Math.max(...ys)).toBeLessThan(find(sides(s).left, 'Damage dealt').y);
    expect(ys[1] - ys[0]).toBeLessThan(78);
  });
});

describe('the waves board', () => {
  it('shows this wave and the next three, the current one in full and marked Now', () => {
    const s = shown(battle());
    const { right } = sides(s);
    const all = words(right);
    expect(all).toContain('Coming up');
    for (const n of [1, 2, 3, 4]) expect(all).toContain(`Wave ${n}`);
    expect(all).not.toContain('Wave 5');
    expect(all).toContain('Now');
    expect(rows(s).map((r) => r.alpha)).toEqual([1, REST_ALPHA, REST_ALPHA, REST_ALPHA]);
    expect(find(right, 'Wave 1').style.fill).toBe(SIDE.ink);
    expect(find(right, 'Wave 2').style.fill).toBe(SIDE.soft);
  });

  it('counts down to the boss, then calls it next, then now in red', () => {
    const b = battle();
    const s = shown(b);
    const first = BALANCE.waves.bossWaves[0];
    expect(words(sides(s).right)).toContain(`Boss in ${first - 1} waves`);
    b.wave = first - 1;
    s.update(b, BOARD_X, FIT, true, 0);
    expect(find(sides(s).right, 'Boss next wave').style.fill).toBe(SIDE.accent);
    b.wave = first;
    s.update(b, BOARD_X, FIT, true, 0);
    expect(find(sides(s).right, 'Boss this wave').style.fill).toBe(P.red);
  });

  it('marks the final wave and shows no rows past it', () => {
    const b = battle();
    b.wave = BALANCE.waves.count - 2;
    const s = shown(b);
    const all = words(sides(s).right);
    expect(all).toContain('Final wave');
    expect(all).toContain(`Wave ${BALANCE.waves.count}`);
    expect(all).not.toContain(`Wave ${BALANCE.waves.count + 1}`);
    expect(rows(s)).toHaveLength(3);
  });

  it('says nothing of a boss when none is left to come', () => {
    const b = battle({ modifiers: mods([2]) });
    b.wave = 3;
    const s = shown(b);
    expect(words(sides(s).right).some((w) => w.startsWith('Boss'))).toBe(false);
  });

  it('reads the boss waves from the battle modifiers', () => {
    const s = shown(battle({ modifiers: mods([3]) }));
    expect(words(sides(s).right)).toContain('Boss in 2 waves');
  });

  it('runs on without a last wave in endless, a boss every few waves', () => {
    const b = battle({ endless: true });
    b.wave = BALANCE.waves.count + 2;
    const s = shown(b);
    const all = words(sides(s).right);
    expect(all).not.toContain('Final wave');
    for (let i = 0; i < 4; i++) expect(all).toContain(`Wave ${b.wave + i}`);
    const every = BALANCE.endless.bossEvery;
    const left = Math.ceil(b.wave / every) * every - b.wave;
    expect(all).toContain(left === 0 ? 'Boss this wave' : left === 1 ? 'Boss next wave' : `Boss in ${left} waves`);
  });

  it('before the first wave, shows wave 1 on without marking any as now', () => {
    const b = battle();
    b.wave = 0;
    const s = shown(b);
    const all = words(sides(s).right);
    expect(all).toContain('Wave 1');
    expect(all).not.toContain('Now');
    expect(rows(s)).toHaveLength(4);
    expect(rows(s).every((r) => r.alpha === REST_ALPHA)).toBe(true);
  });

  it('chips a kind NEW on the first wave it comes in, and tags the boss', () => {
    const b = battle();
    b.wave = BALANCE.waves.bossWaves[0];
    const s = shown(b);
    expect(words(rows(s)[0])).toContain('BOSS');
    let fresh = 0;
    for (let w = 2; w <= BALANCE.waves.count; w++) {
      b.wave = w;
      s.update(b, BOARD_X, FIT, true, 0);
      fresh += words(rows(s)[0]).filter((x) => x === 'NEW').length;
    }
    expect(fresh).toBeGreaterThan(0);
    b.wave = 1;
    s.update(b, BOARD_X, FIT, true, 0);
    expect(words(rows(s)[0])).not.toContain('NEW');
    expect(words(rows(s)[0])).not.toContain('BOSS');
  });
});
