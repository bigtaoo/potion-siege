// The home screen between battles, in the alchemist's-workshop look: a top bar with the daily
// login, the daily tasks and the crystals, five tabs (potions, workshop, battle, codex, shop;
// the codex is built in Codex.ts)
// and the daily login reward, the daily tasks and a hero's milestones as panels over it.
// Laid out on the whole screen: a portrait page with the tabs along the bottom, or on a wide
// (desktop) screen a landscape page with the tabs down the left side. Built afresh after every
// purchase, claim or resize.

import { Container, Graphics, Sprite } from 'pixi.js';
import { getLocale, LOCALES, localeName, t, type Locale, type TextKey } from '../i18n';
import {
  bestToday, canPlayAd, canPlayFree, CHALLENGE_TIERS, msToTomorrow, streak, tierOf, todaysChallenge,
} from '../sim/challenge';
import { achievementsClaimable, type TrackId } from '../sim/achievements';
import { endlessOpen, nextMilestone } from '../sim/endless';
import { ALL_DONE_BONUS, bonusReady, canClaimLogin, loginDay, loginReward, taskDone, taskGoal, taskReward, tasksClaimable } from '../sim/daily';
import { BALANCE, ENEMY_KINDS, HERO_KINDS, isBoss } from '../sim/types';
import { baseSkills, MILESTONES, skillHeroes } from '../sim/skills';
import { onStage } from '../sim/waves';
import { CHAPTER_COUNT, chapterChest, CHAPTER_SIZE, chapterInfo, chapterOf, chapterOpen, chapterProgress, chapterStages, chestWaiting, isFinale, stageTwists } from '../sim/chapters';
import {
  AD_CRYSTALS, adsLeft, ADS_PER_DAY, benched, CHEST_CRYSTALS, chestReady, heroCost, heroDamage, heroUnlocked, maxStage, unlockPrice, unlockStage,
  WORKSHOP_IDS, workshopCost, workshopValue, type MetaSave, type WorkshopId,
} from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { commanderTexture } from './art';
import { buildCodex } from './Codex';
import {
  bookIcon,
  bossTag,
  bottle,
  coinsIcon,
  fit as fitText,
  flask,
  calendarIcon,
  chestIcon,
  enemySprite,
  gearIcon,
  infinityIcon,
  ink,
  inkWrapped,
  inset,
  LIGHT,
  lightPanel,
  lightTile,
  lock,
  medal,
  modifierIcon,
  P,
  paperCard,
  PillButton,
  plate,
  redDot,
  refuse,
  scrollIcon,
  swordsIcon,
  tappable,
  workshopWall,
  wallIcon,
} from './kit';
import { canUpgradePotion, canUpgradeWorkshop, challengeShown, shopDot } from './nudges';
import { gem, HERO_COLORS, label } from './ui';
import { pointingHand } from './Tutorial';
import type { MenuFit } from './viewport';

export type HomeTab = 'potions' | 'workshop' | 'battle' | 'codex' | 'shop';
export const HOME_TABS: readonly HomeTab[] = ['potions', 'workshop', 'battle', 'codex', 'shop'];
export type HomePanel = 'login' | 'tasks' | 'settings' | 'language' | 'challenge' | 'chapters' | 'privacy' | HeroKind | null;

export interface HomeActions {
  tab(tab: HomeTab): void;
  panel(p: HomePanel): void;
  /** The claims pass the button tapped, where their crystals fly from. */
  claimLogin(at: Container): void;
  claimTask(index: number, at: Container): void;
  /** The bonus for claiming all of today's tasks. */
  claimBonus(at: Container): void;
  /** The next tier of an achievement track. */
  claimTier(id: TrackId, at: Container): void;
  stage(delta: number): void;
  /** A stage tile on the chapters panel was tapped. */
  pickStage(stage: number): void;
  /** A finished chapter's one-time chest. */
  claimChapter(chapter: number, at: Container): void;
  hero(kind: HeroKind): void;
  /** A potion on the battle tab's lineup row was tapped. */
  lineup(kind: HeroKind): void;
  workshop(id: WorkshopId): void;
  claimChest(at: Container): void;
  /** The shop's rewarded ad for crystals. */
  watchAd(): void;
  /** Buys a locked potion early. */
  unlock(kind: HeroKind): void;
  play(): void;
  /** Today's challenge: the free attempt, and the one a rewarded ad buys. */
  challenge(): void;
  challengeAd(): void;
  /** An endless run. */
  endless(): void;
  /** Flips the music or the sound effects toggle. */
  sound(which: 'music' | 'sfx'): void;
  /** A language picked on the language panel. */
  language(locale: Locale): void;
  /** The ad-free card: Apple's purchase sheet, and Restore. */
  buyAdFree(): void;
  restoreAdFree(): void;
  /** Google's ad privacy options form. */
  adPrivacy(): void;
  /** Our privacy policy, in the browser. */
  privacyPolicy(): void;
  /** The player's answer on sending play statistics: the consent panel, or the settings switch. */
  shareData(on: boolean): void;
  /** Puts the player ID on the clipboard. */
  copyId(): void;
}

/** What only some hosts have: the ad-free card for sale (iOS), Google's ad privacy options and
 *  a link out to our privacy policy (not on CrazyGames). */
export interface HomeExtras {
  /** `price` null while the store cannot sell; `note` how the last buy or restore went. */
  adFree?: { price: string | null; owned: boolean; note: string | null };
  privacy?: boolean;
  policy?: boolean;
  /** Play statistics: the settings switch and the player ID. */
  data?: PlayData;
}

/** What the settings show of the play statistics (analytics/privacy.ts). */
export interface PlayData {
  sending: boolean;
  /** The install id a request to see or delete data names; null while none is stored. */
  id: string | null;
  /** Whether the host has a clipboard to copy it to. */
  copy: boolean;
  /** How the last copy went. */
  note: 'copied' | 'failed' | null;
}

/** The part of the page a tab fills. */
interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
  wide: boolean;
}

/** Bottom bar height on a portrait page, side rail width on a landscape one, top bar height. */
const NAV = 210;
const RAIL = 230;
const TOP = 150;

/** `picked`: a reserve potion tapped on the lineup row, waiting for the one it replaces; `ads`:
 *  a rewarded ad can be offered; `hint`: the potion whose upgrade the one-time pointer is after
 *  (a hand on the potions tab, then on that potion's button). */
export function buildHome(
  m: MetaSave,
  act: HomeActions,
  tab: HomeTab,
  panel: HomePanel,
  today: string,
  fit: MenuFit,
  picked: HeroKind | null = null,
  ads = false,
  hint: HeroKind | null = null,
  extras: HomeExtras = {},
): Container {
  const root = new Container();
  const { w, h, wide } = fit;
  root.addChild(workshopWall(w, h));
  const left = wide ? RAIL : 0;
  const top = wide ? TOP - 20 : TOP;
  const area: Area = { x: left, y: top, w: w - left, h: (wide ? h : h - NAV) - top, wide };
  if (tab === 'battle') battleTab(root, m, act, area, picked, today);
  else if (tab === 'potions') potionsTab(root, m, act, area, hint);
  else if (tab === 'workshop') workshopTab(root, m, act, area);
  else if (tab === 'codex') root.addChild(buildCodex(m, area, act.claimTier));
  else shopTab(root, m, act, area, today, ads, extras.adFree ?? null);
  topBar(root, m, act, today, left, w, wide);
  // a dot only where something can be claimed or bought right now, and not on the tab already open
  const dots: Partial<Record<HomeTab, boolean>> = {
    potions: canUpgradePotion(m),
    workshop: canUpgradeWorkshop(m),
    shop: shopDot(m, today),
    codex: achievementsClaimable(m),
    battle: anyChestWaiting(m),
  };
  dots[tab] = false;
  nav(root, act, tab, fit, dots, hint !== null && tab !== 'potions' && !panel);
  if (panel === 'login') root.addChild(loginPanel(m, act, today, fit));
  else if (panel === 'tasks') root.addChild(tasksPanel(m, act, fit));
  else if (panel === 'settings') root.addChild(settingsPanel(m, act, fit, !!extras.privacy, !!extras.policy, extras.data ?? null));
  else if (panel === 'privacy') root.addChild(consentPanel(act, fit, !!extras.policy));
  else if (panel === 'language') root.addChild(languagePanel(act, fit));
  else if (panel === 'challenge') root.addChild(challengePanel(m, act, today, ads, fit));
  else if (panel === 'chapters') root.addChild(chaptersPanel(m, act, fit));
  else if (panel) root.addChild(heroPanel(m, act, panel, fit));
  return root;
}

function topBar(root: Container, m: MetaSave, act: HomeActions, today: string, left: number, w: number, wide: boolean): void {
  const y = wide ? 70 : 80;
  const button = (x: number, icon: Container, text: string, dot: boolean, onTap: () => void) => {
    const c = tappable(new Container(), onTap);
    c.position.set(x, y);
    icon.scale.set(0.72);
    // the caption sits on its own cream plate below the medal, clear of the brass rim
    const cap = fitText(ink(text, 24), 112);
    const plate = new Graphics()
      .roundRect(-cap.width / 2 - 12, -17, cap.width + 24, 34, 17)
      .fill(LIGHT.face)
      .stroke({ width: 3, color: LIGHT.edge });
    plate.y = cap.y = 74;
    c.addChild(medal(56), icon, plate, cap);
    if (dot) redDot(c, 42, -42);
    root.addChild(c);
  };
  button(left + 90, calendarIcon(), t('login'), canClaimLogin(m, today), () => act.panel('login'));
  button(left + 240, scrollIcon(), t('tasks'), tasksClaimable(m), () => act.panel('tasks'));
  button(left + 390, gearIcon(40), t('sound.settings'), false, () => act.panel('settings'));

  // the crystals in a dark inset, top right
  const count = ink(String(m.crystals), 50, { fill: LIGHT.crystal });
  const pw = Math.max(240, count.width + 120);
  const purse = new Container();
  // found by the claim animation, which flies crystals into it
  purse.label = 'purse';
  count.label = 'purseCount';
  purse.position.set(w - 40 - pw / 2, y);
  purse.addChild(
    new Graphics().roundRect(-pw / 2, -40, pw, 80, 40).fill(LIGHT.inset).stroke({ width: 4, color: LIGHT.edge }),
    gem(new Graphics(), -pw / 2 + 40, 0, 34),
  );
  count.x = 22;
  purse.addChild(count);
  root.addChild(purse);
}

