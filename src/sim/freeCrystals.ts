// The shop's free crystals: the daily chest and the rewarded ads, counted per day on the save.

import type { MetaSave } from './meta';
import { BALANCE } from './types';

const S = BALANCE.shop;

/** Crystals in the free daily chest. */
export const CHEST_CRYSTALS = S.chest;
/** Crystals for one rewarded ad, and how many of those a day. */
export const AD_CRYSTALS = S.ad;
export const ADS_PER_DAY = S.adsPerDay;

export function chestReady(m: MetaSave, today: string): boolean {
  return today > m.shop.chestDay;
}

/** Opens today's free chest; the crystals it paid, 0 when it was opened already today. */
export function claimChest(m: MetaSave, today: string): number {
  if (!chestReady(m, today)) return 0;
  m.shop.chestDay = today;
  m.crystals += S.chest;
  return S.chest;
}

/** Rewarded ads for crystals still on offer today. */
export function adsLeft(m: MetaSave, today: string): number {
  return today > m.shop.adDay ? S.adsPerDay : Math.max(0, S.adsPerDay - m.shop.ads);
}

/** Pays for a rewarded ad that was watched to the end; 0 once today's are used up. */
export function claimAd(m: MetaSave, today: string): number {
  if (adsLeft(m, today) <= 0) return 0;
  if (today > m.shop.adDay) {
    m.shop.adDay = today;
    m.shop.ads = 0;
  }
  m.shop.ads++;
  m.crystals += S.ad;
  return S.ad;
}
