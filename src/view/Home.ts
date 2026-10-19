// The home screen between battles, in the alchemist's-workshop look: a top bar with the daily
// login, the daily tasks and the crystals, five tabs (potions, workshop, battle, codex, shop;
// the battle and shop tabs and the lineup strip are built in home/, the codex in Codex.ts)
// and the daily login reward, the daily tasks and a hero's milestones as panels over it.
// Laid out on the whole screen: a portrait page with the tabs along the bottom, or on a wide
// (desktop) screen a landscape page with the tabs down the left side. Built afresh after every
// purchase, claim or resize.

import { Container, Graphics } from 'pixi.js';
import { getLocale, LOCALES, localeName, t, type Locale } from '../i18n';
import {
  bestToday, canPlayAd, canPlayFree, CHALLENGE_TIERS, msToTomorrow, streak, tierOf, todaysChallenge,
} from '../sim/challenge';
import { type TrackId } from '../sim/achievements';
import { ALL_DONE_BONUS, bonusReady, canClaimLogin, loginDay, loginReward, taskDone, taskGoal, taskReward, tasksClaimable } from '../sim/daily';
import { BALANCE, HERO_KINDS } from '../sim/types';
import { baseSkills, MILESTONES, skillHeroes } from '../sim/skills';
import { CHAPTER_COUNT, chapterChest, CHAPTER_SIZE, chapterOpen, chapterProgress, chapterStages, chestWaiting, isFinale, stageTwists } from '../sim/chapters';
import {
  benched, heroCost, heroDamage, heroUnlocked, maxStage, unlockStage,
  WORKSHOP_IDS, workshopCost, workshopValue, type MetaSave, type WorkshopId,
} from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { buildCodex } from './Codex';
import {
  bookIcon,
  bottle,
  coinsIcon,
  fit as fitText,
  flask,
  calendarIcon,
  chestIcon,
  gearIcon,
  ink,
  inkWrapped,
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
  scrollIcon,
  swordsIcon,
  tappable,
  workshopWall,
  wallIcon,
} from './kit';
import { navDots } from './nudges';
import { gem, HERO_COLORS, label } from './ui';
import { pointingHand } from './Tutorial';
import type { MenuFit } from './viewport';
import { battleTab } from './home/battleTab';
import { LINEUP_H, lineupStrip } from './home/lineup';
import { adIcon, chapterTitle, priced, tick, type Area } from './home/shared';
import { shopTab } from './home/shopTab';

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
  /** A potion on the potions tab's lineup strip was tapped. */
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
  /** The host has rewarded ads, loaded or not: the shop's ad card then waits for one. */
  adsHosted?: boolean;
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

/** Bottom bar height on a portrait page, side rail width on a landscape one, top bar height. */
const NAV = 210;
const RAIL = 230;
const TOP = 150;

/** `picked`: a reserve potion tapped on the potions tab's lineup strip, waiting for the one it replaces; `ads`:
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
  if (tab === 'battle') battleTab(root, m, act, area, today);
  else if (tab === 'potions') potionsTab(root, m, act, area, picked, hint);
  else if (tab === 'workshop') workshopTab(root, m, act, area);
  else if (tab === 'codex') root.addChild(buildCodex(m, area, act.claimTier));
  else shopTab(root, m, act, area, today, ads, ads || !!extras.adsHosted, extras.adFree ?? null);
  topBar(root, m, act, today, left, w, wide);
  // the red-dot rule is in nudges.ts; never on the tab already open
  const dots: Partial<Record<HomeTab, boolean>> = navDots(m, today);
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

/** A card per potion: portrait, level, the milestones reached and the level-up button; over
 *  them the lineup strip while there is a reserve to swap in, else the tab's name. */
function potionsTab(root: Container, m: MetaSave, act: HomeActions, a: Area, picked: HeroKind | null, hint: HeroKind | null): void {
  const cx = a.x + a.w / 2;
  const swap = benched(m).length > 0;
  if (swap) lineupStrip(root, m, act, picked, cx, a.y + (a.wide ? 40 : 30) + LINEUP_H / 2, Math.min(1000, a.w - 80));
  else {
    const head = plate(t('potions'), 52);
    head.position.set(cx, a.y + 60);
    root.addChild(head);
  }
  // one row of five on a wide page; three over two on a portrait one
  const n = HERO_KINDS.length;
  const cols = a.wide ? n : 3;
  const cw = Math.min(380, (a.w - 60) / cols - 30);
  const ch = a.wide ? 640 : swap ? 625 : 640;
  const y0 = a.y + (swap ? (a.wide ? 270 : 252) : 150);
  const cards = HERO_KINDS.map((kind, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const card = heroCard(m, act, kind, cw, ch);
    card.position.set(cx + (col - (inRow - 1) / 2) * (cw + 30), y0 + ch / 2 + row * (ch + 40));
    root.addChild(card);
    return card;
  });
  // over all the cards: up at the hinted potion's price button from below it
  const i = hint ? HERO_KINDS.indexOf(hint) : -1;
  if (i >= 0) root.addChild(pointer(cards[i].x + cw * 0.22, cards[i].y + ch / 2 - 34, 0, 0.8));
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
  const head = plate(title, 54, 420, 'brass', 760);
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
