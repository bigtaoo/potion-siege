// When the game sends a battle's replay (replayUpload.ts): only while the player shares
// statistics, at the battle's end, when it is left, and when the page is hidden mid-battle.

import { describe, expect, it } from 'vitest';
import { Battle } from '../sim/battle';
import { botAct } from '../sim/bot';
import { HIDDEN_TICKS, replayUrl, ReplayUpload, type ReplayPost } from './replayUpload';

function setup(consent = { sending: true, playerId: 'p1' as string | null }) {
  const posts: { url: string; body: ReplayPost }[] = [];
  const up = new ReplayUpload('https://ps.example/r', consent, '1.0+abc', 'web', (url, body) => posts.push({ url, body: JSON.parse(body) as ReplayPost }));
  return { up, posts, consent };
}

function play(b: Battle, ticks: number): Battle {
  for (let i = 0; i < ticks && b.result === null; i++) {
    botAct(b);
    b.step();
    b.drain();
  }
  return b;
}

describe('replay upload', () => {
  it('sends a battle when it ends, under the player ID, with its replay', () => {
    const { up, posts } = setup();
    const b = new Battle(7);
    up.start(3, b);
    play(b, 600);
    b.result = 'lost';
    up.end(3, b);
    expect(posts).toHaveLength(1);
    const { url, body } = posts[0];
    expect(url).toBe('https://ps.example/r');
    expect({ ...body, replay: undefined }).toEqual({ uid: 'p1', run: 3, end: 'lost', build: '1.0+abc', platform: 'web', replay: undefined });
    expect(body.replay.ticks).toBe(b.time);
    expect(body.replay.commands.length).toBeGreaterThan(0);
    // the same end again (another result screen of the same battle) sends nothing more
    up.end(3, b);
    expect(posts).toHaveLength(1);
  });

  it('sends nothing while the player does not share statistics, or has no ID', () => {
    for (const consent of [{ sending: false, playerId: 'p1' }, { sending: true, playerId: null }]) {
      const { up, posts } = setup(consent);
      const b = play(new Battle(7), 300);
      up.start(1, b);
      up.hidden();
      up.end(1, b);
      expect(posts).toEqual([]);
    }
  });

  it('sends a battle left for another as quit, and nothing for one not played at all', () => {
    const { up, posts } = setup();
    const unplayed = new Battle(1);
    up.start(1, unplayed);
    up.end(1, unplayed);
    expect(posts).toEqual([]);
    const b = new Battle(2);
    up.start(2, b);
    play(b, 300);
    up.end(2, b);
    expect(posts.map((p) => [p.body.run, p.body.end])).toEqual([[2, 'quit']]);
    // a battle no longer live is not sent
    up.start(3, new Battle(3));
    play(b, 300);
    up.end(2, b);
    expect(posts).toHaveLength(1);
  });

  it(`sends the battle so far when the page is hidden, again only after ${HIDDEN_TICKS} more ticks`, () => {
    const { up, posts } = setup();
    const b = new Battle(5);
    up.start(1, b);
    up.hidden();
    expect(posts).toEqual([]);
    play(b, 300);
    up.hidden();
    play(b, HIDDEN_TICKS - 1);
    up.hidden();
    expect(posts.map((p) => [p.body.end, p.body.replay.ticks])).toEqual([['hidden', 300]]);
    play(b, 1);
    up.hidden();
    expect(posts.map((p) => p.body.replay.ticks)).toEqual([300, 300 + HIDDEN_TICKS]);
    // an ended battle was sent at its end
    b.result = 'won';
    up.end(1, b);
    up.hidden();
    expect(posts.map((p) => p.body.end)).toEqual(['hidden', 'hidden', 'won']);
  });

  it('listens for the page being hidden or left', () => {
    const { up, posts } = setup();
    const handlers = new Map<string, () => void>();
    const doc = { visibilityState: 'visible' as DocumentVisibilityState, addEventListener: (type: string, fn: () => void) => handlers.set(type, fn) };
    const win = { addEventListener: (type: string, fn: () => void) => handlers.set(type, fn) };
    up.listen(doc as unknown as Document, win as unknown as Window);
    const b = new Battle(5);
    up.start(1, b);
    play(b, 100);
    handlers.get('visibilitychange')!();
    expect(posts).toEqual([]);
    doc.visibilityState = 'hidden';
    handlers.get('visibilitychange')!();
    expect(posts).toHaveLength(1);
    play(b, HIDDEN_TICKS);
    handlers.get('pagehide')!();
    expect(posts).toHaveLength(2);
  });

  it('posts beside the event route', () => {
    expect(replayUrl('https://ps.gamestao.com/e')).toBe('https://ps.gamestao.com/r');
  });
});
