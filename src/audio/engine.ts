// The game's sound: Web Audio buses for music and effects, the synthesized buffers (rendered in
// a worker), the loop crossfade, and everything that silences it — the player's toggles, ads,
// the portal's mute and a hidden tab. Nothing starts before the first tap or key (autoplay).

import type { BattleEvent } from '../sim/types';
import { battleCues, type Cue } from './cues';
import { Mix, Throttle, type SoundPrefs } from './mix';
import { MUSIC_RATE, renderMusic, TRACK_IDS, type TrackId } from './music';
import type { RenderDone, RenderJob } from './render.worker';
import { renderSfx, SFX, SFX_IDS, type SfxId } from './sfx';

const SFX_RATE = 44100;
/** The music sits under the effects. */
const MUSIC_LEVEL = 0.5;
/** Seconds the two loops overlap when one hands over to the other. */
const FADE = 1.6;

type Voice = { id: TrackId; src: AudioBufferSourceNode; gain: GainNode };

export class GameAudio {
  readonly mix = new Mix();
  private ctx: AudioContext | null = null;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private readonly sfx = new Map<SfxId, AudioBuffer>();
  private readonly tracks = new Map<TrackId, AudioBuffer>();
  private readonly throttle = new Throttle();
  private want: TrackId | null = null;
  private voice: Voice | null = null;

  /** Listens for the first gesture (which creates the context) and for the tab hiding. */
  attach(doc: Document = document): void {
    const gesture = () => this.unlock();
    for (const type of ['pointerdown', 'touchend', 'keydown']) doc.addEventListener(type, gesture, { capture: true, passive: true });
    doc.addEventListener('visibilitychange', () => {
      this.mix.hidden = doc.visibilityState === 'hidden';
      this.sync();
    });
  }

  prefs(p: SoundPrefs): void {
    this.mix.music = p.music;
    this.mix.sfx = p.sfx;
    this.sync();
  }

  /** An ad is playing: silence everything until it is over. */
  ad(on: boolean): void {
    this.mix.ad = on;
    this.sync();
  }

  /** The portal's own mute. */
  host(muted: boolean): void {
    this.mix.host = muted;
    this.sync();
  }

  /** The loop to play now (null: none); a change crossfades. */
  music(id: TrackId | null): void {
    if (id === this.want) return;
    this.want = id;
    this.handOver();
  }

  play(id: SfxId, cue: Omit<Cue, 'id'> = {}): void {
    const ctx = this.ctx;
    const buf = this.sfx.get(id);
    if (!ctx || !buf || ctx.state !== 'running' || !this.mix.sfxLevel) return;
    const spec = SFX[id];
    const rate = (cue.rate ?? 1) * (1 + (Math.random() * 2 - 1) * spec.vary);
    if (!this.throttle.admit(id, spec, ctx.currentTime, buf.duration / rate)) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    let node: AudioNode = src;
    if (cue.gain !== undefined && cue.gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = cue.gain;
      node = node.connect(g);
    }
    if (cue.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = cue.pan;
      node = node.connect(p);
    }
    node.connect(this.sfxBus);
    src.start();
  }

  /** The sounds of one frame of battle. */
  battle(events: readonly BattleEvent[]): void {
    if (!events.length) return;
    for (const c of battleCues(events)) this.play(c.id, c);
  }

  /** For the audition page and checks: what is loaded and running. */
  status(): { state: string; sfx: number; tracks: TrackId[]; playing: TrackId | null } {
    return { state: this.ctx?.state ?? 'none', sfx: this.sfx.size, tracks: [...this.tracks.keys()], playing: this.voice?.id ?? null };
  }

  /** A user gesture: make the context (it may only start now) or wake it. */
  private unlock(): void {
    if (!this.ctx) this.create();
    const ctx = this.ctx;
    if (ctx && ctx.state !== 'running' && this.mix.running) void ctx.resume().catch(() => {});
  }

  private create(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try {
      ctx = new AC();
    } catch {
      return;
    }
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(comp);
    // a little room around the effects
    const room = ctx.createConvolver();
    room.buffer = impulse(ctx, 1.1);
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    this.sfxBus.connect(room).connect(wet).connect(comp);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(comp);
    this.musicBus.gain.value = 0;
    this.sfxBus.gain.value = 0;
    ctx.addEventListener('statechange', () => this.sync());
    this.sync();
    this.render();
  }

  /** The short sounds first, then the loop wanted now, then the other one. */
  private render(): void {
    const tracks = [...TRACK_IDS].sort((a, b) => Number(b === this.want) - Number(a === this.want));
    const jobs: RenderJob[] = [
      ...SFX_IDS.map((id): RenderJob => ({ kind: 'sfx', id, sr: SFX_RATE })),
      ...tracks.map((id): RenderJob => ({ kind: 'music', id, sr: MUSIC_RATE })),
    ];
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (worker) {
      const w = worker;
      let left = jobs.length;
      w.onmessage = (e: MessageEvent<RenderDone>) => {
        this.store(e.data);
        if (--left === 0) w.terminate();
      };
      w.onerror = () => {
        w.terminate();
        this.renderHere(jobs.filter((j) => !this.has(j)));
      };
      for (const j of jobs) w.postMessage(j);
      return;
    }
    this.renderHere(jobs);
  }

  /** No worker: one job per task on this thread. */
  private renderHere(jobs: RenderJob[]): void {
    const next = () => {
      const j = jobs.shift();
      if (!j) return;
      this.store({ ...j, data: j.kind === 'sfx' ? renderSfx(j.id, j.sr) : renderMusic(j.id, j.sr) } as RenderDone);
      setTimeout(next, 0);
    };
    setTimeout(next, 0);
  }

  private has(j: RenderJob): boolean {
    return j.kind === 'sfx' ? this.sfx.has(j.id) : this.tracks.has(j.id);
  }

  private store(done: RenderDone): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const buf = ctx.createBuffer(1, done.data.length, done.sr);
    buf.getChannelData(0).set(done.data);
    if (done.kind === 'sfx') this.sfx.set(done.id, buf);
    else {
      this.tracks.set(done.id, buf);
      if (done.id === this.want) this.handOver();
    }
  }

  /** Fades the playing loop out and the wanted one in. A loop not rendered yet comes in when
   *  it is ready. */
  private handOver(): void {
    const ctx = this.ctx;
    if (!ctx || this.voice?.id === this.want) return;
    const t = ctx.currentTime;
    const old = this.voice;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + FADE);
      old.src.stop(t + FADE + 0.05);
      this.voice = null;
    }
    const buf = this.want ? this.tracks.get(this.want) : undefined;
    if (!this.want || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + (old ? FADE : FADE / 2));
    src.connect(gain).connect(this.musicBus);
    src.start(t);
    this.voice = { id: this.want, src, gain };
  }

  /** Applies the mix: bus levels, and the context suspended whenever nothing can be heard. */
  private sync(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.mix.musicLevel * MUSIC_LEVEL, t, 0.15);
    this.sfxBus.gain.setTargetAtTime(this.mix.sfxLevel, t, 0.02);
    if (this.mix.running) {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    } else if (ctx.state === 'running') {
      void ctx.suspend().catch(() => {});
    }
  }
}

/** A short stereo room: decaying noise. */
function impulse(ctx: BaseAudioContext, secs: number): AudioBuffer {
  const n = Math.round(secs * ctx.sampleRate);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3) * (i < 200 ? i / 200 : 1);
  }
  return buf;
}