/** The five tabs: along the bottom of a portrait page, down the left of a landscape one; the
 *  battle tab in the middle is a big raised medallion. */
function nav(root: Container, act: HomeActions, tab: HomeTab, fit: MenuFit, dots: Partial<Record<HomeTab, boolean>>, point = false): void {
  const { w, h, wide } = fit;
  const bar = new Graphics();
  if (wide) {
    bar.rect(0, 0, RAIL, h).fill(LIGHT.bar).rect(RAIL - 14, 0, 14, h).fill(P.brass).rect(RAIL - 14, 0, 4, h).fill(P.brassLight);
    bar.rect(RAIL, 0, 4, h).fill(LIGHT.edge);
  } else {
    bar.rect(0, h - NAV, w, NAV).fill(LIGHT.bar).rect(0, h - NAV, w, 14).fill(P.brass).rect(0, h - NAV + 2, w, 4).fill(P.brassLight);
    bar.rect(0, h - NAV - 4, w, 4).fill(LIGHT.edge);
  }
  root.addChild(bar);
  HOME_TABS.forEach((id, i) => {
    const slot = tappable(new Container(), () => act.tab(id));
    const span = wide ? h / HOME_TABS.length : w / HOME_TABS.length;
    if (wide) slot.position.set(RAIL / 2 - 6, span * (i + 0.5));
    else slot.position.set(span * (i + 0.5), h - NAV / 2 + 8);
    const on = id === tab;
    const big = id === 'battle';
    if (on && !big) {
      slot.addChild(
        new Graphics()
          .roundRect(-span / 2 + 14, -NAV / 2 + 18, span - 28, NAV - 40, 26)
          .fill({ color: P.brass, alpha: 0.25 })
          .stroke({ width: 4, color: P.brass, alpha: 0.8 }),
      );
    }
    const icon = navIcon(id);
    if (big) {
      // clear of its caption below, and in portrait of the challenge card above
      const lift = wide ? -12 : -26;
      const md = medal(92, on ? 0x3c9a4a : P.wood);
      md.y = lift - 14;
      icon.y = lift - 14;
      icon.scale.set(0.95);
      slot.addChild(md);
    } else {
      icon.y = -22;
      icon.scale.set(on ? 0.95 : 0.8);
    }
    // inside the lit tab's plate (span - 28 wide), and in the rail inside the rail
    const cap = fitText(ink(t(`tabs.${id}`), 34, { fill: on ? P.brassDark : P.ink }), Math.min(span, RAIL) - 40);
    cap.y = big ? (wide ? 108 : 74) : 58;
    slot.addChild(icon, cap);
    if (dots[id]) redDot(slot, big ? 70 : 46, big ? (wide ? -96 : -110) : -62);
    if (!on) slot.alpha = big ? 1 : 0.85;
    root.addChild(slot);
    // the pointer comes down onto the potions tab from above right, or up into its rail slot from below
    if (point && id === 'potions') {
      root.addChild(wide ? pointer(slot.x + 40, slot.y + 64, -0.6, 0.8) : pointer(slot.x + 22, slot.y - NAV / 2 + 6, Math.PI + 0.5));
    }
  });
}

/** The one-time pointer: the tutorial's hand, its fingertip at `x, y` turned by `rotation`
 *  (0 points up); the game nudges its child back and forth (label hintHand). */
function pointer(x: number, y: number, rotation: number, scale = 1): Container {
  const c = new Container();
  c.label = 'hintHand';
  c.eventMode = 'none';
  c.position.set(x, y);
  c.rotation = rotation;
  c.scale.set(scale);
  c.addChild(pointingHand());
  return c;
}

function navIcon(id: HomeTab): Container {
  if (id === 'potions') return bottle('fire', 110);
  if (id === 'workshop') return gearIcon();
  if (id === 'battle') return swordsIcon();
  if (id === 'codex') return bookIcon();
  return chestIcon();
}

// ---- tabs ----

/** The stage card (the stage to fight and the enemies it sends), the lineup, today's challenge
 *  as a slim banner, the commander, and the big button into battle low down where a thumb
 *  reaches it. */
function battleTab(root: Container, m: MetaSave, act: HomeActions, a: Area, picked: HeroKind | null, today: string): void {
  const challenge = challengeShown(m);
  const endless = endlessOpen(m);
  const banners = (challenge ? 1 : 0) + (endless ? 1 : 0);
  const lineupH = lineupHeight(m);
  if (a.wide) {
    // the stage, commander and button on the left; the lineup and the challenge on the right
    const rw = Math.min(820, a.w * 0.5);
    const rx = a.x + a.w - 40 - rw / 2;
    const lx = a.x + (a.w - rw - 40) / 2;
    stageCard(root, m, act, lx, a.y + 100, 300);
    const by = a.y + a.h - 120;
    commander(root, lx, a.y + 100 + CARD_BOTTOM + 20, by - START_H / 2 - 30);
    startButton(root, act, lx, by);
    const block = lineupH + banners * (50 + BANNER_H);
    const ly = a.y + 60 + Math.max(0, (a.h - 120 - block) / 2);
    lineupPanel(root, m, act, picked, rx, ly + lineupH / 2, rw, lineupH);
    let y = ly + lineupH + 50 + BANNER_H / 2;
    if (challenge) {
      challengeBanner(root, m, act, today, rx, y, rw);
      y += 50 + BANNER_H;
    }
    if (endless) endlessBanner(root, m, act, rx, y, rw);
  } else {
    const cx = a.x + a.w / 2;
    const pw = Math.min(960, a.w - 80);
    stageCard(root, m, act, cx, a.y + 80);
    let y = a.y + 80 + CARD_BOTTOM + 60;
    lineupPanel(root, m, act, picked, cx, y + lineupH / 2, pw, lineupH);
    y += lineupH + 40;
    if (challenge) {
      challengeBanner(root, m, act, today, cx, y + BANNER_H / 2, pw);
      y += BANNER_H + 30;
    }
    if (endless) {
      endlessBanner(root, m, act, cx, y + BANNER_H / 2, pw);
      y += BANNER_H + 30;
    }
    // clear of the battle medallion that rises out of the tab bar
    const by = a.y + a.h - 50 - START_H / 2;
    commander(root, cx, y, by - START_H / 2 - 24);
    startButton(root, act, cx, by);
  }
}

const START_H = 180;
const BANNER_H = 150;

/** How far below the plate's middle the stage card reaches, its twist tags included. */
const CARD_BOTTOM = 320;

/** The stage plate between its arrows, and under it a card with the stage's chapter (its name,
 *  a pip a stage and the progress) over the heads of the enemies it sends, the stage's twists
 *  as tags on its lower edge. Tapping the card opens the chapters. */
function stageCard(root: Container, m: MetaSave, act: HomeActions, x: number, y: number, ax = 340): void {
  const arrow = (dx: number, text: string, on: boolean, d: number) => {
    const c = tappable(new Container(), () => on && act.stage(d));
    c.position.set(x + dx, y);
    const sign = label(text, 46, { fill: on ? P.cream : P.inkSoft, stroke: { color: P.line, width: 6 } });
    c.addChild(medal(52), sign);
    if (!on) c.alpha = 0.6;
    root.addChild(c);
  };
  const kinds = ENEMY_KINDS.filter((k) => onStage(k, m.stage));
  const size = 88;
  const step = size + 12;
  const ch = chapterOf(m.stage);
  const card = tappable(new Container(), () => act.panel('chapters'));
  card.position.set(x, y + 85);
  const cw = Math.max(kinds.length * step + 30, 2 * ax + 40);
  const chh = 214;
  card.addChild(inset(cw, chh, 0, 36));
  // the chapter line: its name on the left, a pip a stage, the count on the right
  const name = ink(chapterTitle(ch), 32, { fontWeight: '900' });
  name.anchor.set(0, 0.5);
  name.position.set(-cw / 2 + 28, 38);
  const count = ink(t('chapter.progress', { n: chapterProgress(m, ch), total: CHAPTER_SIZE }), 30, { fill: P.inkSoft, fontWeight: '900' });
  count.anchor.set(1, 0.5);
  count.position.set(cw / 2 - 28, 38);
  card.addChild(name, count);
  const [first] = chapterStages(ch);
  const right = count.x - count.width - 30;
  const pstep = Math.min(30, (right - (name.x + name.width + 30)) / CHAPTER_SIZE);
  if (pstep >= 19) {
    const pips = new Graphics();
    for (let i = 0; i < CHAPTER_SIZE; i++) {
      const stage = first + i;
      const px = right - (CHAPTER_SIZE - 1 - i) * pstep - pstep / 2;
      pips.circle(px, 38, isFinale(stage) ? 10 : 7).fill(stage <= m.cleared ? P.brass : LIGHT.face).stroke({ width: stage === m.stage ? 5 : 3, color: stage === m.stage ? P.red : P.line });
    }
    card.addChild(pips);
  }
  if (anyChestWaiting(m)) redDot(card, cw / 2 - 8, 6);
  const row = new Container();
  row.position.set(0, 126);
  kinds.forEach((kind, i) => {
    const s = enemySprite(kind, size);
    s.x = (i - (kinds.length - 1) / 2) * step;
    row.addChild(s);
    if (isBoss(kind)) {
      const tag = bossTag(18);
      tag.position.set(s.x, size / 2 + 4);
      row.addChild(tag);
    }
  });
  card.addChild(row);
  const twists = stageTwists(m.stage);
  if (twists.length > 0) {
    // one twist says what it does; two only name themselves
    const tags = new Container();
    let tx = 0;
    for (const id of twists) {
      const text = twists.length === 1 ? `${t(`twist.${id}.name`)} · ${t(`twist.${id}.desc`)}` : t(`twist.${id}.name`);
      const tg = twistTag(text, id === 'finale' || id === 'elite' ? P.red : P.brassDark, cw - 60);
      tg.x = tx + tg.width / 2;
      tx += tg.width + 14;
      tags.addChild(tg);
    }
    tags.position.set(-(tx - 14) / 2, chh + 4);
    card.addChild(tags);
  }
  const p = plate(t('stage', { n: m.stage }), 64, 420);
  p.position.set(x, y);
  root.addChild(card, p);
  arrow(-ax, '◀', m.stage > 1, -1);
  arrow(ax, '▶', m.stage < maxStage(m), 1);
}

