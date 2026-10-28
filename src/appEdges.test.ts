// The Game's rarer turns (app.ts): where the heartbeat says the player is, a frame with no
// battle, the back/forward cache after a battle ended, offers met by the bot, the ultimate's
// title, an ad that ends after its cards went away, and a pick with no offer up.
import './view/layout/measure';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { t } from './i18n';
import { liveWorld } from './game/flowHelpers';
import { englishPage, flush, play, playToEnd, tap, texts, veteran, world } from './game/testWorld';

beforeAll(englishPage);

describe('the heartbeat and the frame', () => {
  it('names the stage in a run, and not on the home screen', () => {
    const w = world();
    const where = () => w.game.beat['where']();
    expect(where()).toEqual({ place: 'home' });
    play(w);
    expect(where()).toMatchObject({ place: 'run', stage: w.game.battle!.setup.stage });
  });

  it('counts no enemies on a frame with no battle', () => {
    const w = liveWorld();
    w.game.battle = null;
    const tick = vi.spyOn(w.game.perf, 'tick');
    w.frame(16);
    expect(tick).toHaveBeenCalledWith(16, false, 0);
  });
});

describe('back from the back/forward cache', () => {
  it('does not reopen a run whose battle is over, nor one with no battle', () => {
    const w = world();
    play(w);
    const run = w.game.run!;
    const reopen = vi.spyOn(run, 'reopen');
    w.game.battle!.result = 'lost';
    w.game.back();
    w.game.battle = null;
    w.game.back();
    expect(reopen).not.toHaveBeenCalled();
  });
});

describe('the bot at an offer', () => {
  it('picks an offer that is up as the frame starts, and one opened on the frame\'s last step', () => {
    const w = world(veteran(), () => {}, 'speed=200&autoplay');
    const g = w.game;
    const b = g.battle!;
    b['offer']('upgrade');
    g['tick'](0.001);
    expect(b.choices).toBeNull();
    vi.spyOn(b, 'drain').mockImplementationOnce(() => (b['offer']('upgrade'), []));
    g['tick'](0.001);
    expect(b.choices).toBeNull();
    expect(g['overlay'].visible).toBe(false);
  });

  it('takes a pick in autoplay without counting it toward the tasks', () => {
    const w = world(veteran(), () => {}, 'speed=200&autoplay');
    const g = w.game;
    const b = g.battle!;
    b['offer']('upgrade');
    const before = JSON.stringify(g.save.daily);
    g['pick'](b.choices![0]);
    expect(b.choices).toBeNull();
    expect(JSON.stringify(g.save.daily)).toBe(before);
  });
});

describe('the skill cards', () => {
  it('title an ultimate offer as one', () => {
    const w = world();
    play(w);
    w.game.battle!['offer']('ultimate');
    w.game['tick'](0.001);
    expect(texts(w.stage)).toContain(t('ultimatePick'));
  });

  it('stay down when the cards went away while the ad played', async () => {
    const w = world();
    play(w);
    const g = w.game;
    g.battle!.gold = 1000;
    g.battle!.upgrade();
    g['tick'](0.001);
    w.host.answers = ['watched'];
    tap(w.stage, t('reroll'));
    g['overlay'].hide();
    await flush();
    expect(g['overlay'].visible).toBe(false);
  });

  it('a pick with no offer up just closes the overlay', () => {
    const w = world();
    play(w);
    playToEnd(w);
    const g = w.game;
    const play_ = vi.spyOn(g.audio, 'play');
    g['pick']('fireChain');
    expect(play_).not.toHaveBeenCalledWith('levelup');
    expect(g['overlay'].visible).toBe(false);
  });
});
