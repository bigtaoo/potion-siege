// Full-screen panels over the battle: the title, the skill pick and the end of a battle.

import { Container, Graphics, Sprite } from 'pixi.js';
import { t } from '../i18n';
import { CHALLENGE_TIERS, type ChallengeResult, type ModifierId } from '../sim/challenge';
import { ENDLESS_MILESTONES, type EndlessResult } from '../sim/endless';
import { DOUBLES_PER_DAY, type Reward } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { skillHeroes, skillMax, type SkillId, type SkillLevels } from '../sim/skills';
import {
  balanced,
  bottle,
  coinsIcon,
  gearIcon,
  infinityIcon,
  ink,
  medal,
  modifierIcon,
  P,
  paperCard,
  PillButton,
  plate,
  stopwatchIcon,
  swordIcon,
  swordsIcon,
  tappable,
  wallIcon,
  inset,
  LIGHT,
  lightPanel,
  lightTile,
  type ButtonKind,
} from './kit';
import { iconTexture, ultimateTexture } from './art';
import { COLORS, gem, HERO_COLORS, label } from './ui';
import { DESIGN_H, DESIGN_W } from './viewport';

/** The skill pick's box, centred on the page (shrunk to fit), which the tutorial keeps clear of. */
export const SKILL_BOX = { w: 1060, h: 1080 };

/** Laid out on the whole screen (see fitMenu): `w` x `h` page units, at least 1080x1920 on a
 *  phone and 1920x1080 on a wide screen, built again when the page size changes. */