function chapterTitle(ch: number): string {
  return t('chapter.title', { n: ch, name: t(`chapter.name.${chapterInfo(ch).id}` as TextKey) });
}

/** A twist's tag on the stage card: cream text on a coloured pill, at most `max` across. */
function twistTag(text: string, color: number, max: number): Container {
  const c = new Container();
  const tx = label(text, 28, { stroke: { color: P.line, width: 5 } });
  fitText(tx, max - 40);
  const w = tx.width + 40;
  c.addChild(new Graphics().roundRect(-w / 2, -24, w, 48, 24).fill(color).stroke({ width: 4, color: P.line }), tx);
  return c;
}

function anyChestWaiting(m: MetaSave): boolean {
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) if (chestWaiting(m, ch)) return true;
  return false;
}

/** The commander standing on its shadow, as tall as the room from `top` to `feet` allows. */
function commander(root: Container, x: number, top: number, feet: number): void {
  const tex = commanderTexture();
  const h = Math.min(520, feet - top);
  if (!tex || h < 160) return;
  const s = new Sprite(tex);
  s.anchor.set(0.5, 1);
  s.scale.set(h / tex.height);
  s.position.set(x, feet);
  root.addChild(new Graphics().ellipse(x, feet - 6, h * 0.36, h * 0.07).fill({ color: 0x000000, alpha: 0.2 }), s);
}

function startButton(root: Container, act: HomeActions, x: number, y: number): void {
  const b = new PillButton(t('start'), 720, START_H, 'green', act.play, 86);
  b.position.set(x, y);
  root.addChild(b);
}

/** Today's challenge in one line: its stage, the top reward (or, once played, the best wave)
 *  and a button; the banner and the button both open the details. */
function challengeBanner(root: Container, m: MetaSave, act: HomeActions, today: string, x: number, y: number, w: number): void {
  const ch = todaysChallenge(m, today);
  const free = canPlayFree(m, today);
  const c = tappable(new Container(), () => act.panel('challenge'));
  c.position.set(x, y);
  root.addChild(c);
  c.addChild(lightPanel(w, BANNER_H));
  const icon = new Container();
  const cal = calendarIcon();
  cal.scale.set(0.5);
  icon.addChild(medal(42), cal);
  icon.position.set(-w / 2 + 84, -4);
  const bw = 220;
  const bx = w / 2 - 50 - bw / 2;
  const x0 = -w / 2 + 146;
  const room = bx - bw / 2 - 24 - x0;
  const title = ink(t('challenge.banner', { n: ch.stage }), 40, { fontWeight: '900' });
  title.anchor.set(0, 0.5);
  title.position.set(x0, -24);
  fitText(title, room);
  const sub = new Container();
  sub.position.set(x0, 26);
  if (free) {
    const top = CHALLENGE_TIERS[CHALLENGE_TIERS.length - 1].reward;
    const word = ink(t('challenge.top'), 32, { fill: P.inkSoft });
    word.anchor.set(0, 0.5);
    const n = ink(String(top), 34, { fill: LIGHT.crystal, fontWeight: '900' });
    n.anchor.set(0, 0.5);
    n.x = word.width + 48;
    sub.addChild(word, gem(new Graphics(), word.width + 26, -2, 15), n);
  } else {
    const best = ink(t('challenge.best', { n: bestToday(m, today) }), 32, { fill: P.inkSoft });
    best.anchor.set(0, 0.5);
    sub.addChild(best);
  }
  if (sub.width > room) sub.scale.set(room / sub.width);
  const go = new PillButton(free ? t('challenge.go') : t('challenge.details'), bw, 84, free ? 'green' : 'brass', () => act.panel('challenge'), 40);
  go.position.set(bx, -2);
  c.addChild(icon, title, sub, go);
}

/** Endless mode in one line, once the first chapter is cleared: the best wave and the next
 *  milestone's crystals (or what the mode is, before the first run), and the way in. */
function endlessBanner(root: Container, m: MetaSave, act: HomeActions, x: number, y: number, w: number): void {
  const c = tappable(new Container(), act.endless);
  c.position.set(x, y);
  root.addChild(c);
  c.addChild(lightPanel(w, BANNER_H));
  const icon = new Container();
  const loop = infinityIcon();
  loop.scale.set(0.62);
  icon.addChild(medal(42), loop);
  icon.position.set(-w / 2 + 84, -4);
  const bw = 220;
  const bx = w / 2 - 50 - bw / 2;
  const x0 = -w / 2 + 146;
  const room = bx - bw / 2 - 24 - x0;
  const title = ink(t('endless.title'), 40, { fontWeight: '900' });
  title.anchor.set(0, 0.5);
  title.position.set(x0, -24);
  fitText(title, room);
  const sub = new Container();
  sub.position.set(x0, 26);
  const best = m.endless.best;
  const words = ink(best > 0 ? t('endless.best', { n: best }) : t('endless.sub'), 32, { fill: P.inkSoft });
  words.anchor.set(0, 0.5);
  sub.addChild(words);
  const next = nextMilestone(m);
  if (best > 0 && next) {
    const at = words.width + 24;
    const goal = ink(t('endless.goal', { n: next.wave }), 32, { fill: P.inkSoft });
    goal.anchor.set(0, 0.5);
    goal.x = at;
    const n = ink(String(next.reward), 34, { fill: LIGHT.crystal, fontWeight: '900' });
    n.anchor.set(0, 0.5);
    n.x = at + goal.width + 48;
    sub.addChild(goal, gem(new Graphics(), at + goal.width + 26, -2, 15), n);
  }
  if (sub.width > room) sub.scale.set(room / sub.width);
  const go = new PillButton(t('endless.go'), bw, 84, 'green', act.endless, 40);
  go.position.set(bx, -2);
  c.addChild(icon, title, sub, go);
}

/** Today's challenge in full, over the page: the two modifiers, the reward tiers (those reached
 *  today ticked), the best wave and streak, and the way in: the free attempt, then the
 *  rewarded retry, then the time until the next one. */
function challengePanel(m: MetaSave, act: HomeActions, today: string, ads: boolean, fit: MenuFit): Container {
  const h = 980;
  const ch = todaysChallenge(m, today);
  const { panel, box } = frame(act, `${t('challenge.title')} · ${t('stage', { n: ch.stage })}`, h, fit);
  const top = -h / 2;
  // the modifiers, a row each
  ch.mods.forEach((id, i) => {
    const r = new Container();
    r.position.set(0, top + 170 + i * 150);
    const icon = modifierIcon(id, ch.trial);
    icon.scale.set(0.8);
    icon.x = -360;
    const name = ink(t(`challenge.mod.${id}.name`), 42, { fontWeight: '900' });
    name.anchor.set(0, 0.5);
    name.position.set(-290, -24);
    fitText(name, 680);
    const desc = ink(t(`challenge.mod.${id}.desc`, { hero: ch.trial ? t(`hero.${ch.trial}`) : '' }), 32, { fill: P.inkSoft });
    desc.anchor.set(0, 0.5);
    desc.position.set(-290, 26);
    fitText(desc, 680);
    r.addChild(lightTile(860, 130, 22), icon, name, desc);
    box.addChild(r);
  });
  // the reward tiers, side by side
  const best = bestToday(m, today);
  const reached = tierOf(best);
  const head = ink(t('challenge.rewards'), 34, { fill: P.brassDark });
  head.y = top + 440;
  box.addChild(head);
  CHALLENGE_TIERS.forEach((tier, i) => {
    const on = i < reached;
    const tw = 270;
    const r = new Container();
    r.position.set((i - 1) * (tw + 20), top + 540);
    r.addChild(new Graphics().roundRect(-tw / 2, -60, tw, 120, 24).fill(on ? 0xd4eec0 : LIGHT.inset).stroke({ width: 4, color: on ? 0x3c9a4a : LIGHT.insetEdge }));
    const wave = fitText(ink(t('challenge.wave', { n: tier.wave }), 32, { fill: on ? 0x2b6a33 : P.ink }), tw - 30);
    wave.y = -26;
    const n = ink(String(tier.reward), 40, { fill: LIGHT.crystal, fontWeight: '900' });
    n.position.set(18, 24);
    r.addChild(wave, n, gem(new Graphics(), 18 - n.width / 2 - 26, 22, 18));
    if (on) {
      const tk = tick(20);
      tk.position.set(tw / 2 - 18, -54);
      r.addChild(tk);
    }
    box.addChild(r);
  });
  // how it went so far
  const days = streak(m, today);
  const status = ink([t('challenge.best', { n: best }), ...(days > 0 ? [t('challenge.streak', { n: days })] : [])].join('   ·   '), 34, { fill: P.inkSoft });
  status.y = top + 660;
  box.addChild(fitText(status, 820));
  // the way in, or when the next one comes
  const foot = h / 2 - 130;
  if (canPlayFree(m, today)) {
    const go = new PillButton(t('challenge.go'), 520, 140, 'green', act.challenge, 60);
    go.y = foot;
    box.addChild(go);
  } else if (ads && canPlayAd(m, today)) {
    const again = new PillButton(t('challenge.retry'), 520, 140, 'purple', act.challengeAd, 52);
    const cap = again.children[1];
    cap.x = 34;
    const tv = adIcon();
    tv.scale.set(0.55);
    tv.position.set(34 - cap.width / 2 - 56, -6);
    again.addChild(tv);
    again.y = foot;
    box.addChild(again);
  } else {
    const left = ink('', 40, { fill: P.inkSoft });
    left.y = foot;
    let shown = '';
    left.onRender = () => {
      const secs = Math.ceil(msToTomorrow(new Date()) / 1000);
      const p = (v: number) => String(v).padStart(2, '0');
      const text = t('challenge.next', { time: `${p(Math.floor(secs / 3600))}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}` });
      if (text !== shown) left.text = shown = text;
    };
    box.addChild(left);
  }
  return panel;
}

