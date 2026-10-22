// The home screen's shop tab: the daily freebies (the free chest, and the rewarded ad where the
// host has ads), then the potions not owned yet for sale; where the ad-free card is sold (iOS) a
// strip for it on top.

import { Container, Graphics, type Text } from 'pixi.js';
import { t } from '../../i18n';
import { AD_CRYSTALS, adsLeft, ADS_PER_DAY, CHEST_CRYSTALS, chestReady, heroUnlocked, unlockPrice, unlockStage, type MetaSave } from '../../sim/meta';
import { HERO_KINDS, type HeroKind } from '../../sim/types';
import type { HomeActions, HomeExtras } from './types';
import { bottle, chestIcon, fit as fitText, ink, inkWrapped, LIGHT, lightPanel, lightTile, lock, P, PillButton, plate, tappable } from '../kit';
import { gem, HERO_COLORS } from '../ui';
import { adIcon, priced, tick, type Area } from './shared';

/** `ads`: a rewarded ad can be played now; `hosted`: the host has rewarded ads at all, so while
 *  none is loaded the ad card waits on a spinner, and without them it is left out. The unlock
 *  panel holds only the potions still locked, big two to a row while there are one or two, three
 *  to a row from three; with none left the freebies stand alone. Stacked on a portrait page,
 *  side by side on a landscape one. */
export function shopTab(root: Container, m: MetaSave, act: HomeActions, a: Area, today: string, ads: boolean, hosted: boolean, adFree: HomeExtras['adFree'] | null): void {
  let top = a.y + 60;
  const bottom = a.y + a.h - 40;
  const cx = a.x + a.w / 2;
  if (adFree) {
    adFreeStrip(root, act, adFree, cx, top + STRIP_H / 2, Math.min(a.wide ? 1500 : 960, a.w - 80));
    top += STRIP_H + 30;
  }
  const room = bottom - top;
  const showAd = ads || hosted;
  const locked = HERO_KINDS.filter((k) => !heroUnlocked(m, k));
  if (locked.length === 0) {
    // only the freebies: one calm panel a little above the middle
    const w = Math.min(a.wide ? 1100 : 960, a.w - 80);
    const h = Math.min(room, showAd ? (a.wide ? 760 : 900) : CHEST_ALONE_H);
    dailyPanel(root, m, act, today, ads, showAd, cx, top + (room - h) * 0.4 + h / 2, w, h);
    return;
  }
  const cols = locked.length <= 2 ? 2 : 3;
  const rows = Math.ceil(locked.length / cols);
  if (a.wide) {
    const gap = 40;
    const dw = Math.min(showAd ? 780 : 640, (a.w - 3 * gap) * (!showAd ? 0.4 : cols === 3 ? 0.42 : 0.46));
    const uw = a.w - 3 * gap - dw;
    dailyPanel(root, m, act, today, ads, showAd, a.x + gap + dw / 2, top + room / 2, dw, room);
    unlockPanel(root, m, act, locked, cols, a.x + 2 * gap + dw + uw / 2, top + room / 2, uw, room, room);
    return;
  }
  const pw = Math.min(960, a.w - 80);
  const gap = 60;
  // the cards take what the freebies need at least, and the freebies the rest up to a cap
  const least = showAd ? 600 : CHEST_ALONE_H;
  const ch = Math.min(cardH(cols), (room - gap - least - PANEL_PAD - (rows - 1) * CARD_GAP) / rows);
  const uh = PANEL_PAD + rows * ch + (rows - 1) * CARD_GAP;
  const dh = showAd ? Math.min(860, room - gap - uh) : CHEST_ALONE_H;
  const y0 = top + Math.max(0, (room - dh - gap - uh) * 0.4);
  dailyPanel(root, m, act, today, ads, showAd, cx, y0 + dh / 2, pw, dh);
  unlockPanel(root, m, act, locked, cols, cx, y0 + dh + gap + uh / 2, pw, uh, cardH(cols));
}

const STRIP_H = 200;
/** The daily panel with the free chest on its own, as one low card across. */
const CHEST_ALONE_H = 400;
/** Over the unlock cards the title plate and the hint under it, and a margin below them. */
const PANEL_HEAD = 130;
const PANEL_PAD = PANEL_HEAD + 34;
const CARD_GAP = 24;
const cardH = (cols: number) => (cols === 2 ? 540 : 440);