export class Overlay extends Container {
  private w = DESIGN_W;
  private h = DESIGN_H;
  /** Builds the panel that is up again, for a new page size. */
  private redo: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
  }

  /** A new page size: the panel that is up is laid out again. */
  layout(w: number, h: number): void {
    if (Math.abs(w - this.w) < 1 && Math.abs(h - this.h) < 1) return;
    this.w = w;
    this.h = h;
    this.redo?.();
  }

  hide(): void {
    this.visible = false;
    this.redo = null;
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
  }

  private open(dim: number, redo: () => void): void {
    this.hide();
    this.visible = true;
    this.redo = redo;
    const shade = new Graphics().rect(0, 0, this.w, this.h).fill({ color: COLORS.dim, alpha: dim });
    shade.eventMode = 'static'; // swallow taps meant for the board
    this.addChild(shade);
  }

  /** A box centred on the page for content `w` x `h` across (centred on the box's origin),
   *  shrunk when the page is smaller than that. */
  private box(w: number, h: number): Container {
    const box = new Container();
    box.position.set(this.w / 2, this.h / 2);
    box.scale.set(Math.min(1, (this.w - 40) / w, (this.h - 40) / h));
    this.addChild(box);
    return box;
  }

  /** Three tall cards side by side, and under them the rewarded refresh when `onReroll` is
   *  given. `levels` says how far each skill has been taken. */
  showSkills(choices: SkillId[], levels: SkillLevels, title: string, onPick: (id: SkillId) => void, onReroll: (() => void) | null): void {
    this.open(0.7, () => this.showSkills(choices, levels, title, onPick, onReroll));
    const box = this.box(SKILL_BOX.w, SKILL_BOX.h);
    const head = plate(title, 54, 520);
    head.y = -450;
    box.addChild(head);
    const gap = 340;
    choices.forEach((id, i) => {
      const card = skillCard(id, levels[id]);
      card.x = (i - (choices.length - 1) / 2) * gap;
      tappable(card, () => onPick(id));
      box.addChild(card);
    });
    if (onReroll) {
      const b = adButton(t('reroll'), 440, 130, 'purple', onReroll, 50);
      b.y = 460;
      box.addChild(b);
    }
  }

  /** The result on a walnut board: a plate saying won or lost, the wave, kills and time on
   *  parchment, the crystals it earned (with the rewarded ×2) and the first clear, each
   *  potion's share of the damage with the MVP, after a loss the tips for getting stronger,
   *  then the rewarded revive when there is one and Continue (to the home screen). On a wide
   *  screen the damage and the tips stand in a second column. */
  showEnd(won: boolean, stats: string, reward: Reward, onContinue: () => void, onRevive: (() => void) | null, more: EndExtras): void {
    this.open(0.72, () => this.showEnd(won, stats, reward, onContinue, onRevive, more));
    const W = 900;
    const cw = W - 120;
    const ch = more.challenge;
    const en = more.endless;
    const left: Section[] = [en ? endlessHeader(en) : header(won, ch), statTiles(stats, cw)];
    if (ch) left.push(challengeTrack(ch, cw));
    if (en) left.push(endlessTrack(en, cw));
    left.push(purse(reward, more, cw));
    if (en?.result.record) left.push(section(ribbon(t('endless.record'), W - 200), 110));
    if (en && en.result.milestones > 0) {
      const top = ENDLESS_MILESTONES.filter((s) => en.result.wave >= s.wave).pop();
      left.push(section(ribbon(`${t('endless.milestone', { n: top?.wave ?? en.result.wave })} ${t('reward', { n: en.result.milestones })}`, W - 200), 110));
    }
    if (ch && ch.streakBonus > 0) left.push(section(ribbon(`${t('challenge.streakBonus', { n: ch.streak })} ${t('reward', { n: ch.streakBonus })}`, W - 200), 110));
    if (reward.firstClear) left.push(section(ribbon(t('firstClear'), W - 200), 120));
    for (const kind of reward.unlocked) left.push(section(ribbon(t('unlockHero', { name: t(`hero.${kind}`) }), W - 200), 110));
    const right: Section[] = [];
    if (more.dealt.length > 0) right.push(damageChart(more.dealt, cw));
    if (more.onTip) right.push(tips(more.onTip, more.dealt, cw));
    const buttons = endButtons(onContinue, onRevive, more.onNext ?? null);
    const wide = this.w > this.h && right.length > 0;
    const cols = wide ? [[...left, buttons], right] : [[...left, ...right, buttons]];
    const heights = cols.map((col) => col.reduce((a, c) => a + c.h, 0));
    const H = Math.max(...heights) + 80;
    const BW = W * cols.length;
    const box = this.box(BW + 60, H + 220);
    box.y += 40; // room for the crest over the board
    box.addChild(lightPanel(BW, H));
    if (wide) box.addChild(new Graphics().rect(-3, -H / 2 + 40, 6, H - 80).fill(LIGHT.seam));
    cols.forEach((col, i) => {
      const x = (i - (cols.length - 1) / 2) * W;
      // the second column sits in the middle of the board's height
      let y = -H / 2 + (i === 0 ? 0 : (H - heights[i]) / 2);
      for (const sec of col) {
        sec.c.position.set(x, y);
        box.addChild(sec.c);
        y += sec.h;
      }
    });
  }
}

/** What else the result screen shows: the rewarded ×2 (null when it is not on offer), whether
 *  the crystals were doubled, each potion's damage, and the tips after a loss. */
export interface EndExtras {
  onDouble: (() => void) | null;
  doubled: boolean;
  /** Today's ×2s left, shown under the ×2 (greyed out at 0); undefined hides the line. */
  doublesLeft?: number;
  dealt: { kind: HeroKind; damage: number }[];
  onTip: ((tab: TipTab) => void) | null;
  /** The daily challenge's result: the tiers this attempt reached instead of a stage's win. */
  challenge?: ChallengeEnd;
  /** Straight into the next stage, the big button, with Continue as a smaller 返回 under it
   *  (a new player's first wins). */
  onNext?: (() => void) | null;
  /** An endless run's result: the wave it reached, the best and the next milestone. */
  endless?: EndlessEnd;
}