/** The panel's height: a line under the tiles while there is a reserve to swap in. */
function lineupHeight(m: MetaSave): number {
  return benched(m).length > 0 ? 410 : 360;
}

/** The potions that can go into battle: the four in the lineup ticked, the reserve dimmed.
 *  Tapping one in the lineup swaps it for the reserve (or for the reserve `picked` first, when
 *  there are several). The locked ones are on the potions tab. */
function lineupPanel(root: Container, m: MetaSave, act: HomeActions, picked: HeroKind | null, x: number, y: number, w: number, h: number): void {
  const c = titledPanel(root, t('lineup'), x, y, w, h);
  const kinds = HERO_KINDS.filter((k) => heroUnlocked(m, k));
  const step = Math.min(200, (w - 50) / kinds.length);
  const cw = step - 16;
  const ch = 230;
  const cy = -h / 2 + 64 + ch / 2;
  kinds.forEach((kind, i) => {
    const fielded = m.lineup.includes(kind);
    const b = tappable(new Container(), () => act.lineup(kind));
    b.position.set((i - (kinds.length - 1) / 2) * step, cy);
    b.addChild(lightTile(cw, ch, 20));
    if (fielded) b.addChild(new Graphics().roundRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, ch - 12, 16).fill({ color: HERO_COLORS[kind], alpha: 0.25 }));
    if (kind === picked) b.addChild(new Graphics().roundRect(-cw / 2 - 6, -ch / 2 - 6, cw + 12, ch + 12, 24).stroke({ width: 8, color: P.brass }));
    const size = Math.min(140, cw - 24);
    b.addChild(new Graphics().ellipse(0, -24 + size * 0.46, size * 0.34, size * 0.08).fill({ color: 0x000000, alpha: 0.18 }));
    const bt = bottle(kind, size);
    bt.y = -24;
    const lv = ink(`Lv ${m.heroes[kind]}`, 32);
    lv.y = ch / 2 - 36;
    b.addChild(bt, lv);
    if (fielded) {
      const tick = new Container();
      tick.position.set(cw / 2 - 24, -ch / 2 + 24);
      tick.addChild(new Graphics().circle(0, 0, 24).fill(0x4cc35a).stroke({ width: 4, color: P.line }), label('✓', 30, { stroke: { color: P.line, width: 5 } }));
      b.addChild(tick);
    } else {
      b.alpha = kind === picked ? 1 : 0.7;
      // a chip in the corner the tick takes on a fielded potion, clear of the bottle
      const tag = new Container();
      const word = fitText(ink(t('bench'), 25, { fill: P.inkSoft }), cw - 40);
      const tw = word.width + 26;
      tag.position.set(cw / 2 - 8 - tw / 2, -ch / 2 + 26);
      tag.addChild(new Graphics().roundRect(-tw / 2, -20, tw, 40, 20).fill(LIGHT.inset).stroke({ width: 3, color: LIGHT.edge }), word);
      b.addChild(tag);
    }
    c.addChild(b);
  });
  if (benched(m).length > 0) {
    const hint = fitText(ink(picked ? t('lineupPick') : t('lineupHint'), 30, { fill: P.inkSoft }), w - 60);
    hint.y = h / 2 - 66;
    c.addChild(hint);
  }
}

function titledPanel(root: Container, title: string, x: number, y: number, w: number, h: number): Container {
  const c = new Container();
  c.position.set(x, y);
  const p = plate(title, 40, 280);
  p.y = -h / 2 + 4;
  c.addChild(lightPanel(w, h), p);
  root.addChild(c);
  return c;
}

/** A card per potion: portrait, level, the milestones reached and the level-up button. */
function potionsTab(root: Container, m: MetaSave, act: HomeActions, a: Area, hint: HeroKind | null): void {
  const head = plate(t('potions'), 52);
  head.position.set(a.x + a.w / 2, a.y + 60);
  root.addChild(head);
  // one row of five on a wide page; three over two on a portrait one
  const n = HERO_KINDS.length;
  const cols = a.wide ? n : 3;
  const cw = Math.min(380, (a.w - 60) / cols - 30);
  const ch = a.wide ? 650 : 640;
  HERO_KINDS.forEach((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const card = heroCard(m, act, kind, cw, ch);
    card.position.set(a.x + a.w / 2 + (col - (inRow - 1) / 2) * (cw + 30), a.y + 150 + ch / 2 + row * (ch + 40));
    root.addChild(card);
  });
  // over all the cards: up at the hinted potion's price button from below it
  const i = hint ? HERO_KINDS.indexOf(hint) : -1;
  if (i >= 0) {
    const card = root.children[root.children.length - HERO_KINDS.length + i];
    root.addChild(pointer(card.x + cw * 0.22, card.y + ch / 2 - 34, 0, 0.8));
  }
}

function heroCard(m: MetaSave, act: HomeActions, kind: HeroKind, cw: number, ch: number): Container {
  const lv = m.heroes[kind];
  const open = heroUnlocked(m, kind);
  const c = tappable(new Container(), () => act.panel(kind));
  const top = -ch / 2;
  c.addChild(paperCard(cw, ch));
  c.addChild(new Graphics().roundRect(-cw / 2 + 10, top + 10, cw - 20, 84, 18).fill(open ? HERO_COLORS[kind] : 0x8a7d6a).stroke({ width: 4, color: LIGHT.edge }));
  const name = fitText(label(t(`hero.${kind}`), 42, { stroke: { color: P.line, width: 7 } }), cw - 40);
  name.y = top + 50;
  const size = Math.min(250, cw - 40);
  const glow = new Graphics().circle(0, top + 250, size * 0.48).fill({ color: HERO_COLORS[kind], alpha: open ? 0.18 : 0 });
  const bt = open ? bottle(kind, size) : flask(new Graphics(), 0, size * 0.42, size * 0.84, 0x8a7d6a);
  bt.y = top + 250;
  c.addChild(name, glow, bt);
  if (!open) {
    const l = lock(P.cream, 0x8a7d6a);
    l.scale.set(1.4);
    l.y = top + 270;
    const at = unlockStage(kind);
    const note = fitText(ink(at ? t('unlockAt', { n: at }) : t('codex.locked'), 36, { fill: P.inkSoft }), cw - 40);
    note.y = top + 440;
    c.addChild(l, note);
    c.alpha = 0.85;
    return c;
  }
  const level = ink(`Lv ${lv}`, 50);
  level.y = top + 404;
  const dmg = fitText(ink(t('damageNow', { p: Math.round((heroDamage(lv) - 1) * 100) }), 30, { fill: P.inkSoft }), cw - 30);
  dmg.y = top + 450;
  c.addChild(level, dmg);
  // the milestones as pips, lit once reached
  const ms = MILESTONES[kind];
  const gap = Math.min(76, (cw - 30) / Math.max(1, ms.length));
  const pw = Math.min(64, gap - 8);
  ms.forEach((s, i) => {
    const on = lv >= s.level;
    const pip = new Container();
    pip.position.set((i - (ms.length - 1) / 2) * gap, top + 504);
    pip.addChild(new Graphics().roundRect(-pw / 2, -20, pw, 40, 12).fill(on ? P.brass : P.paperDark).stroke({ width: 4, color: on ? P.line : P.inkSoft }));
    pip.addChild(ink(String(s.level), 26, { fill: on ? P.line : P.inkSoft }));
    c.addChild(pip);
  });
  const cost = heroCost(lv);
  if (cost === null) {
    const max = ink(t('maxed'), 46, { fill: P.brassDark });
    max.y = ch / 2 - 64;
    c.addChild(max);
  } else {
    const b = priced(new PillButton(String(cost), cw - 90, 84, 'purple', () => act.hero(kind), 42, true), m.crystals >= cost);
    b.y = ch / 2 - 54;
    c.addChild(b);
  }
  return c;
}

/** A crystal-price button, off while the crystals fall short; a tap on it then says so. */
function priced(b: PillButton, affordable: boolean): PillButton {
  return b.setEnabled(affordable).whenOff(() => refuse(b, t('noCrystals')));
}

/** A row per upgrade: its level as pips, what it gives now and what the next level adds, and
 *  the button that buys it. The rows share the page's height. */