function titledPanel(root: Container, title: string, x: number, y: number, w: number, h: number): Container {
  const c = new Container();
  c.position.set(x, y);
  const p = plate(title, 40, 280);
  p.y = -h / 2 + 4;
  c.addChild(lightPanel(w, h), p);
  root.addChild(c);
  return c;
}

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
  const desc = fitText(ink(line, 32, { fill: info.note ? P.brassDark : P.inkSoft }), textW);
  desc.anchor.set(0, 0.5);
  desc.position.set(textX, 4);
  c.addChild(lightPanel(w, STRIP_H), icon, name, desc);
  const bx = w / 2 - 190;
  if (info.owned) {
    const tk = tick(30);
    tk.position.set(bx - 70, 0);
    const owned = ink(t('store.owned'), 40, { fill: P.greenInk });
    owned.anchor.set(0, 0.5);
    owned.position.set(bx - 26, -2);
    c.addChild(tk, owned);
  } else {
    const buy = new PillButton(info.price ?? '…', 300, 100, 'green', act.buyAdFree, 46).setEnabled(info.price !== null);
    buy.x = bx;
    // Restore, as a link under the line: App Review wants it where the purchase is
    const restore = tappable(fitText(ink(t('store.adFree.restore'), 32, { fill: P.brassDark }), textW), act.restoreAdFree);
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

/** Today's free chest and the ad for crystals as two cards side by side; without the ad the
 *  chest alone across the panel. */
function dailyPanel(root: Container, m: MetaSave, act: HomeActions, today: string, ads: boolean, showAd: boolean, x: number, y: number, w: number, h: number): void {
  const c = titledPanel(root, t('store.daily'), x, y, w, h);
  const n = showAd ? 2 : 1;
  const cw = (w - 80 - 30 * (n - 1)) / n;
  const ch = h - 130;
  const ready = chestReady(m, today);
  const chest = offerCard(cw, ch, chestIcon(), t('store.chest.name'), t('store.chest.desc'), CHEST_CRYSTALS, !ready, (bw) => {
    const open: PillButton = new PillButton(ready ? t('store.open') : t('tomorrow'), bw, 100, 'green', () => act.claimChest(open), ready ? 46 : 34);
    return open.setEnabled(ready);
  });
  chest.position.set(n === 2 ? -(cw + 30) / 2 : 0, 30);
  c.addChild(chest);
  if (!showAd) return;
  const left = adsLeft(m, today);
  const ad = offerCard(cw, ch, adIcon(), t('store.ad.name'), t('store.ad.desc', { n: left, total: ADS_PER_DAY }), AD_CRYSTALS, left === 0, (bw) => {
    if (left === 0) return new PillButton(t('tomorrow'), bw, 100, 'green', act.watchAd, 34).setEnabled(false);
    if (ads) return new PillButton(t('store.watch'), bw, 100, 'green', act.watchAd, 46);
    // the host has ads but none is loaded yet: the button waits on a spinner until one is
    const wait = new PillButton('', bw, 100, 'green', act.watchAd).setEnabled(false);
    const s = spinner(26);
    s.y = -4;
    wait.addChild(s);
    wait.label = 'adLoading';
    return wait;
  });
  ad.position.set((cw + 30) / 2, 30);
  c.addChild(ad);
}

/** A ring with a gap, turning while it is on screen. */
function spinner(r: number): Graphics {
  const g = new Graphics()
    .arc(0, 0, r, 0, Math.PI * 1.5)
    .stroke({ width: r * 0.34 + 8, color: P.line, cap: 'round' })
    .arc(0, 0, r, 0, Math.PI * 1.5)
    .stroke({ width: r * 0.34, color: P.cream, cap: 'round' });
  g.onRender = () => {
    g.rotation = (performance.now() / 150) % (Math.PI * 2);
  };
  return g;
}

/** A card with an icon, a name, a line under it, the crystals it pays and the button `button`
 *  makes at the width it is given; `done` dims it and ticks it. A tall card stacks them, a low
 *  wide one (the chest alone) puts the icon left, the words in the middle and the button right. */
function offerCard(cw: number, ch: number, icon: Container, name: string, desc: string, crystals: number, done: boolean, button: (w: number) => PillButton): Container {
  const c = new Container();
  const top = -ch / 2;
  c.addChild(lightTile(cw, ch, 26));
  const across = cw > ch * 1.6;
  const art = new Container();
  icon.scale.set(1.3);
  art.addChild(new Graphics().circle(0, 0, 84).fill({ color: P.brass, alpha: 0.18 }), icon);
  // the crystals, gem first, the pair centred
  const pay = new Container();
  const amount = ink(t('reward', { n: crystals }), 50, { fill: LIGHT.crystal });
  amount.x = 24;
  pay.addChild(gem(new Graphics(), 24 - amount.width / 2 - 32, 0, 26), amount);
  let b: PillButton;
  let n: Text, d: Text;
  if (across) {
    const bw = Math.min(300, cw * 0.3);
    art.scale.set(Math.min(1.2, (ch - 60) / 180));
    art.x = -cw / 2 + 40 + 84 * art.scale.x;
    const x0 = art.x + 84 * art.scale.x + 30;
    const x1 = cw / 2 - bw - 60;
    n = fitText(ink(name, 40), x1 - x0);
    d = fitText(ink(desc, 32, { fill: P.inkSoft }), x1 - x0);
    n.position.set((x0 + x1) / 2, -66);
    d.position.set(n.x, -16);
    pay.position.set(n.x, 52);
    b = button(bw);
    b.x = cw / 2 - bw / 2 - 36;
  } else {
    // the icon takes what the text and the button leave
    const room = Math.max(90, ch - 360);
    art.scale.set(Math.min(1.2, room / 180));
    art.y = top + 24 + room / 2;
    n = fitText(ink(name, 40), cw - 40);
    n.y = top + 60 + room;
    d = fitText(ink(desc, 32, { fill: P.inkSoft }), cw - 40);
    d.y = n.y + 50;
    pay.y = d.y + 72;
    b = button(cw - 60);
    b.y = ch / 2 - 74;
  }
  c.addChild(art, n, d, pay, b);
  if (done) {
    art.alpha = 0.5;
    pay.alpha = 0.5;
    const tk = tick(26);
    tk.position.set(cw / 2 - 40, top + 40);
    c.addChild(tk);
  }
  return c;
}

/** The potions still locked, a card each with the hint as the panel's subtitle: `cols` to a row,
 *  at most `most` tall, the rows in the middle of the room under the title. */
function unlockPanel(root: Container, m: MetaSave, act: HomeActions, locked: HeroKind[], cols: number, x: number, y: number, w: number, h: number, most: number): void {
  const c = titledPanel(root, t('store.unlocks'), x, y, w, h);
  const sub = fitText(ink(t('store.unlockHint'), 30, { fill: P.inkSoft }), w - 100);
  sub.y = -h / 2 + 84;
  c.addChild(sub);
  const rows = Math.ceil(locked.length / cols);
  const big = cols === 2;
  const cw = big ? Math.min(420, (w - 60 - CARD_GAP) / 2) : (w - 60 - 2 * CARD_GAP) / 3;
  const body = h - PANEL_PAD;
  const ch = Math.min(most, (body - (rows - 1) * CARD_GAP) / rows);
  const y0 = -h / 2 + PANEL_HEAD + (body - rows * ch - (rows - 1) * CARD_GAP) / 2 + ch / 2;
  locked.forEach((kind, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, locked.length - row * cols);
    const card = unlockCard(m, act, kind, cw, ch, big);
    card.position.set(((i % cols) - (inRow - 1) / 2) * (cw + CARD_GAP), y0 + row * (ch + CARD_GAP));
    c.addChild(card);
  });
}

