// Playgama's leaderboards through Bridge (bridgeBoard.ts and bridge.ts's leaderboard calls): a score
// goes up only when it rose, the rows come back in rank order with the player's own marked.

import { describe, expect, it } from 'vitest';
import { PlaygamaBridge, type BridgeShape } from '../platform/playgama/bridge';
import { BridgeBoard, bridgeBoard, ROWS } from './bridgeBoard';

/** A bridge over a stand-in SDK with `boards` as its leaderboards, initialized. */
async function bridge(boards: BridgeShape['leaderboards']) {
  const b = new PlaygamaBridge({ bridge: { initialize: async () => {}, leaderboards: boards } });
  expect(await b.init()).toBe(true);
  return b;
}

const fail = () => {
  throw new Error('broken');
};

describe('Bridge leaderboards', () => {
  it('draws its boards in the game only where Bridge says in_game', async () => {
    expect((await bridge({ type: 'in_game' })).boardsInGame()).toBe(true);
    expect((await bridge({ type: 'native' })).boardsInGame()).toBe(false);
    expect(new PlaygamaBridge({}).boardsInGame()).toBe(false);
    expect(bridgeBoard(await bridge({ type: 'in_game' }))).toBeInstanceOf(BridgeBoard);
    expect(bridgeBoard(await bridge({ type: 'not_available' }))).toBeNull();
  });

  it('sets scores and reads the well-formed entries, living through a throwing SDK', async () => {
    const set: [string, number][] = [];
    const b = await bridge({
      type: 'in_game',
      setScore: (id, score) => void set.push([id, score]),
      getEntries: async (id) => (id === 'stars' ? [{ id: 7, name: 'Ann', score: 30, rank: 1 }, { name: 5, score: 2, rank: 2 }, { score: 'x' }, null] : 'nope'),
    });
    b.setScore('stars', 30);
    expect(set).toEqual([['stars', 30]]);
    expect(await b.entries('stars')).toEqual([
      { id: '7', name: 'Ann', score: 30, rank: 1 },
      { id: '', name: '', score: 2, rank: 2 },
    ]);
    expect(await b.entries('endless')).toBeNull();
    const broken = await bridge({ type: 'in_game', setScore: fail, getEntries: fail });
    broken.setScore('stars', 1);
    expect(await broken.entries('stars')).toBeNull();
  });
});

describe('BridgeBoard', () => {
  it('sends a score only when it rose past the last one sent', () => {
    const set: [string, number][] = [];
    const b = new BridgeBoard({ setScore: (id, s) => void set.push([id, s]), entries: async () => null, accountId: () => null });
    b.submit({ endless: 0, stars: 4 });
    b.submit({ endless: 0, stars: 4 });
    b.submit({ endless: 11, stars: 3 });
    expect(set).toEqual([['stars', 4], ['endless', 11]]);
  });

  it("shows the top rows in rank order with the signed-in player's own marked", async () => {
    const rows = Array.from({ length: ROWS + 3 }, (_, i) => ({ id: `p${i}`, name: i === 1 ? '' : `P${i}`, score: 100 - i, rank: i + 1 })).reverse();
    const page = (me: string | null) => new BridgeBoard({ setScore() {}, entries: async () => rows, accountId: () => me }).top('endless');
    const mine = await page('p12');
    expect(mine?.rows.map((r) => r.rank)).toEqual(Array.from({ length: ROWS }, (_, i) => i + 1));
    expect(mine?.rows[1].name).toBe('—');
    expect(mine?.me).toEqual({ rank: 13, name: 'P12', score: 88, me: true });
    expect((await page(null))?.me).toBeNull();
    expect(await new BridgeBoard({ setScore() {}, entries: async () => null, accountId: () => null }).top('stars')).toBeNull();
  });
});