function workshopTab(root: Container, m: MetaSave, act: HomeActions, a: Area): void {
  const head = plate(t('workshop'), 52);
  head.position.set(a.x + a.w / 2, a.y + 60);
  root.addChild(head);
  const rw = Math.min(a.wide ? 1100 : 960, a.w - 80);
  const gap = 30;
  const rh = Math.max(230, Math.min(a.wide ? 260 : 330, (a.h - 170 - gap * 2) / 3));
  const y0 = a.y + 140 + rh / 2 + Math.max(0, (a.h - 170 - 3 * rh - 2 * gap) / 4);
  WORKSHOP_IDS.forEach((id, i) => {
    const lv = m.workshop[id];
    const max = BALANCE.meta.workshop[id].max;
    const cost = workshopCost(id, lv);
    const effect = (level: number) => {
      const v = workshopValue(id, level);
      return t(`shop.${id}.desc`, { p: Math.round(v * 100), n: v });
    };
    const r = new Container();
    r.position.set(a.x + a.w / 2, y0 + i * (rh + gap));
    r.addChild(paperCard(rw, rh));
    const icon = new Container();
    icon.addChild(medal(62, P.paperDark), shopIcon(id));
    icon.x = -rw / 2 + 90;
    icon.scale.set(rh >= 280 ? 1.15 : 1);
    const x0 = -rw / 2 + 190;
    const bx = rw / 2 - 150;
    const room = bx - 125 - 24 - x0;
    // the name and level, the level pips, then what it gives now and what the next level gives
    const top = -104;
    const n = ink(t(`shop.${id}.name`), 46);
    n.anchor.set(0, 0.5);
    n.position.set(x0, top + 20);
    const lvTag = ink(`Lv ${lv}/${max}`, 32, { fill: P.inkSoft });
    lvTag.anchor.set(0, 0.5);
    lvTag.position.set(x0 + n.width + 18, top + 24);
    const pips = new Graphics();
    const pw = Math.min(36, (room + 8) / max - 8);
    for (let k = 0; k < max; k++) {
      pips.roundRect(x0 + k * (pw + 8), top + 62, pw, 22, 8).fill(k < lv ? P.brass : LIGHT.inset).stroke({ width: 3, color: k < lv ? LIGHT.edge : LIGHT.insetEdge });
    }
    // nothing bought yet reads as such, not as "+0"
    const now = ink(t('shop.now', { text: lv > 0 ? effect(lv) : t('shop.none') }), 30, { fill: P.inkSoft });
    now.anchor.set(0, 0.5);
    now.position.set(x0, top + 124);
    fitText(now, room);
    r.addChild(icon, n, lvTag, pips, now);
    if (cost === null) {
      const done = ink(t('maxed'), 46, { fill: P.brassDark });
      done.x = bx;
      r.addChild(done);
    } else {
      const next = ink(t('shop.next', { text: effect(lv + 1) }), 30, { fill: 0x2b6a33, fontWeight: '900' });
      next.anchor.set(0, 0.5);
      next.position.set(x0, top + 170);
      fitText(next, room);
      const b = priced(new PillButton(String(cost), 250, 100, 'purple', () => act.workshop(id), 44, true), m.crystals >= cost);
      b.position.set(bx, -4);
      r.addChild(next, b);
    }
    root.addChild(r);
  });
}

/** The shop: the free daily chest and the rewarded ad for crystals, then the potions, the
 *  locked ones for sale. Stacked on a portrait page, side by side on a landscape one. Where the
 *  ad-free card is sold (iOS) a strip for it goes on top. */
function shopTab(root: Container, m: MetaSave, act: HomeActions, a: Area, today: string, ads: boolean, adFree: HomeExtras['adFree'] | null): void {
  let top = a.y + 60;
  const bottom = a.y + a.h - 40;
  if (adFree) {
    const sw = Math.min(a.wide ? 1500 : 960, a.w - 80);
    adFreeStrip(root, act, adFree, a.x + a.w / 2, top + STRIP_H / 2, sw);
    top += STRIP_H + 30;
  }
  if (a.wide) {
    const gap = 40;
    const dw = Math.min(780, (a.w - 3 * gap) * 0.46);
    const uw = a.w - 3 * gap - dw;
    const ph = bottom - top;
    dailyPanel(root, m, act, today, ads, a.x + gap + dw / 2, top + ph / 2, dw, ph);
    unlockPanel(root, m, act, a.x + 2 * gap + dw + uw / 2, top + ph / 2, uw, ph, 3);
  } else {
    const pw = Math.min(960, a.w - 80);
    const gap = 60;
    // the potion tiles are narrow here: the chest and the ad take the height they leave
    const uh = Math.min(640, Math.round((bottom - top - gap) * 0.5));
    const dh = bottom - top - gap - uh;
    dailyPanel(root, m, act, today, ads, a.x + a.w / 2, top + dh / 2, pw, dh);
    unlockPanel(root, m, act, a.x + a.w / 2, bottom - uh / 2, pw, uh, HERO_KINDS.length);
  }
}

const STRIP_H = 200;

/** The ad-free card: what it does, its price (or owned) and Restore, in one strip. */
function adFreeStrip(root: Container, act: HomeActions, info: NonNullable<HomeExtras['adFree']>, x: number, y: number, w: number): void {
  const c = new Container();
  c.position.set(x, y);
  const left = -w / 2;
  const icon = noAdsIcon();
  icon.position.set(left + 100, 0);
  const textX = left + 190;
  const textW = w - 190 - 360;
  const name = fitText(ink(t('store.adFree.name'), 44), textW);
  name.anchor.set(0, 0.5);
  name.position.set(textX, -50);
  const line = info.note ?? t('store.adFree.desc');
  const desc = fitText(ink(line, 28, { fill: info.note ? P.brassDark : P.inkSoft }), textW);
  desc.anchor.set(0, 0.5);
  desc.position.set(textX, 4);
  c.addChild(lightPanel(w, STRIP_H), icon, name, desc);
  const bx = w / 2 - 190;
  if (info.owned) {
    const tk = tick(30);
    tk.position.set(bx - 70, 0);
    const owned = ink(t('store.owned'), 40, { fill: 0x2b7c36 });
    owned.anchor.set(0, 0.5);
    owned.position.set(bx - 26, -2);
    c.addChild(tk, owned);
  } else {
    const buy = new PillButton(info.price ?? '…', 300, 100, 'green', act.buyAdFree, 46).setEnabled(info.price !== null);
    buy.x = bx;
    // Restore, as a link under the line: App Review wants it where the purchase is
    const restore = tappable(fitText(ink(t('store.adFree.restore'), 28, { fill: P.brassDark }), textW), act.restoreAdFree);
    restore.anchor.set(0, 0.5);
    restore.position.set(textX, 56);
    c.addChild(buy, restore);
  }
  root.addChild(c);
}

/** The ad icon's screen with a red bar across it. */
function noAdsIcon(): Container {
  const c = new Container();
  const bar = new Graphics()
    .circle(0, 0, 66)
    .stroke({ width: 12, color: P.red })
    .moveTo(-46, -46)
    .lineTo(46, 46)
    .stroke({ width: 12, color: P.red, cap: 'round' });
  c.addChild(new Graphics().circle(0, 0, 70).fill({ color: P.brass, alpha: 0.18 }), adIcon(), bar);
  c.scale.set(0.9);
  return c;
}

/** Today's free chest and the ad for crystals, as two cards side by side. */
function dailyPanel(root: Container, m: MetaSave, act: HomeActions, today: string, ads: boolean, x: number, y: number, w: number, h: number): void {
  const c = titledPanel(root, t('store.daily'), x, y, w, h);
  const cw = (w - 110) / 2;
  const ch = h - 130;
  const bw = cw - 60;
  const ready = chestReady(m, today);
  const left = adsLeft(m, today);
  const chest = offerCard(cw, ch, chestIcon(), t('store.chest.name'), t('store.chest.desc'), CHEST_CRYSTALS, !ready);
  const open: PillButton = new PillButton(ready ? t('store.open') : t('tomorrow'), bw, 100, 'green', () => act.claimChest(open), ready ? 46 : 34).setEnabled(ready);
  open.y = ch / 2 - 74;
  chest.addChild(open);
  const can = ads && left > 0;
  const ad = offerCard(cw, ch, adIcon(), t('store.ad.name'), t('store.ad.desc', { n: left, total: ADS_PER_DAY }), AD_CRYSTALS, left === 0);
  const caption = !ads ? t('store.noAds') : left > 0 ? t('store.watch') : t('tomorrow');
  const watch = new PillButton(caption, bw, 100, 'green', act.watchAd, can ? 46 : 34).setEnabled(can);
  watch.y = ch / 2 - 74;
  ad.addChild(watch);
  chest.position.set(-(cw + 30) / 2, 30);
  ad.position.set((cw + 30) / 2, 30);
  c.addChild(chest, ad);
}

/** A green tick in a circle, for something done or owned. */
function tick(r: number): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, r).fill(0x4cc35a).stroke({ width: 4, color: LIGHT.edge }), label('✓', r * 1.25, { stroke: { color: LIGHT.edge, width: 5 } }));
  return c;
}

/** A card with an icon, a name, a line under it and the crystals it pays, for a button along
 *  its bottom; `done` dims it and ticks it. */
function offerCard(cw: number, ch: number, icon: Container, name: string, desc: string, crystals: number, done: boolean): Container {
  const c = new Container();
  const top = -ch / 2;
  c.addChild(lightTile(cw, ch, 26));
  // the icon takes what the text and the button leave
  const room = Math.max(90, ch - 360);
  const art = new Container();
  icon.scale.set(1.3);
  art.addChild(new Graphics().circle(0, 0, 84).fill({ color: P.brass, alpha: 0.18 }), icon);
  art.scale.set(Math.min(1.2, room / 180));
  art.y = top + 24 + room / 2;
  const n = fitText(ink(name, 40), cw - 40);
  n.y = top + 60 + room;
  const d = fitText(ink(desc, 28, { fill: P.inkSoft }), cw - 40);
  d.y = n.y + 50;
  // the crystals, gem first, the pair centred
  const pay = new Container();
  const amount = ink(t('reward', { n: crystals }), 50, { fill: LIGHT.crystal });
  amount.x = 24;
  pay.addChild(gem(new Graphics(), 24 - amount.width / 2 - 32, 0, 26), amount);
  pay.y = d.y + 72;
  c.addChild(art, n, d, pay);
  if (done) {
    art.alpha = 0.5;
    pay.alpha = 0.5;
    const tk = tick(26);
    tk.position.set(cw / 2 - 40, top + 40);
    c.addChild(tk);
  }
  return c;
}

/** Every potion: the open ones marked owned, the locked ones with their crystal price and the
 *  stage that would open them anyway. `cols` tiles to a row. */
function unlockPanel(root: Container, m: MetaSave, act: HomeActions, x: number, y: number, w: number, h: number, cols: number): void {
  const c = titledPanel(root, t('store.unlocks'), x, y, w, h);
  const n = HERO_KINDS.length;
  const rows = Math.ceil(n / cols);
  const gap = 20;
  const step = Math.min(250, (w - 60) / cols);
  const tw = step - gap;
  // room for the title plate above the tiles and the hint under them
  const hintH = 70;
  const th = Math.min(440, (h - 140 - hintH - gap * (rows - 1)) / rows);
  const y0 = -h / 2 + 90 + th / 2;
  // every name at one size: the one the longest needs to fit its tile
  // and when one is too long for its tile, every name on two lines, word under word
  const twoLines = HERO_KINDS.some((k) => {
    const x = ink(t(`hero.${k}`), 30);
    const over = x.width > tw - 20;
    x.destroy();
    return over;
  });
  const names = HERO_KINDS.map((k) => ink(unlockName(k, twoLines), 30, { lineHeight: 32 }));
  const nameScale = Math.min(1, ...names.map((x) => (tw - 20) / x.width));
  names.forEach((x) => x.destroy());
  HERO_KINDS.forEach((kind, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const tile = unlockTile(m, act, kind, tw, th, nameScale, twoLines);
    tile.position.set(((i % cols) - (inRow - 1) / 2) * step, y0 + row * (th + gap));
    c.addChild(tile);
  });
  const hint = fitText(ink(t('store.unlockHint'), 30, { fill: P.inkSoft }), w - 80);
  hint.y = y0 + (rows - 1) * (th + gap) + th / 2 + hintH / 2;
  c.addChild(hint);
}