export interface EndlessEnd {
  result: EndlessResult;
  /** The best wave, this run included. */
  best: number;
  /** The next milestone not reached yet, null once all are. */
  next: { wave: number; reward: number } | null;
}

export interface ChallengeEnd {
  result: ChallengeResult;
  mods: readonly ModifierId[];
  trial: HeroKind | null;
  /** Days in a row, and the crystals that paid today (0 on most days). */
  streak: number;
  streakBonus: number;
}

/** The home tabs a tip leads to. */
export type TipTab = 'potions' | 'workshop' | 'battle';

/** A row of the result board: its content (centred across, from y 0 down) and its height. */
interface Section {
  c: Container;
  h: number;
}

/** `c` centred in a row `h` tall. */
function section(c: Container, h: number): Section {
  const row = new Container();
  c.y = h / 2;
  row.addChild(c);
  return { c: row, h };
}

/** The plate, with stars over a win and the wall knocked apart over a loss. */
function header(won: boolean, ch?: ChallengeEnd): Section {
  const c = new Container();
  // a challenge reads as won once it reached a tier
  const good = ch ? ch.result.tier > 0 : won;
  const crest = good ? stars(ch ? ch.result.tier : 3) : brokenWall();
  crest.y = -30;
  const head = plate(ch ? t('challenge.result') : won ? t('won') : t('lost'), 72, 560, good ? 'brass' : 'red');
  head.y = 80;
  c.addChild(crest, head);
  return { c, h: 200 };
}

/** An endless run's plate: the loop, with stars round it on a new record. */
function endlessHeader(en: EndlessEnd): Section {
  const c = new Container();
  const crest = en.result.record ? stars(3) : new Container();
  crest.y = -30;
  const loop = new Container();
  const ring = infinityIcon();
  ring.scale.set(0.9);
  loop.addChild(medal(64), ring);
  loop.y = en.result.record ? -40 : -30;
  const head = plate(t('endless.result'), 72, 560, 'brass');
  head.y = 80;
  c.addChild(crest, loop, head);
  return { c, h: 200 };
}

/** How far the run got against the best, and the bar toward the next milestone (from the one
 *  before it). */
function endlessTrack(en: EndlessEnd, cw: number): Section {
  const c = new Container();
  c.addChild(inset(cw, 200, 0, 30));
  const x0 = -cw / 2 + 50;
  const x1 = cw / 2 - 50;
  const reached = ink(t('endless.reached', { n: en.result.wave }), 38, { fontWeight: '900' });
  reached.anchor.set(0, 0.5);
  reached.position.set(x0, 46);
  const best = ink(t('endless.bestLine', { n: en.best }), 32, { fill: P.inkSoft });
  best.anchor.set(1, 0.5);
  best.position.set(x1, 46);
  c.addChild(reached, best);
  const cy = 110;
  const track = new Graphics().roundRect(x0, cy - 12, x1 - x0, 24, 12).fill(LIGHT.tile).stroke({ width: 4, color: LIGHT.edge });
  c.addChild(track);
  const foot = ink('', 30, { fill: P.inkSoft });
  foot.position.set(0, 160);
  if (en.next) {
    const from = ENDLESS_MILESTONES.filter((s) => s.wave < en.next!.wave).pop()?.wave ?? 0;
    const frac = Math.max(0, Math.min(1, (en.best - from) / (en.next.wave - from)));
    if (frac > 0) track.roundRect(x0 + 4, cy - 8, Math.max(16, (x1 - x0 - 8) * frac), 16, 8).fill(0x4cc35a);
    foot.text = `${t('endless.next', { n: en.next.wave })}   ${t('reward', { n: en.next.reward })}`;
    c.addChild(gem(new Graphics(), foot.width / 2 + 30, 158, 14));
  } else {
    track.roundRect(x0 + 4, cy - 8, x1 - x0 - 8, 16, 8).fill(0x4cc35a);
    foot.text = t('endless.allDone');
  }
  c.addChild(foot);
  return { c, h: 230 };
}

