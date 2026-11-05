// The recorded sounds: short clips in public/sfx/ (MP3, mono), cut and levelled by
// tools/reaction_sfx.sh from Kenney's CC0 packs (Impact Sounds, Sci-Fi Sounds). Everything else
// the game plays is synthesized (sfx.ts). Fetched and decoded once the context exists; a clip
// not in yet is skipped.

import { REACTION_IDS, type ReactionId } from '../sim/types';
import type { Limit } from './mix';

export type SampleId = `rx_${ReactionId}`;
export const SAMPLE_IDS: readonly SampleId[] = REACTION_IDS.map((id) => `rx_${id}` as const);

export interface SampleSpec extends Limit {
  /** Mix level, 0..1. */
  gain: number;
  /** Random pitch spread, as a fraction. */
  vary: number;
}

/** The reactions go off often in a busy battle: one of a kind at a time, a little apart. */
const RX: SampleSpec = { gain: 0.55, limit: 1, gap: 0.25, vary: 0.06 };

export const SAMPLES: Record<SampleId, SampleSpec> = {
  rx_steam: RX,
  rx_superconduct: RX,
  rx_overload: { ...RX, gain: 0.5 },
  rx_electrolysis: RX,
  rx_combustion: { ...RX, gain: 0.5 },
  rx_firestorm: RX,
  rx_blizzard: RX,
  rx_resonance: { ...RX, gain: 0.45, limit: 2, gap: 0.15 },
  rx_prism: { ...RX, gain: 0.45 },
  rx_flare: RX,
  rx_magnetize: RX,
  rx_molten: { ...RX, gain: 0.5 },
  rx_spores: RX,
  rx_bramble: RX,
};

export const isSample = (id: string): id is SampleId => id in SAMPLES;

/** Where a clip is served. */
export const sampleUrl = (id: SampleId, base: string = import.meta.env.BASE_URL): string => `${base}sfx/${id}.mp3`;

/** Fetches and decodes every clip, handing each to `done` as it comes in; a clip that fails is
 *  left out (the game is only quieter). */
export function loadSamples(ctx: BaseAudioContext, done: (id: SampleId, buf: AudioBuffer) => void): void {
  for (const id of SAMPLE_IDS) {
    let req: Promise<Response>;
    try {
      req = fetch(sampleUrl(id));
    } catch {
      continue;
    }
    req
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => done(id, buf))
      .catch(() => {});
  }
}