function unlockName(kind: HeroKind, twoLines: boolean): string {
  const name = t(`hero.${kind}`);
  return twoLines ? name.replace(' ', '\n') : name;
}

function unlockTile(m: MetaSave, act: HomeActions, kind: HeroKind, tw: number, th: number, nameScale: number, twoLines: boolean): Container {
  const open = heroUnlocked(m, kind);
  const price = unlockPrice(kind);
  const c = new Container();
  const top = -th / 2;
  c.addChild(lightTile(tw, th, 22));
  const name = ink(unlockName(kind, twoLines), 30, { lineHeight: 32 });
  name.scale.set(nameScale);
  const head = twoLines ? 92 : 60;
  name.y = top + head / 2 + 4;
  c.addChild(name);
  // the bottle fills what the name and the price leave
  const band = th - head - (open ? 90 : 170);
  const size = Math.min(170, tw - 40, band - 10);
  const by = top + head + band / 2;
  if (open) {
    c.addChild(new Graphics().circle(0, by, size * 0.46).fill({ color: HERO_COLORS[kind], alpha: 0.16 }));
    const bt = bottle(kind, size);
    bt.y = by;
    const owned = new Container();
    owned.y = th / 2 - 56;
    const word = ink(t('store.owned'), 30, { fill: 0x2f7a3a });
    word.x = 22;
    const tk = tick(18);
    tk.x = 22 - word.width / 2 - 30;
    owned.addChild(tk, word);
    // the tick and the word together stay inside a narrow tile
    owned.scale.set(Math.min(1, (tw - 16) / (word.width + 60)));
    c.addChild(bt, owned);
    return c;
  }
  const art = new Container();
  art.addChild(flask(new Graphics(), 0, size * 0.42, size * 0.84, 0x8a7d6a));
  const l = lock(P.cream, 0x8a7d6a);
  l.y = size * 0.1;
  art.addChild(l);
  const at = unlockStage(kind);
  // the stage that opens it anyway, over two lines rather than shrunk on a narrow tile
  const note = fitText(inkWrapped(at ? t('unlockAt', { n: at }) : t('codex.locked'), tw < 160 ? 23 : 26, tw - 24, { fill: P.inkSoft, lineHeight: tw < 160 ? 27 : 30 }), tw - 16);
  note.anchor.set(0.5, 1);
  note.y = th / 2 - 106;
  // the locked flask keeps to the room the name and a long note leave, e.g. four English lines on six tiles
  const from = top + head + 4;
  const to = note.y - note.height - 8;
  const box = art.getLocalBounds();
  const k = Math.min(1, (to - from) / box.height);
  art.scale.set(k);
  art.y = k === 1 && by + box.y + box.height <= to ? by : (from + to) / 2 - (box.y + box.height / 2) * k;
  c.addChild(art, note);
  if (price !== null) {
    const b = priced(new PillButton(String(price), tw - 20, 84, 'purple', () => act.unlock(kind), tw < 160 ? 30 : 38, true), m.crystals >= price);
    b.y = th / 2 - 58;
    c.addChild(b);
  }
  return c;
}

/** A little screen with a play sign: the rewarded ad. */
function adIcon(): Graphics {
  return new Graphics()
    .rect(-14, 34, 28, 12)
    .fill(P.brassDark)
    .roundRect(-30, 42, 60, 12, 5)
    .fill(P.brass)
    .stroke({ width: 3, color: LIGHT.edge })
    .roundRect(-52, -38, 104, 76, 14)
    .fill(P.woodLight)
    .stroke({ width: 5, color: LIGHT.edge })
    .roundRect(-42, -28, 84, 56, 8)
    .fill(0xbfe3f2)
    .poly([-12, -16, 18, 0, -12, 16])
    .fill(P.cream)
    .stroke({ width: 4, color: LIGHT.edge, join: 'round' });
}

function shopIcon(id: WorkshopId): Container {
  if (id === 'wall') return wallIcon();
  if (id === 'startGold') return coinsIcon();
  return gem(new Graphics(), 0, 0, 38);
}

// ---- panels over the page ----

/** A framed panel in the middle of the page, shrunk to fit a short one; tapping outside it
 *  closes it. */
function frame(act: HomeActions, title: string, h: number, fit: MenuFit): { panel: Container; box: Container } {
  const p = new Container();
  const shade = new Graphics().rect(0, 0, fit.w, fit.h).fill({ color: 0x3a2614, alpha: 0.45 });
  shade.eventMode = 'static';
  shade.on('pointertap', () => act.panel(null));
  const box = new Container();
  box.position.set(fit.w / 2, fit.h / 2 + 20);
  box.scale.set(Math.min(1, (fit.h - 80) / (h + 60)));
  const bg = lightPanel(940, h);
  bg.eventMode = 'static'; // taps on the panel itself do not close it
  const head = plate(title, 54, 420);
  head.y = -h / 2 + 6;
  const close = tappable(new Container(), () => act.panel(null));
  close.position.set(440, -h / 2 + 10);
  close.addChild(medal(46, P.red), label('✕', 40, { stroke: { color: P.line, width: 6 } }));
  box.addChild(bg, head, close);
  p.addChild(shade, box);
  return { panel: p, box };
}

/** The five chapters, a row each: the name, the one-time chest (its button once every stage is
 *  cleared) and a tile a stage - cleared ones brass, the finale red, the chosen one ringed, a dot
 *  on a stage with a twist; a chapter not open yet says what opens it. Tapping an open stage
 *  picks it. */
function chaptersPanel(m: MetaSave, act: HomeActions, fit: MenuFit): Container {
  const rowH = 186;
  const h = CHAPTER_COUNT * (rowH + 14) + 130;
  const { panel, box } = frame(act, t('chapter.panel'), h, fit);
  const top = -h / 2 + 90;
  for (let ch = 1; ch <= CHAPTER_COUNT; ch++) {
    const r = new Container();
    r.position.set(0, top + (ch - 1) * (rowH + 14) + rowH / 2);
    box.addChild(r);
    r.addChild(lightTile(860, rowH, 26));
    const open = chapterOpen(m, ch);
    const [first] = chapterStages(ch);
    const name = ink(chapterTitle(ch), 38, { fontWeight: '900' });
    name.anchor.set(0, 0.5);
    name.position.set(-400, -50);
    fitText(name, 470);
    r.addChild(name);
    const waiting = chestWaiting(m, ch);
    const opened = m.chapterChests.includes(ch);
    const icon = chestIcon();
    icon.scale.set(0.5);
    icon.position.set(130, -46);
    if (!waiting && !opened) icon.alpha = 0.55;
    r.addChild(icon);
    if (waiting) {
      const b: PillButton = new PillButton(t('chapter.chestOpen'), 210, 72, 'green', () => act.claimChapter(ch, b), 36);
      b.position.set(290, -50);
      r.addChild(b);
      redDot(r, 392, -82);
    } else if (opened) {
      const done = ink(t('chapter.chestDone'), 32, { fill: P.inkSoft, fontWeight: '900' });
      done.anchor.set(0, 0.5);
      done.position.set(180, -50);
      r.addChild(done);
    } else {
      const g = gem(new Graphics(), 196, -50, 22);
      const n = ink(String(chapterChest(ch)), 32, { fill: LIGHT.crystal, fontWeight: '900' });
      n.anchor.set(0, 0.5);
      n.position.set(224, -50);
      const c = ink(`${chapterProgress(m, ch)}/${CHAPTER_SIZE}`, 32, { fill: P.inkSoft, fontWeight: '900' });
      c.anchor.set(1, 0.5);
      c.position.set(400, -50);
      r.addChild(g, n, c);
    }
    if (!open) {
      name.alpha = 0.6;
      const text = ink(t('chapter.locked', { n: first - 1 }), 34, { fill: P.inkSoft, fontWeight: '900' });
      text.position.set(24, 36);
      const l = lock();
      l.scale.set(0.6);
      l.position.set(text.x - text.width / 2 - 36, 36);
      r.addChild(text, l);
      continue;
    }
    for (let i = 0; i < CHAPTER_SIZE; i++) {
      const stage = first + i;
      const can = stage <= maxStage(m);
      const tile = tappable(new Container(), () => can && act.pickStage(stage));
      tile.position.set(-351 + i * 78, 36);
      const finale = isFinale(stage);
      const cleared = stage <= m.cleared;
      const g = new Graphics().roundRect(-34, -34, 68, 68, 16).fill(cleared ? (finale ? 0xd0644f : P.brass) : LIGHT.face).stroke({ width: 4, color: P.line });
      if (stage === m.stage) g.roundRect(-42, -42, 84, 84, 22).stroke({ width: 6, color: P.red });
      const n = cleared ? label(String(stage), 30, { stroke: { color: P.line, width: 5 } }) : ink(String(stage), 30, { fill: P.inkSoft, fontWeight: '900' });
      tile.addChild(g, n);
      if (stageTwists(stage).length > 0) tile.addChild(new Graphics().circle(26, -26, 9).fill(finale ? P.red : P.brassDark).stroke({ width: 3, color: P.line }));
      if (!can) tile.alpha = 0.45;
      r.addChild(tile);
    }
  }
  return panel;
}

