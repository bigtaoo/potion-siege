// Renders the synthesized sounds off the main thread: the music loops take a few hundred
// milliseconds each, which would be a visible hitch on the page.

import { renderMusic, type TrackId } from './music';
import { renderSfx, type SfxId } from './sfx';

export type RenderJob = { kind: 'sfx'; id: SfxId; sr: number } | { kind: 'music'; id: TrackId; sr: number };
export type RenderDone = RenderJob & { data: Float32Array };

self.onmessage = (e: MessageEvent<RenderJob>) => {
  const job = e.data;
  const data = job.kind === 'sfx' ? renderSfx(job.id, job.sr) : renderMusic(job.id, job.sr);
  (self as unknown as Worker).postMessage({ ...job, data } satisfies RenderDone, [data.buffer]);
};