/** Wave, kills and time (the parts of `stats`), a parchment tile each. */
function statTiles(stats: string, cw: number): Section {
  const c = new Container();
  const icons = [swordsIcon, gearIcon, stopwatchIcon];
  const parts = stats.split(/\s{2,}/).slice(0, 3);
  const gap = 24;
  const tw = (cw - gap * (parts.length - 1)) / parts.length;
  parts.forEach((part, i) => {
    const tile = new Container();
    tile.position.set((i - (parts.length - 1) / 2) * (tw + gap), 135);
    tile.addChild(lightTile(tw, 220, 24));
    const icon = icons[i]();
    icon.scale.set(0.8);
    icon.y = -38;
    const text = ink(part, 44);
    text.y = 60;
    if (text.width > tw - 24) text.scale.set((tw - 24) / text.width);
    tile.addChild(icon, text);
    c.addChild(tile);
  });
  return { c, h: 270 };
}

/** The challenge's reward tiers on a track filled up to the wave reached, each a medal with
 *  its wave, lit once this attempt got there, and its crystals under it; the day's modifiers
 *  on the left. */
function challengeTrack(ch: ChallengeEnd, cw: number): Section {
  const c = new Container();
  const { result } = ch;
  c.addChild(inset(cw, 230, 0, 30));
  const mx = -cw / 2 + 80;
  ch.mods.forEach((id, i) => {
    const icon = modifierIcon(id, ch.trial);
    icon.scale.set(0.62);
    icon.position.set(mx, 64 + i * 100);
    c.addChild(icon);
  });
  const x0 = -cw / 2 + 190;
  const x1 = cw / 2 - 90;
  const last = CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].wave;
  const at = (wave: number) => x0 + ((x1 - x0) * wave) / last;
  const cy = 112;
  const track = new Graphics().roundRect(x0, cy - 12, x1 - x0, 24, 12).fill(LIGHT.tile).stroke({ width: 4, color: LIGHT.edge });
  const fill = Math.min(result.wave, last);
  if (fill > 0) track.roundRect(x0 + 4, cy - 8, at(fill) - x0 - 4, 16, 8).fill(0x4cc35a);
  c.addChild(track);
  const reached = ink(t('challenge.reached', { n: result.wave }), 34, { fontWeight: '900' });
  reached.anchor.set(0, 0.5);
  reached.position.set(x0, 46);
  c.addChild(reached);
  CHALLENGE_TIERS.forEach((tier, i) => {
    const on = i < result.tier;
    const x = at(tier.wave);
    const md = new Graphics()
      .circle(x, cy + 5, 44)
      .fill({ color: P.line, alpha: 0.3 })
      .circle(x, cy, 44)
      .fill(on ? COLORS.gold : LIGHT.inset)
      .stroke({ width: 5, color: on ? P.line : LIGHT.edge });
    const n = label(String(tier.wave), 44, on ? { stroke: { color: P.line, width: 7 } } : { fill: P.inkSoft, stroke: { color: P.inkSoft, width: 0 } });
    n.position.set(x, cy - 2);
    const prize = ink(String(tier.reward), 32, { fill: on ? LIGHT.crystal : P.inkSoft, fontWeight: '900' });
    prize.anchor.set(0, 0.5);
    prize.position.set(x - (prize.width + 34) / 2 + 34, cy + 76);
    c.addChild(md, n, gem(new Graphics(), prize.x - 20, cy + 75, 14), prize);
  });
  return { c, h: 270 };
}

/** The crystals: a dark inset with what they are on the left, the gem and count, and on the
 *  right the rewarded ×2 (or a brass ×2 seal once it was paid). */