/** The seven days of the login track: claimed ones ticked, today's lit up. */
function loginPanel(m: MetaSave, act: HomeActions, today: string, fit: MenuFit): Container {
  const h = 820;
  const { panel, box } = frame(act, t('login'), h, fit);
  const can = canClaimLogin(m, today);
  let done = loginDay(m);
  if (!can && done === 0 && m.daily.claims > 0) done = 7;
  for (let i = 0; i < 7; i++) {
    // four days on the first row; days five and six, then the big seventh, on the second
    const last = i === 6;
    const w = last ? 400 : 190;
    const tile = new Container();
    tile.position.set(last ? 210 : -315 + (i % 4) * 210, i < 4 ? -190 : 70);
    const lit = can && i === done;
    tile.addChild(lightTile(w, 220, 24));
    if (lit) tile.addChild(new Graphics().roundRect(-w / 2 - 6, -116, w + 12, 232, 28).stroke({ width: 8, color: P.brass }));
    const day = ink(t('day', { n: i + 1 }), 34, { fill: lit ? P.brassDark : P.inkSoft });
    day.position.set(0, -76);
    const amount = ink(String(loginReward(i)), 40);
    amount.position.set(0, 72);
    tile.addChild(gem(new Graphics(), 0, -6, last ? 50 : 38), day, amount);
    if (i < done) {
      tile.alpha = 0.6;
      const tick = label('✓', 90, { fill: 0x5cc66a, stroke: { color: P.line, width: 8 } });
      tick.position.set(0, -6);
      tile.addChild(tick);
    }
    box.addChild(tile);
  }
  const claim: PillButton = new PillButton(can ? t('claim') : t('tomorrow'), 520, 140, 'green', () => act.claimLogin(claim), 52).setEnabled(can);
  claim.position.set(0, h / 2 - 110);
  box.addChild(claim);
  return panel;
}

/** Today's three tasks: what to do, how far along, and the claim button; then the bonus for
 *  claiming all three. */
function tasksPanel(m: MetaSave, act: HomeActions, fit: MenuFit): Container {
  const h = 870;
  const { panel, box } = frame(act, t('tasks'), h, fit);
  m.daily.tasks.forEach((task, i) => {
    const r = new Container();
    r.position.set(0, -255 + i * 190);
    const goal = taskGoal(task.id);
    const desc = ink(t(`task.${task.id}`, { n: goal }), 40);
    desc.anchor.set(0, 0.5);
    desc.position.set(-400, -36);
    const frac = Math.min(1, task.progress / goal);
    const bar = new Graphics()
      .roundRect(-400, 14, 420, 34, 17)
      .fill(P.paperDark)
      .roundRect(-400, 14, Math.max(34, 420 * frac), 34, 17)
      .fill({ color: 0x5cc66a, alpha: frac > 0 ? 1 : 0 })
      .roundRect(-400, 14, 420, 34, 17)
      .stroke({ width: 4, color: P.line });
    const count = label(`${task.progress}/${goal}`, 28, { stroke: { color: P.line, width: 6 } });
    count.position.set(-190, 31);
    r.addChild(lightTile(860, 160), desc, bar, count);
    if (task.claimed) {
      const c = ink(t('claimed'), 40, { fill: P.inkSoft });
      c.position.set(270, 0);
      r.addChild(c);
    } else {
      const b: PillButton = new PillButton(String(taskReward(task.id)), 250, 100, 'green', () => act.claimTask(i, b), 44, true).setEnabled(taskDone(task));
      b.position.set(270, -4);
      r.addChild(b);
    }
    box.addChild(r);
  });
  box.addChild(bonusRow(m, act));
  return panel;
}

/** The chest for claiming all of today's tasks: how many are claimed, and its button. */
function bonusRow(m: MetaSave, act: HomeActions): Container {
  const r = new Container();
  r.position.set(0, 330);
  const icon = chestIcon();
  icon.scale.set(0.8);
  icon.position.set(-360, 0);
  const n = m.daily.tasks.filter((task) => task.claimed).length;
  // clear of the claim button, which starts at x 145
  const name = fitText(ink(t('allDone'), 40), 415);
  name.anchor.set(0, 0.5);
  name.position.set(-290, -22);
  const sub = ink(t('allDoneCount', { n, total: m.daily.tasks.length }), 30, { fill: P.inkSoft });
  sub.anchor.set(0, 0.5);
  sub.position.set(-290, 28);
  r.addChild(paperCard(860, 140), icon, name, sub);
  if (m.daily.bonus) {
    const c = ink(t('claimed'), 40, { fill: P.inkSoft });
    c.position.set(270, 0);
    r.addChild(c);
  } else {
    const b: PillButton = new PillButton(String(ALL_DONE_BONUS), 250, 100, 'green', () => act.claimBonus(b), 44, true).setEnabled(bonusReady(m));
    b.position.set(270, -4);
    r.addChild(b);
  }
  return r;
}

/** The player ID tile's height under the play data switch. */
const ID_H = 190;

/** The settings: the music and sound effects toggles, the language and the play data switch with
 *  the player ID, then a button each for Google's consent form again where it applies (iOS in
 *  the EEA/UK) and our privacy policy where the host allows a link out (App Review 5.1.1 wants
 *  it inside the app). */
function settingsPanel(m: MetaSave, act: HomeActions, fit: MenuFit, privacy: boolean, policy: boolean, data: PlayData | null): Container {
  const buttons: [string, () => void][] = [];
  if (privacy) buttons.push([t('sound.privacy'), act.adPrivacy]);
  if (policy) buttons.push([t('sound.policy'), act.privacyPolicy]);
  const extra = buttons.length ? 30 + buttons.length * 130 : 0;
  const rows = data ? 190 + ID_H + 20 : 0;
  const h = 750 + extra + rows;
  const { panel, box } = frame(act, t('sound.settings'), h, fit);
  const top = -h / 2 + 200 - (extra ? 10 : 0);
  buttons.forEach(([text, tap], i) => {
    const b = new PillButton(text, 600, 100, 'brass', tap, 40);
    b.y = h / 2 - 100 - (buttons.length - 1 - i) * 130;
    box.addChild(b);
  });
  (['music', 'sfx'] as const).forEach((which, i) => {
    const on = m.sound[which];
    const r = tappable(new Container(), () => act.sound(which));
    r.position.set(0, top + i * 190);
    const icon = new Container();
    icon.position.set(-330, 0);
    icon.addChild(medal(56, on ? 0x3c9a4a : P.wood), which === 'music' ? noteIcon() : speakerIcon(on));
    const name = ink(t(`sound.${which}`), 50);
    name.anchor.set(0, 0.5);
    name.position.set(-245, -4);
    fitText(name, 300);
    const sw = toggle(on);
    sw.position.set(255, -4);
    r.addChild(lightTile(860, 160), icon, name, sw);
    box.addChild(r);
  });
  // the language: its own name on a button that opens the picker
  const r = tappable(new Container(), () => act.panel('language'));
  r.position.set(0, top + 2 * 190);
  const icon = new Container();
  icon.position.set(-330, 0);
  icon.addChild(medal(56, P.wood), globeIcon());
  const name = ink(t('sound.language'), 50);
  name.anchor.set(0, 0.5);
  name.position.set(-245, -4);
  fitText(name, 300);
  const pick = new PillButton(localeName(getLocale()), 300, 96, 'brass', () => act.panel('language'), 40);
  pick.position.set(255, -4);
  r.addChild(lightTile(860, 160), icon, name, pick);
  box.addChild(r);
  if (data) playDataRows(box, act, data, top + 3 * 190);
  return panel;
}

/** The play statistics switch at `y`, and under it the player ID with how to use it and, where
 *  the host has a clipboard, a button that copies it. */
function playDataRows(box: Container, act: HomeActions, data: PlayData, y: number): void {
  const r = tappable(new Container(), () => act.shareData(!data.sending));
  r.position.set(0, y);
  const icon = new Container();
  icon.position.set(-330, 0);
  icon.addChild(medal(56, data.sending ? 0x3c9a4a : P.wood), chartIcon());
  const name = ink(t('privacy.setting'), 50);
  name.anchor.set(0, 0.5);
  name.position.set(-245, -4);
  fitText(name, 300);
  const sw = toggle(data.sending);
  sw.position.set(255, -4);
  r.addChild(lightTile(860, 160), icon, name, sw);
  box.addChild(r);

  const tile = new Container();
  tile.position.set(0, y + 80 + 20 + ID_H / 2);
  tile.addChild(lightTile(860, ID_H));
  const copy = data.id && data.copy;
  const textW = copy ? 560 : 800;
  if (!data.id) {
    // nothing sent yet: just say so, in the middle of the tile
    const none = inkWrapped(t('privacy.noId'), 32, 780);
    none.anchor.set(0.5);
    tile.addChild(none);
  } else {
    const id = ink(t('privacy.id', { id: data.id }), 32);
    id.anchor.set(0, 0.5);
    id.position.set(-400, -ID_H / 2 + 42);
    fitText(id, textW);
    tile.addChild(id);
    const help = inkWrapped(t('privacy.idHelp'), 26, textW, { fill: P.inkSoft, align: 'left' });
    help.anchor.set(0, 0);
    help.position.set(-400, -ID_H / 2 + 72);
    tile.addChild(help);
  }
  if (copy) {
    const done = data.note === 'copied';
    const caption = done ? t('privacy.copied') : data.note === 'failed' ? t('privacy.copyFailed') : t('privacy.copy');
    const b = new PillButton(caption, 230, 96, done ? 'green' : 'brass', act.copyId, 36);
    b.position.set(295, 0);
    tile.addChild(b);
  }
  box.addChild(tile);
}

/** The question to a player in the EEA, the UK or Switzerland, once per session from the first
 *  home screen on: send play statistics or not. Closing it (the ✕, a tap beside it) answers
 *  nothing, and nothing is sent. */
