// Who is asked before the game sends play statistics (public/privacy.html §2): players in the
// EEA, the UK and Switzerland are asked first (GDPR, and the ePrivacy rules on an id kept on the
// device): until they answer, events wait in memory, nothing goes out and no install id is
// stored. Everyone else is counted from the start and can switch it off in the settings. The
// rules are the ones Holy Kicker uses (D:\standing client/src/meta/privacy.ts).

import type { KeyValueStore } from '../platform/types';

export type PrivacyRegion = 'consent' | 'notice';
/** The player's answer: none yet, yes or no. */
export type SharingChoice = 'ask' | 'yes' | 'no';
/** What analytics does with events: send them, keep them in memory for now, or drop them. */
export type Sharing = 'send' | 'hold' | 'off';

/** Where the answer is kept, beside the save. */
export const PRIVACY_KEY = 'mb.privacy';
/** Finished runs before the consent panel opens by itself on the home screen: never during the
 *  first battle, which has to start live (first-minute conversion). */
export const CONSENT_AFTER_RUNS = 1;

/** The EU (Greece both as GR and EL), Iceland, Liechtenstein, Norway, the UK and Switzerland. */
const CONSENT_COUNTRIES = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR EL HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB UK CH'.split(' '),
);

/** Time zones outside Europe/* that are in those countries (the Azores, the Canaries, Madeira, Iceland, Svalbard). */
const CONSENT_ZONES = new Set(['Atlantic/Azores', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Reykjavik', 'Arctic/Longyearbyen']);

/**
 * The host's country when it knows one (CrazyGames does), else the device's time zone: every
 * Europe/* zone asks, which takes in a few countries that need not be asked, but none is missed.
 * With neither, the game asks.
 */
export function privacyRegion(country: string | null, timeZone: string | null): PrivacyRegion {
  if (country) return CONSENT_COUNTRIES.has(country.toUpperCase()) ? 'consent' : 'notice';
  if (!timeZone) return 'consent';
  return timeZone.startsWith('Europe/') || CONSENT_ZONES.has(timeZone) ? 'consent' : 'notice';
}

export function sharingOf(region: PrivacyRegion, choice: SharingChoice): Sharing {
  if (choice === 'yes') return 'send';
  if (choice === 'no') return 'off';
  return region === 'consent' ? 'hold' : 'send';
}

/** The device's time zone, e.g. 'Europe/Berlin'; null where the runtime has none. */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** The player's answer kept in `store`, and what it means where they are. */
export class PrivacyChoice {
  constructor(
    private readonly store: KeyValueStore,
    readonly region: PrivacyRegion,
  ) {}

  choice(): SharingChoice {
    const v = this.store.getItem(PRIVACY_KEY);
    return v === 'yes' || v === 'no' ? v : 'ask';
  }

  sharing(): Sharing {
    return sharingOf(this.region, this.choice());
  }

  /** A player in the EEA, the UK or Switzerland who has not answered yet. */
  asking(): boolean {
    return this.region === 'consent' && this.choice() === 'ask';
  }

  set(on: boolean): void {
    this.store.setItem(PRIVACY_KEY, on ? 'yes' : 'no');
  }
}
