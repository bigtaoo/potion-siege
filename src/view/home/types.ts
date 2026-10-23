// What the home screen is built from besides the save: its tabs and panels, what a tap on it
// asks the game to do, and what only some hosts have.

import type { Container } from 'pixi.js';
import type { Locale } from '../../i18n';
import type { TrackId } from '../../sim/achievements';
import type { WorkshopId } from '../../sim/meta';
import type { EnemyKind, HeroKind } from '../../sim/types';

export type HomeTab = 'potions' | 'workshop' | 'battle' | 'codex' | 'shop';
export const HOME_TABS: readonly HomeTab[] = ['potions', 'workshop', 'battle', 'codex', 'shop'];
export type HomePanel = 'login' | 'welcome' | 'remind' | 'tasks' | 'settings' | 'language' | 'challenge' | 'chapters' | 'privacy' | HeroKind | EnemyKind | null;

export interface HomeActions {
  tab(tab: HomeTab): void;
  panel(p: HomePanel): void;
  /** The claims pass the button tapped, where their crystals fly from. */
  claimLogin(at: Container): void;
  /** Today's welcome week gift. */
  claimWelcome(at: Container): void;
  claimTask(index: number, at: Container): void;
  /** The bonus for claiming all of today's tasks. */
  claimBonus(at: Container): void;
  /** The next tier of an achievement track. */
  claimTier(id: TrackId, at: Container): void;
  stage(delta: number): void;
  /** A stage tile on the chapters panel was tapped. */
  pickStage(stage: number): void;
  /** The battle tab's normal / hard switch; false when no chapter's hard mode is open. */
  hardMode(on: boolean): boolean;
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
  /** The reminders: the card's answer, or the settings switch. */
  remind(on: boolean): void;
}

/** The iOS app's reminders: 'blocked' when refused in the phone's settings. */
export type RemindState = 'on' | 'off' | 'blocked';

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
  /** The reminders' switch, where the host has notifications. */
  remind?: RemindState;
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