function purse(reward: Reward, more: EndExtras, iw: number): Section {
  const c = new Container();
  c.addChild(inset(iw, 128, -64, 30));
  const what = ink(t('earned'), 44);
  what.anchor.set(0, 0.5);
  what.x = -iw / 2 + 40;
  c.addChild(what);
  // with the ×2 on offer (or greyed out, today's used up) the gem and count follow the words;
  // otherwise they sit on the right
  const button = more.onDouble !== null || more.doublesLeft === 0;
  const count = label(t('reward', { n: reward.crystals }), button ? 72 : 84, { fill: 0x9beaff, stroke: { color: LIGHT.crystal, width: 8 } });
  count.anchor.set(1, 0.5);
  if (button) {
    // the words give way first (the English ones fill the row), so the count stays readable
    const end = iw / 2 - 290;
    const room = end - what.x - 100;
    if (what.width + count.width > room) what.scale.set(Math.max(0.8, (room - count.width) / what.width));
    const x0 = what.x + what.width + 100;
    count.scale.set(Math.min(1, (end - x0) / count.width));
    count.x = x0 + count.width;
  } else {
    count.x = iw / 2 - 40 - (more.doubled ? 110 : 0);
  }
  c.addChild(count, gem(new Graphics(), count.x - count.width - 44, -2, 40));
  if (button) {
    const left = more.doublesLeft;
    const b = adButton(t('double'), 250, left === undefined ? 104 : 80, 'purple', more.onDouble ?? (() => {}), 38);
    b.x = iw / 2 - 140;
    c.addChild(b);
    if (left !== undefined) {
      b.y = -16;
      b.setEnabled(left > 0);
      const note = label(t('doublesLeft', { n: left, total: DOUBLES_PER_DAY }), 26, { fill: 0xcfe3ff, stroke: { color: P.line, width: 5 } });
      note.position.set(b.x, 42);
      c.addChild(note);
    }
  } else if (more.doubled) {
    const seal = medal(44, P.brass);
    const x2 = label(t('doubled'), 38, { stroke: { color: P.line, width: 6 } });
    seal.x = x2.x = iw / 2 - 84;
    c.addChild(seal, x2);
  }
  return section(c, 170);
}

/** Each potion's share of the damage as a bar in its colour, the biggest one the MVP. */
function damageChart(dealt: EndExtras['dealt'], cw: number): Section {
  const c = new Container();
  const title = ink(t('damage'), 44);
  title.y = 34;
  c.addChild(title);
  const rows = [...dealt].sort((a, b) => b.damage - a.damage);
  const total = rows.reduce((a, r) => a + r.damage, 0);
  const rh = 76;
  const top = 80;
  const bx = -cw / 2 + 100;
  const bw = cw - 100 - 130;
  c.addChild(inset(cw, rows.length * rh + 16, top - 8, 26));
  rows.forEach((r, i) => {
    const y = top + i * rh + rh / 2;
    if (i === 0) c.addChild(new Graphics().roundRect(-cw / 2 + 10, y - rh / 2 + 4, cw - 20, rh - 8, 20).fill({ color: P.brass, alpha: 0.28 }));
    const b = bottle(r.kind, 84);
    b.position.set(-cw / 2 + 52, y);
    const g = new Graphics().roundRect(bx, y - 18, bw, 36, 18).fill({ color: P.ink, alpha: 0.14 });
    g.roundRect(bx, y - 18, Math.max(36, (bw * r.damage) / rows[0].damage), 36, 18).fill(HERO_COLORS[r.kind]).stroke({ width: 4, color: P.line });
    const pct = ink(`${Math.round((100 * r.damage) / total)}%`, 40);
    pct.anchor.set(1, 0.5);
    pct.position.set(cw / 2 - 24, y);
    c.addChild(g, b, pct);
    if (i === 0) {
      // the MVP's word on its own full bar, at the start, clear of the end it measures
      const tag = label(t('mvp'), 26, { fill: P.cream, stroke: { color: P.line, width: 6 } });
      tag.anchor.set(0, 0.5);
      tag.position.set(bx + 18, y - 1);
      c.addChild(tag);
    }
  });
  return { c, h: top + rows.length * rh + 40 };
}

