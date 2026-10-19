// What the home screen's taps do past the screen itself: the language switch, the ad-free
// card's purchase and restore, the shop's ad, the lineup swap, buys and claimed crystals.

import { Text, type Container } from 'pixi.js';
import type { Game } from '../app';
import { getLocale, loadLocale, setLocale, t, type Locale } from '../i18n';
import { dayOf } from '../sim/daily';
import { adsLeft, claimAd } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { flyCrystals } from '../view/fly';
import type { HomePanel } from '../view/Home';
import { tapLineup } from '../view/home/lineup';
import { home } from './homeScreen';
import { LANG_KEY } from './keys';
import { showLocale } from './startup';

/** Switches the language for good: fetched first (nothing changes if that fails, offline),
 *  then the home screen drawn again in it. */
export async function language(g: Game, l: Locale): Promise<void> {
  const from = getLocale();
  if (l !== from && (await loadLocale(l))) {
    showLocale(setLocale(l));
    g.platform.storage.setItem(LANG_KEY, l);
    g.analytics.track('language', { lang: l, from });
  }
  if (g.menu.visible) home(g, 'settings');
}

/** Apple's purchase sheet for the ad-free card. The menu takes no taps while it is up. */
export async function buyAdFree(g: Game): Promise<void> {
  const store = g.platform.store;
  if (!store) return;
  g.menu.interactiveChildren = false;
  let outcome: Awaited<ReturnType<typeof store.buy>> = 'failed';
  try {
    outcome = await store.buy();
  } catch {
    // a store that broke: said as failed
  } finally {
    g.menu.interactiveChildren = true;
  }
  g.analytics.track('iap', { op: 'buy', outcome, run: g.save.runs });
  g.storeNote = outcome === 'pending' ? t('store.adFree.pending') : outcome === 'failed' ? t('store.adFree.failed') : null;
  if (outcome === 'owned') g.platform.celebrate();
  g.refresh();
}

/** Restore purchases: the strip says what it found. */
export async function restoreAdFree(g: Game): Promise<void> {
  const store = g.platform.store;
  if (!store) return;
  g.menu.interactiveChildren = false;
  let outcome: Awaited<ReturnType<typeof store.restore>> = 'failed';
  try {
    outcome = await store.restore();
  } catch {
    // a store that broke: said as failed
  } finally {
    g.menu.interactiveChildren = true;
  }
  g.analytics.track('iap', { op: 'restore', outcome, run: g.save.runs });
  g.storeNote = outcome === 'owned' ? t('store.adFree.restored') : outcome === 'none' ? t('store.adFree.nothing') : outcome === 'failed' ? t('store.adFree.failed') : null;
  g.refresh();
}

/** The pointer at a potion upgrade is over: the player bought one, or saw the button and moved on. */
export function hintDone(g: Game, bought: boolean): void {
  g.hintOnButton = false;
  if (g.save.upgradeHint) return;
  g.save.upgradeHint = true;
  g.store();
  g.analytics.track('hint_upgrade_done', { bought, run: g.save.runs });
}

/** The shop's rewarded ad: crystals when it was watched, a few times a day. The menu takes no
 *  taps while it plays, and an ad that broke counts as not watched. */
export async function shopAd(g: Game): Promise<void> {
  if (adsLeft(g.save, dayOf(new Date())) <= 0) return;
  g.menu.interactiveChildren = false;
  let ok = false;
  try {
    ok = await g.platform.rewarded(() => g.mute(true));
  } catch {
    // not watched: nothing paid
  } finally {
    g.menu.interactiveChildren = true;
    g.mute(false);
  }
  g.analytics.track('ad_shop', { ok });
  const n = ok ? claimAd(g.save, dayOf(new Date())) : 0;
  if (n > 0) claimed(g, 'shop_ad', n, null);
  else if (g.menu.visible) home(g);
}

/** A tap on the potions tab's lineup strip: a potion in the lineup swaps out for the reserve (the one picked,
 *  or the only one); a reserve potion is picked, or unpicked. */
export function lineup(g: Game, kind: HeroKind): void {
  const { picked, swap } = tapLineup(g.save, g.picked, kind);
  if (!swap && picked === g.picked) return;
  g.picked = picked;
  if (swap) g.store();
  if (swap) g.analytics.track('lineup', { out: swap[0], in: swap[1] });
  home(g);
}

/** Crystals paid for `item`: saved, then the page rebuilt and the crystals flown from the
 *  button tapped (`at`, or the middle of the page) into the purse. */
export function claimed(g: Game, item: string, crystals: number, panel: HomePanel, at?: Container): void {
  g.audio.play(item === 'shop_chest' ? 'chest' : 'crystal');
  g.store();
  g.analytics.track('daily_claim', { item, crystals, total: g.save.crystals });
  const fit = g.menuFit;
  const from = at && !at.destroyed ? g.menu.toLocal(at.getGlobalPosition()) : { x: (fit?.w ?? 0) / 2, y: (fit?.h ?? 0) / 2 };
  home(g, panel);
  const purse = g.menu.getChildByLabel('purse', true);
  const count = g.menu.getChildByLabel('purseCount', true);
  if (purse && count instanceof Text) flyCrystals(g.menu, from, purse, count, g.save.crystals - crystals, g.save.crystals);
}

/** `level`: the level the purchase reached, where it has one. */
export function buy(g: Game, ok: boolean, item: string, level: number | null = null): void {
  if (!ok) return;
  g.audio.play('levelup');
  g.store();
  g.analytics.track('meta_buy', { item, level, crystals: g.save.crystals });
  home(g);
}
