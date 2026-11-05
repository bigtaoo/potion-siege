// The recorded clips (samples.ts): one per reaction, served from public/sfx/, fetched once the
// context exists and played by the reactions' cue at their own level.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { REACTION_IDS } from '../sim/types';
import { battleCues } from './cues';
import { answer, FakeContext, FakeGain, FakeSource, FakeWorker, setupAudio } from './fakeAudio';
import { SAMPLE_IDS, SAMPLES, sampleUrl } from './samples';

afterEach(() => {
  vi.unstubAllGlobals();
  FakeContext.made = [];
  FakeWorker.made = [];
});

/** Lets the fetch → decode chains settle. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

/** A fetch that serves each clip `bytes(url)` long, or fails for the urls `fail` names. */
function serve(fail: (url: string) => boolean = () => false) {
  const asked: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    asked.push(url);
    if (fail(url)) return Promise.resolve({ ok: false, status: 404 });
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(400 + SAMPLE_IDS.findIndex((id) => url.includes(id)))) });
  });
  return asked;
}

describe('the reaction clips', () => {
  it('has a clip on disk for every reaction', () => {
    expect(SAMPLE_IDS.map((id) => id.slice(3))).toEqual([...REACTION_IDS]);
    const files = Object.keys(import.meta.glob('../../public/sfx/*', { query: '?url' }));
    for (const id of SAMPLE_IDS) expect(files, id).toContain(`../../public/${sampleUrl(id, '')}`);
  });

  it('cues a reaction with its own clip, panned to where it went off', () => {
    expect(battleCues([{ type: 'reaction', id: 'steam', x: 0, y: 400, radius: 150 }])).toEqual([{ id: 'rx_steam', pan: -0.6 }]);
  });

  it('fetches the clips after the first tap and plays one at its level', async () => {
    const asked = serve();
    const { audio, tap } = setupAudio();
    expect(asked).toEqual([]);
    tap();
    const ctx = FakeContext.made[0];
    answer(FakeWorker.made[0]);
    ctx.become('running');
    await flush();
    expect(asked).toHaveLength(SAMPLE_IDS.length);
    expect(audio.status().clips).toBe(SAMPLE_IDS.length);
    audio.battle([{ type: 'reaction', id: 'overload', x: 540, y: 400, radius: 150 }]);
    const sources = ctx.of('source') as FakeSource[];
    const src = sources[sources.length - 1];
    expect(src.buffer!.length).toBe(400 + SAMPLE_IDS.indexOf('rx_overload'));
    const gains = (ctx.of('gain') as FakeGain[]).map((g) => g.gain.value);
    expect(gains).toContain(SAMPLES.rx_overload.gain);
  });

  it('leaves out a clip that fails, and plays nothing for it', async () => {
    serve((url) => url.includes('rx_blizzard'));
    const { audio, tap } = setupAudio();
    tap();
    const ctx = FakeContext.made[0];
    ctx.become('running');
    await flush();
    expect(audio.status().clips).toBe(SAMPLE_IDS.length - 1);
    const before = ctx.of('source').length;
    audio.play('rx_blizzard');
    expect(ctx.of('source').length).toBe(before);
  });

  it('survives a page with no fetch at all', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('no fetch');
    });
    const { audio, tap } = setupAudio();
    tap();
    expect(audio.status().clips).toBe(0);
  });
});