/** After a loss: where to get stronger, a parchment row each that opens that home tab. */
function tips(onTip: (tab: TipTab) => void, dealt: EndExtras['dealt'], cw: number): Section {
  const c = new Container();
  const title = plate(t('tips'), 40, 300, 'brass');
  title.y = 40;
  c.addChild(title);
  const best = [...dealt].sort((a, b) => b.damage - a.damage)[0]?.kind ?? 'fire';
  const items: [TipTab, 'potions' | 'workshop' | 'stage', () => Container][] = [
    ['potions', 'potions', () => bottle(best, 76)],
    ['workshop', 'workshop', () => gearIcon(34)],
    ['battle', 'stage', swordsIcon],
  ];
  const rh = 108;
  const gap = 14;
  const top = 96;
  items.forEach(([tab, key, icon], i) => {
    const row = new Container();
    row.y = top + i * (rh + gap) + rh / 2;
    row.addChild(lightTile(cw, rh, 22));
    const pic = icon();
    pic.x = -cw / 2 + 64;
    if (key === 'stage') pic.scale.set(0.7);
    const name = ink(t(`tip.${key}.name`), 40);
    name.anchor.set(0, 0.5);
    name.position.set(-cw / 2 + 130, -18);
    const desc = ink(t(`tip.${key}.desc`), 30, { fill: P.inkSoft });
    desc.anchor.set(0, 0.5);
    desc.position.set(-cw / 2 + 130, 24);
    if (desc.width > cw - 220) desc.scale.set((cw - 220) / desc.width);
    const go = new Graphics()
      .poly([cw / 2 - 58, -22, cw / 2 - 34, 0, cw / 2 - 58, 22], false)
      .stroke({ width: 8, color: P.inkSoft, cap: 'round', join: 'round' });
    row.addChild(pic, name, desc, go);
    tappable(row, () => onTip(tab));
    c.addChild(row);
  });
  return { c, h: top + items.length * (rh + gap) + 20 };
}

/** The revive (with the ad sign) on top when there is one, Continue under it; or Next Stage
 *  with a smaller 返回 under it. */
function endButtons(onContinue: () => void, onRevive: (() => void) | null, onNext: (() => void) | null): Section {
  const c = new Container();
  if (onNext) {
    const next = new PillButton(t('nextStage'), 620, 150, 'green', onNext, 62);
    next.y = 95;
    const back = new PillButton(t('back'), 380, 104, 'brass', onContinue, 44);
    back.y = 250;
    c.addChild(next, back);
    return { c, h: 330 };
  }
  let by = 20;
  if (onRevive) {
    const revive = adButton(t('revive'), 640, 150, 'purple', onRevive, 54);
    revive.y = by + 75;
    c.addChild(revive);
    by += 180;
  }
  const big = !onRevive;
  const go = new PillButton(t('continue'), big ? 620 : 460, big ? 150 : 120, 'green', onContinue, big ? 62 : 50);
  go.y = by + (big ? 75 : 60);
  c.addChild(go);
  return { c, h: onRevive ? 300 : 170 };
}

/** A pill button with the ad sign in front of its caption. */
function adButton(caption: string, w: number, h: number, kind: ButtonKind, onTap: () => void, size: number): PillButton {
  const b = new PillButton(caption, w, h, kind, onTap, size);
  const text = b.children[1];
  text.x = 34;
  const ad = adSign();
  ad.position.set(-text.width / 2 - 14, -4);
  b.addChild(ad);
  return b;
}

/** Three stars, the middle one higher and bigger: a win. `lit` of them are gold, from the left
 *  (a challenge lights one per tier reached). */