function consentPanel(act: HomeActions, fit: MenuFit, policy: boolean): Container {
  const text = inkWrapped(t('privacy.ask'), 40, 820);
  const h = 110 + text.height + 60 + 120 + (policy ? 120 : 0) + 50;
  const { panel, box } = frame(act, t('privacy.title'), h, fit);
  text.anchor.set(0.5, 0);
  text.y = -h / 2 + 110;
  box.addChild(text);
  const row = text.y + text.height + 60 + 60;
  const allow = new PillButton(t('privacy.allow'), 380, 120, 'green', () => act.shareData(true), 48);
  allow.position.set(-205, row);
  const decline = new PillButton(t('privacy.decline'), 380, 120, 'brass', () => act.shareData(false), 44);
  decline.position.set(205, row);
  box.addChild(allow, decline);
  if (policy) {
    const link = tappable(new Container(), act.privacyPolicy);
    const word = ink(t('sound.policy'), 36, { fill: P.brassDark });
    const line = new Graphics().rect(-word.width / 2, 22, word.width, 3).fill(P.brassDark);
    link.addChild(word, line);
    link.position.set(0, row + 125);
    box.addChild(link);
  }
  return panel;
}

/** Three rising bars: play statistics. */
function chartIcon(): Graphics {
  return new Graphics()
    .roundRect(-26, 2, 14, 22, 3)
    .roundRect(-7, -10, 14, 34, 3)
    .roundRect(12, -24, 14, 48, 3)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line });
}

/** Every language by its own name, two to a row, the one in use green; a pick closes it. */
function languagePanel(act: HomeActions, fit: MenuFit): Container {
  const rows = Math.ceil(LOCALES.length / 2);
  const h = rows * 124 + 150;
  const { panel, box } = frame(act, t('sound.language'), h, fit);
  LOCALES.forEach((l, i) => {
    const b = new PillButton(localeName(l), 400, 100, l === getLocale() ? 'green' : 'brass', () => act.language(l), 42);
    b.position.set(i % 2 ? 210 : -210, -h / 2 + 140 + Math.floor(i / 2) * 124);
    box.addChild(b);
  });
  return panel;
}

/** A globe: the rim, the equator and two meridians. */
function globeIcon(): Graphics {
  return new Graphics()
    .circle(0, 0, 30)
    .fill(0x6fb7d8)
    .stroke({ width: 4, color: P.line })
    .ellipse(0, 0, 13, 30)
    .stroke({ width: 4, color: P.cream })
    .moveTo(-30, 0)
    .lineTo(30, 0)
    .moveTo(-26, -14)
    .lineTo(26, -14)
    .moveTo(-26, 14)
    .lineTo(26, 14)
    .stroke({ width: 4, color: P.cream })
    .circle(0, 0, 30)
    .stroke({ width: 4, color: P.line });
}

/** An on/off switch: a green track with the knob on the right, or a grey one with it on the left. */
function toggle(on: boolean): Container {
  const c = new Container();
  const w = 220;
  const h = 96;
  const track = new Graphics()
    .roundRect(-w / 2, -h / 2 + 6, w, h, h / 2)
    .fill({ color: P.line, alpha: 0.3 })
    .roundRect(-w / 2, -h / 2, w, h, h / 2)
    .fill(on ? 0x3c9a4a : LIGHT.inset)
    .stroke({ width: 5, color: on ? P.line : LIGHT.edge });
  const kx = on ? w / 2 - h / 2 : -w / 2 + h / 2;
  const knob = new Graphics()
    .circle(kx, 4, h / 2 - 8)
    .fill({ color: P.line, alpha: 0.3 })
    .circle(kx, 0, h / 2 - 8)
    .fill(on ? P.brassLight : LIGHT.face)
    .stroke({ width: 5, color: P.line });
  const word = label(t(on ? 'sound.on' : 'sound.off'), 34, { stroke: { color: P.line, width: 6 } });
  word.position.set(on ? -h / 2 + 18 : h / 2 - 18, -3);
  fitText(word, w - h - 16);
  c.addChild(track, knob, word);
  return c;
}

/** Two beamed eighth notes. */
function noteIcon(): Graphics {
  return new Graphics()
    .poly([-16, -26, 22, -36, 22, -24, -16, -14])
    .fill(P.cream)
    .stroke({ width: 4, color: P.line, join: 'round' })
    .rect(-18, -20, 7, 44)
    .fill(P.cream)
    .rect(16, -30, 7, 44)
    .fill(P.cream)
    .ellipse(-22, 24, 12, 9)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line })
    .ellipse(12, 14, 12, 9)
    .fill(P.cream)
    .stroke({ width: 4, color: P.line });
}

/** A speaker with sound waves, or with a cross when off. */
function speakerIcon(on: boolean): Graphics {
  const g = new Graphics()
    .poly([-30, -10, -16, -10, 2, -26, 2, 26, -16, 10, -30, 10])
    .fill(P.cream)
    .stroke({ width: 4, color: P.line, join: 'round' });
  if (on) {
    g.arc(4, 0, 14, -0.9, 0.9).stroke({ width: 6, color: P.cream, cap: 'round' });
    g.arc(4, 0, 26, -0.9, 0.9).stroke({ width: 6, color: P.cream, cap: 'round' });
  } else {
    g.moveTo(12, -12).lineTo(32, 12).moveTo(32, -12).lineTo(12, 12).stroke({ width: 7, color: P.cream, cap: 'round' });
  }
  return g;
}

/** One hero: its level, the skill cards it starts with and what each milestone unlocks. */
function heroPanel(m: MetaSave, act: HomeActions, kind: HeroKind, fit: MenuFit): Container {
  const h = 1440;
  const { panel, box } = frame(act, t(`hero.${kind}`), h, fit);
  const lv = m.heroes[kind];
  const top = -h / 2;
  const bt = bottle(kind, 220);
  bt.position.set(-300, top + 250);
  box.addChild(new Graphics().circle(-300, top + 250, 120).fill({ color: HERO_COLORS[kind], alpha: 0.2 }), bt);
  const level = ink(`Lv ${lv} / ${BALANCE.meta.heroMax}`, 56);
  level.anchor.set(0, 0.5);
  level.position.set(-150, top + 210);
  const dmg = fitText(ink(t('heroDamage', { p: Math.round(BALANCE.meta.heroDamage * 100), n: Math.round((heroDamage(lv) - 1) * 100) }), 34, { fill: P.inkSoft }), 570);
  dmg.anchor.set(0, 0.5);
  dmg.position.set(-150, top + 290);
  box.addChild(level, dmg);

  const head = ink(t('baseCards'), 38, { fill: P.brassDark });
  head.position.set(0, top + 420);
  const base = baseSkills(kind).map((id) => t(`skill.${id}.name`)).join('  ·  ');
  const P2 = BALANCE.heroes.poison;
  const cards = base
    ? fitText(ink(base, 40), 860)
    : fitText(ink(kind === 'poison' ? t('rust', { p: Math.round(P2.rustStep * 100), n: P2.rustMax }) : '', 34), 860);
  cards.position.set(0, top + 480);
  box.addChild(head, cards);

  let y = top + 554;
  MILESTONES[kind].forEach((ms) => {
    const on = lv >= ms.level;
    const r = new Container();
    const lvTag = ink(`Lv.${ms.level}`, 38, { fill: on ? P.brassDark : P.inkSoft });
    lvTag.position.set(-350, 0);
    let what: string;
    let needs = '';
    let detail = '';
    if ('perk' in ms) {
      what = t(`perk.${ms.perk}`);
    } else {
      const other = skillHeroes(ms.skill).with;
      const name = t(`skill.${ms.skill}.name`);
      what = other ? t('unlockRecipe', { name }) : t('unlockSkill', { name });
      if (other) needs = t('recipeNeeds', { with: t(`hero.${other}`) });
      detail = t(`skill.${ms.skill}.desc`);
    }
    // the line, what a recipe needs and the detail as one block with even gaps, centred in the row
    const text = new Container();
    const a = inkWrapped(what, 34, 600, { align: 'left', lineHeight: 42 });
    a.anchor.set(0, 0);
    text.addChild(a);
    let ty = a.height + 6;
    if (needs) {
      const n = ink(needs, 26, { fill: P.brassDark });
      n.anchor.set(0, 0);
      n.y = ty;
      text.addChild(n);
      ty += n.height + 2;
    }
    if (detail) {
      const d = inkWrapped(detail, 26, 600, { fill: P.inkSoft, align: 'left', lineHeight: 32 });
      d.anchor.set(0, 0);
      d.y = ty;
      text.addChild(d);
    }
    // the row grows with a long recipe line
    const rh = Math.max(132, text.height + 32);
    r.position.set(0, y + rh / 2);
    y += rh + 18;
    r.addChild(lightTile(860, rh, 22));
    if (on) r.addChild(new Graphics().roundRect(-436, -rh / 2 - 6, 872, rh + 12, 26).stroke({ width: 7, color: P.brass }));
    // a CJK opening bracket carries its blank half on the left; pull it back to the column edge
    text.position.set(what.startsWith('「') ? -277 : -260, -text.height / 2);
    r.addChild(lvTag, text);
    if (on) {
      const tick = label('✓', 52, { fill: 0x5cc66a, stroke: { color: P.line, width: 8 } });
      tick.position.set(380, 0);
      r.addChild(tick);
    } else {
      const l = lock();
      l.position.set(380, 4);
      r.addChild(l);
      r.alpha = 0.8;
    }
    box.addChild(r);
  });

  // the next level and the button that buys it along the bottom; the panel stays open after
  const foot = h / 2 - 100;
  const cost = heroCost(lv);
  if (cost === null) {
    const max = ink(t('maxed'), 50, { fill: P.brassDark });
    max.y = foot;
    box.addChild(max);
    return panel;
  }
  if (!heroUnlocked(m, kind)) return panel;
  const next = ink(t('heroNext', { n: lv + 1, p: Math.round((heroDamage(lv + 1) - 1) * 100) }), 38, { fill: 0x2b6a33, fontWeight: '900' });
  next.anchor.set(0, 0.5);
  next.position.set(-410, foot);
  fitText(next, 450);
  const b = priced(
    new PillButton(String(cost), 340, 110, 'purple', () => {
      act.hero(kind);
      act.panel(kind);
    }, 48, true),
    m.crystals >= cost,
  );
  b.position.set(250, foot - 4);
  box.addChild(next, b);
  return panel;
}
