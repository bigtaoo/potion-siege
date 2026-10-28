import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameAudio } from './engine';
import { FakeContext, FakeDoc, FakeWorker } from './fakeAudio';

/** Just enough of an element for the audition page's buttons and boxes. */
class El {
  readonly children: El[] = [];
  readonly classes = new Set<string>();
  innerHTML = '';
  textContent = '';
  private small?: El;
  private readonly clicks: (() => void)[] = [];
  readonly classList = {
    add: (c: string) => this.classes.add(c),
    remove: (c: string) => this.classes.delete(c),
    toggle: (c: string, on: boolean) => (on ? this.classes.add(c) : this.classes.delete(c)),
  };
  append(...els: El[]): void {
    this.children.push(...els);
  }
  addEventListener(_type: 'click', fn: () => void): void {
    this.clicks.push(fn);
  }
  click(): void {
    for (const fn of this.clicks) fn();
  }
  querySelector(_sel: 'small'): El {
    return (this.small ??= new El());
  }
}

let boxes: Record<string, El>;
let audio: GameAudio;

beforeEach(async () => {
  vi.useFakeTimers();
  boxes = Object.fromEntries(['ui', 'hit', 'battle', 'music', 'toggles', 'status'].map((k) => [k, new El()]));
  const doc = Object.assign(new FakeDoc(), {
    createElement: () => new El(),
    querySelector: (sel: string) => boxes[/data-group="(\w+)"/.exec(sel)![1]],
    getElementById: (id: string) => boxes[id],
  });
  const win: { AudioContext: typeof FakeContext; __audio?: GameAudio } = { AudioContext: FakeContext };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => fn());
  vi.resetModules();
  await import('./audition');
  audio = win.__audio!;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeContext.made = [];
  FakeWorker.made = [];
});

describe('the audition page', () => {
  it('lays out a button per sound in its group, and a burst under the hits', () => {
    expect([boxes.ui.children.length, boxes.hit.children.length, boxes.battle.children.length]).toEqual([6, 7, 7]);
    expect(boxes.ui.children[0].innerHTML).toContain('Tap');
  });

  it('a sound button plays its sound through the engine', () => {
    const play = vi.spyOn(audio, 'play');
    boxes.battle.children[0].click();
    expect(play).toHaveBeenCalledWith('kill');
  });

  it('the burst plays two hits and two kills a frame for sixty frames', () => {
    const play = vi.spyOn(audio, 'play');
    boxes.hit.children[6].click();
    expect(play).toHaveBeenCalledTimes(240);
    expect(play.mock.calls.filter(([id]) => id === 'kill')).toHaveLength(120);
  });

  it('the music buttons switch the loop and light the one playing; stop lights none', () => {
    const music = vi.spyOn(audio, 'music');
    const [workshop, battle, stop] = boxes.music.children;
    battle.click();
    expect(music).toHaveBeenLastCalledWith('battle');
    expect([workshop, battle, stop].map((b) => b.classes.has('on'))).toEqual([false, true, false]);
    stop.click();
    expect(music).toHaveBeenLastCalledWith(null);
    expect([workshop, battle, stop].map((b) => b.classes.has('on'))).toEqual([false, false, false]);
  });

  it('the toggles flip the player prefs and their label', () => {
    const [musicT, sfxT] = boxes.toggles.children;
    expect(musicT.classes.has('on')).toBe(true);
    musicT.click();
    expect([audio.mix.music, audio.mix.sfx]).toEqual([false, true]);
    expect(musicT.classes.has('on')).toBe(false);
    expect(musicT.querySelector('small').textContent).toMatch(/OFF$/);
    sfxT.click();
    musicT.click();
    expect([audio.mix.music, audio.mix.sfx]).toEqual([true, false]);
    expect(musicT.querySelector('small').textContent).toMatch(/ON$/);
  });

  it('the ad button silences the game for three seconds', () => {
    const ad = boxes.toggles.children[2];
    ad.click();
    expect([audio.mix.ad, ad.classes.has('on')]).toEqual([true, true]);
    vi.advanceTimersByTime(3000);
    expect([audio.mix.ad, ad.classes.has('on')]).toEqual([false, false]);
  });

  it('shows the engine state and how many sounds are in', () => {
    vi.advanceTimersByTime(300);
    expect(boxes.status.textContent).toContain('none');
    expect(boxes.status.textContent).toContain('0/19');
  });
});