function stars(lit = 3): Graphics {
  const g = new Graphics();
  const star = (x: number, y: number, r: number, on: boolean) => {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.46 : r;
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.poly(pts).fill(on ? COLORS.gold : LIGHT.inset).stroke({ width: 6, color: P.line, join: 'round' });
    if (on) g.circle(x - r * 0.18, y - r * 0.22, r * 0.16).fill({ color: 0xffffff, alpha: 0.55 });
  };
  star(-130, 14, 54, lit >= 1);
  star(130, 14, 54, lit >= 3);
  star(0, -16, 76, lit >= 2);
  return g;
}

/** The wall stones knocked apart: a loss. */
function brokenWall(): Container {
  const c = new Container();
  for (const [x, r] of [[-60, -0.22], [60, 0.26]]) {
    const half = wallIcon();
    half.position.set(x, 0);
    half.rotation = r;
    c.addChild(half);
  }
  c.scale.set(1.2);
  return c;
}

/** A green ribbon with tails, its text in cream. */
function ribbon(text: string, w: number): Container {
  const c = new Container();
  const h = 80;
  const g = new Graphics();
  for (const s of [-1, 1]) {
    const x0 = (s * w) / 2;
    g.poly([x0 - s * 20, -h / 2 + 14, x0 + s * 40, -h / 2 + 14, x0 + s * 22, 8, x0 + s * 40, h / 2 + 10, x0 - s * 20, h / 2 + 10])
      .fill(0x2b7c36)
      .stroke({ width: 5, color: P.line, join: 'round' });
  }
  g.roundRect(-w / 2, -h / 2, w, h, 14).fill(0x4cc35a).stroke({ width: 5, color: P.line });
  g.roundRect(-w / 2 + 14, -h / 2 + 8, w - 28, 8, 4).fill({ color: 0xffffff, alpha: 0.35 });
  const caption = label(text, 42, { stroke: { color: P.line, width: 7 } });
  caption.y = -2;
  if (caption.width > w - 40) caption.scale.set((w - 40) / caption.width);
  c.addChild(g, caption);
  return c;
}

const CARD_W = 320;
const CARD_H = 640;

/** A tall parchment card: the name on a band in its hero's colour (both colours for a recipe,
 *  brass for the skills every hero shares), the picture, what it does, and pips for how far
 *  it has been taken. */
