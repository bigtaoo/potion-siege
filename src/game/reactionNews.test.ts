// A reaction's news reaching the save in a live battle (reactionNews.ts): the first of a kind pays
// its find reward and says so, a mastery star says what it brings, the rest stay quiet.

import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Game } from '../app';
import { setLocale } from '../i18n';
import { newMeta } from '../sim/meta';
import { REACTION_MASTERY } from '../sim/reactionPower';
import { BALANCE, type BattleEvent, type ReactionId } from '../sim/types';
import { announceReactions, NEWS_SECONDS } from './reactionNews';

beforeAll(() => {
  setLocale('en');
});

const rx = (id: ReactionId): BattleEvent => ({ type: 'reaction', id, x: 0, y: 0, radius: 0 });

function stub() {
  const save = newMeta();
  const g = { save, hud: { note: vi.fn() }, audio: { play: vi.fn() }, store: vi.fn() };
  return { g, call: (ev: BattleEvent[]) => announceReactions(g as unknown as Game, ev) };
}

describe('reaction news in a live battle', () => {
  it('pays the find reward once for a reaction never set off', () => {
    const { g, call } = stub();
    const before = g.save.crystals;
    call([rx('steam'), rx('steam')]);
    expect(g.save.crystals).toBe(before + BALANCE.reactions.findReward);
    expect(g.hud.note).toHaveBeenCalledTimes(1);
    expect(g.hud.note.mock.calls[0][0]).toContain(String(BALANCE.reactions.findReward));
    expect(g.hud.note.mock.calls[0][1]).toBe(NEWS_SECONDS);
    expect(g.audio.play).toHaveBeenCalledWith('crystal');
    expect(g.store).toHaveBeenCalledTimes(1);
  });

  it('says what a new star brings', () => {
    const { g, call } = stub();
    g.save.achievements.stats.reactions.overload = REACTION_MASTERY[0] - 1;
    const before = g.save.crystals;
    call([rx('overload')]);
    expect(g.save.crystals).toBe(before);
    expect(g.audio.play).toHaveBeenCalledWith('levelup');
    expect(g.hud.note.mock.calls[0][0]).toContain(String(Math.round(BALANCE.reactions.masteryStep * 100)));
  });

  it('stays quiet on a frame with nothing new', () => {
    const { g, call } = stub();
    g.save.achievements.stats.reactions.steam = 5;
    call([rx('steam'), { type: 'summon' } as BattleEvent]);
    call([]);
    expect(g.hud.note).not.toHaveBeenCalled();
    expect(g.store).not.toHaveBeenCalled();
  });
});