/** A locked potion for sale: its name, the potion as it will look with a lock on it, the stage
 *  that opens it anyway and the crystal price. */
function unlockCard(m: MetaSave, act: HomeActions, kind: HeroKind, w: number, h: number, big: boolean): Container {
  const c = new Container();
  const top = -h / 2;
  c.addChild(lightTile(w, h, 24));
  const name = fitText(ink(t(`hero.${kind}`), big ? 40 : 32), w - 30);
  name.y = top + (big ? 46 : 38);
  c.addChild(name);
  const bh = big ? 96 : 84;
  let foot = h / 2 - 16;
  const price = unlockPrice(kind);
  if (price !== null) {
    const b = priced(new PillButton(String(price), w - (big ? 60 : 30), bh, 'purple', () => act.unlock(kind), big ? 44 : 36, true), m.crystals >= price);
    b.y = h / 2 - bh / 2 - 22;
    c.addChild(b);
    foot = b.y - bh / 2 - 14;
  }
  const at = unlockStage(kind);
  const size = big ? 30 : 26;
  const note = fitText(inkWrapped(at ? t('unlockAt', { n: at }) : t('codex.locked'), size, w - 40, { fill: P.inkSoft, lineHeight: size + 4 }), w - 24);
  note.anchor.set(0.5, 1);
  note.y = foot;
  // the potion in what the name and a two-line note leave, so the potions side by side line up
  const from = name.y + 30;
  const to = foot - 2 * (size + 4) - 10;
  const s = Math.min(big ? 300 : 190, w - 60, to - from);
  const ay = (from + to) / 2;
  const bt = bottle(kind, s);
  bt.y = ay;
  const badge = new Container();
  const l = lock(P.cream, P.locked);
  l.scale.set(0.62);
  l.y = 2;
  badge.addChild(new Graphics().circle(0, 0, 34).fill(P.locked).stroke({ width: 4, color: LIGHT.edge }), l);
  badge.position.set(s * 0.34, ay + s * 0.3);
  c.addChild(new Graphics().circle(0, ay, s * 0.48).fill({ color: HERO_COLORS[kind], alpha: 0.18 }), bt, badge, note);
  return c;
}