function skillCard(id: SkillId, level: number): Container {
  const card = new Container();
  const { hero, with: other } = skillHeroes(id);
  const top = -CARD_H / 2;
  const band = 130;
  const color = hero ? HERO_COLORS[hero] : P.brass;
  card.addChild(paperCard(CARD_W, CARD_H, 30));
  const g = new Graphics();
  const x = -CARD_W / 2 + 10;
  const w = CARD_W - 20;
  g.roundRect(x, top + 10, w, band, 22).fill(color);
  // a recipe's band turns into the second hero's colour along a slant
  if (other) g.poly([w / 2 - 10 + x + 40, top + 10, x + w - 22, top + 10, x + w, top + 32, x + w, top + 10 + band - 22, x + w - 22, top + 10 + band, x + w / 2 - 40, top + 10 + band]).fill(HERO_COLORS[other]);
  g.rect(x + 18, top + 18, w - 36, 10).fill({ color: 0xffffff, alpha: 0.35 });
  g.roundRect(x, top + 10, w, band, 22).stroke({ width: 4, color: LIGHT.edge });
  card.addChild(g);
  // wrapped only at spaces, and small enough that the longest word fits the band whole
  const title = t(`skill.${id}.name`);
  const longest = Math.max(...title.split(' ').map((word) => {
    const probe = label(word, 50, { stroke: { color: P.line, width: 6 } });
    const pw = probe.width;
    probe.destroy();
    return pw;
  }));
  const size = Math.min(50, Math.floor((50 * (w - 30)) / longest));
  const name = label(title, size, { wordWrap: true, breakWords: false, wordWrapWidth: w - 30, stroke: { color: P.line, width: 6 } });
  name.position.set(0, top + 10 + band / 2);
  if (name.height > band - 16) name.scale.set((band - 16) / name.height);
  card.addChild(name);

  const iy = top + band + 150;
  card.addChild(new Graphics().circle(0, iy, 118).fill({ color, alpha: 0.22 }));
  const icon = cardIcon(id, hero, other);
  if (icon) {
    icon.position.set(0, iy);
    icon.scale.set(1.25);
    card.addChild(icon);
  }
  if (other) {
    const tag = new Container();
    const text = label(t('recipe'), 32, { stroke: { color: P.line, width: 6 } });
    const tw = text.width + 40;
    tag.addChild(new Graphics().roundRect(-tw / 2, -24, tw, 48, 24).fill(0x8f5ce0).stroke({ width: 4, color: P.line }), text);
    tag.position.set(0, iy + 118);
    card.addChild(tag);
  }

  // the description keeps clear of the pips: a smaller size when it runs long
  const dy = iy + (other ? 160 : 140);
  const room = CARD_H / 2 - 62 - 14 - dy;
  let desc = balanced(t(`skill.${id}.desc`), 31, w - 40, { align: 'center', lineHeight: 40 });
  for (const ds of [28, 25]) {
    if (desc.height <= room) break;
    desc.destroy();
    desc = balanced(t(`skill.${id}.desc`), ds, w - 36, { align: 'center', lineHeight: Math.round(ds * 1.28) });
  }
  if (desc.height > room) desc.scale.set(room / desc.height);
  desc.anchor.set(0.5, 0);
  desc.position.set(0, dy);
  card.addChild(desc);

  // pips: brass for the levels already taken, green for the one this card adds
  const max = skillMax(id);
  if (max <= 5) {
    const pips = new Graphics();
    const step = 44;
    for (let i = 0; i < max; i++) {
      const px = (i - (max - 1) / 2) * step;
      const fill = i < level ? P.brass : i === level ? 0x5cc66a : P.paperDark;
      pips.roundRect(px - 15, CARD_H / 2 - 62, 30, 30, 8).fill(fill).stroke({ width: 4, color: P.line });
    }
    card.addChild(pips);
  }
  return card;
}

/** The sign for "watch an ad": a little screen with a play arrow. */
function adSign(): Graphics {
  return new Graphics()
    .roundRect(-30, -22, 60, 44, 10)
    .fill(0xffd34d)
    .stroke({ width: 4, color: P.line })
    .poly([-8, -11, -8, 11, 12, 0])
    .fill(P.line);
}

const DRAWN_ICONS: Partial<Record<SkillId, () => Container>> = {
  allDamage: swordIcon,
  allSpeed: stopwatchIcon,
  gold: coinsIcon,
  wallRepair: wallIcon,
};

/** A card's picture: the bottle of the hero it belongs to (a recipe shows both), or the
 *  skill's own icon for the ones that serve every hero. */
export function cardIcon(id: SkillId, hero?: HeroKind, other?: HeroKind): Container | null {
  const c = new Container();
  const bottle = (kind: HeroKind, h: number, x: number, y: number) => {
    const tex = ultimateTexture(kind);
    if (!tex) return;
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(h / Math.max(tex.width, tex.height));
    s.position.set(x, y);
    c.addChild(s);
  };
  if (hero && other) {
    bottle(other, 140, -40, -14);
    bottle(hero, 150, 38, 14);
  } else if (hero) {
    bottle(hero, 190, 0, 0);
  } else {
    const tex = iconTexture(id);
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(150 / tex.height);
      c.addChild(s);
    } else {
      // drawn until these get painted art of their own
      const drawn = DRAWN_ICONS[id];
      if (!drawn) return null;
      const icon = drawn();
      icon.scale.set(1.4);
      c.addChild(medal(78, P.paperDark), icon);
    }
  }
  return c;
}
