// The Game's own frame and page flows over a stand-in Pixi app whose ticker runs (game/flowHelpers.ts):
// whole frames, a frame that throws, the page hidden and back, leaving and the back/forward cache,
// the screen resized and turned on the home screen, autoplay, and the first player's start.
import './view/layout/measure';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { t } from './i18n';
import { newMeta } from './sim/meta';
import { home } from './game/homeScreen';
import { liveWorld, pageVisible } from './game/flowHelpers';
import { englishPage, play, playToEnd, tap, texts, veteran, world } from './game/testWorld';

beforeAll(englishPage);
afterEach(() => pageVisible(true));

describe('a frame through the ticker', () => {
  it('moves the battle on and counts the play the interstitials are paced by', () => {
    const w = liveWorld();
    play(w);
    const b = w.game.battle!;
    const before = b.seconds;
    w.frame(50);
    expect(b.seconds).toBeGreaterThan(before);
    expect(w.game.calm()).toBe(false);
    expect(w.game.place()).toEqual({ place: 'run', wave: b.wave });
    expect(w.game.pacing['since']).toBe(50);
  });

  it('is calm and unmeasured while the tab is hidden', () => {
    const w = liveWorld();
    play(w);
    pageVisible(false);
    expect(w.game.calm()).toBe(true);
    w.frame(50);
    pageVisible(true);
    expect(w.game.calm()).toBe(false);
  });

  it('settles a battle whose frame threw as lost and puts the home screen up', () => {
    const w = liveWorld();
    play(w);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(w.game.battle!, 'step').mockImplementation(() => {
      throw new Error('a bad frame');
    });
    w.frame(50);
    err.mockRestore();
    expect(w.game.menu.visible).toBe(true);
    expect(w.events('anomaly').some((e) => e.kind === 'error')).toBe(true);
  });
});

describe('where the player is', () => {
  it('reads title for an idle battle, home under the menu and results once a battle ended', () => {
    const w = world();
    expect(w.game.place()).toEqual({ place: 'home' });
    w.game.menu.visible = false;
    w.game.newBattle(null);
    expect(w.game.place()).toEqual({ place: 'title' });
    expect(w.game.calm()).toBe(true);
    play(w);
    playToEnd(w);
    expect(w.game.place().place).toBe('results');
    expect(w.game.calm()).toBe(true);
  });
});

describe('the page going away and coming back', () => {
  it('reports the run in progress and the session when the page goes', () => {
    const w = world();
    play(w);
    w.game.leave();
    expect(w.events('session_end')).toHaveLength(1);
    expect(w.events('run_quit')).toEqual([expect.objectContaining({ giveUp: false })]);
    w.game.back();
    w.game.leave();
    expect(w.events('session_end')).toHaveLength(2);
  });

  it('leaves without a run from home and has nothing to reopen', () => {
    const w = world();
    w.game.leave();
    w.game.back();
    expect(w.events('session_end')).toHaveLength(1);
    expect(w.events('run_quit')).toHaveLength(0);
  });

  it('tells the heartbeat the page started hidden', () => {
    pageVisible(false);
    const w = world();
    expect(w.game.beat['last']).toBeNull();
  });
});

describe('the home screen in frames', () => {
  it('lays the home out again when the screen changes size or turns', () => {
    const w = liveWorld();
    w.frame();
    const fit = w.game.menuFit;
    w.frame();
    expect(w.game.menuFit).toBe(fit);
    w.screen.width = 1920;
    w.screen.height = 1080;
    w.frame();
    expect(w.game.menuFit).not.toBe(fit);
    expect(w.game.menuFit!.wide).not.toBe(fit!.wide);
    expect(w.game.lessons.visible).toBe(false);
  });

  it('pushes the pointing hand back and forth', () => {
    const save = veteran();
    save.upgradeHint = false;
    save.crystals = 10_000;
    const w = liveWorld(save);
    w.game.tab = 'potions';
    home(w.game);
    w.frame();
    const hand = w.game.hintHand;
    if (!hand) return expect.fail('the upgrade pointer is up');
    expect(hand.children[0].y).not.toBe(0);
  });

  it('builds the home and the cards again once the rest of the art is in', () => {
    const w = world();
    const menu = w.game.menu.children[0];
    w.game.artIn();
    expect(w.game.menu.children[0]).not.toBe(menu);
    w.game.menu.visible = false;
    w.game.refresh();
  });
});

describe('the board on a wide screen', () => {
  it('fills the bars beside an upright board with the workshop wall, once per size', () => {
    const w = liveWorld(veteran(), 'speed=200&wide=off', { width: 2400, height: 1080 });
    play(w);
    w.frame();
    const wall = w.game['wall'];
    expect(wall.visible).toBe(true);
    const art = wall.children[0];
    w.frame();
    expect(wall.children[0]).toBe(art);
    w.screen.width = 2600;
    w.frame();
    expect(wall.children[0]).not.toBe(art);
  });
});

describe('the battle controls', () => {
  it('summons, buys an upgrade and opens the pause from the HUD', () => {
    const w = world();
    play(w);
    const g = w.game;
    const b = g.battle!;
    b.gold = 1000;
    const hud = g.hud as unknown as Record<string, { emit(e: string, a: unknown): void }>;
    const press = (name: string) => hud[name].emit('pointertap', { stopPropagation() {} });
    const heroes = () => b.slots.filter(Boolean).length;
    const was = heroes();
    press('summonButton');
    expect(heroes()).toBe(was + 1);
    press('upgradeButton');
    expect(b.choices).not.toBeNull();
    g.overlay.hide();
    b.choose(b.choices![0]);
    press('pauseButton');
    expect(g.pause.open).toBe(true);
  });

  it('takes a card tapped on the skill offer', () => {
    const w = world();
    play(w);
    const b = w.game.battle!;
    b.gold = 1000;
    b.upgrade();
    w.game['tick'](0.001);
    const name = t(`skill.${b.choices![0]}.name`).split(' ')[0];
    const cards: Container[] = [];
    const walk = (c: Container): void => {
      if (c.listenerCount('pointertap') > 0 && texts(c).some((s) => s.includes(name))) cards.push(c);
      else c.children.forEach(walk);
    };
    walk(w.game.overlay);
    expect(cards).toHaveLength(1);
    cards[0].emit('pointertap', { stopPropagation() {} } as never);
    expect(b.choices).toBeNull();
    expect(w.game.overlay.visible).toBe(false);
  });

  it('passes the host muting the game on to the audio', () => {
    const w = liveWorld();
    const host = vi.spyOn(w.game.audio, 'host');
    w.hostMute!(true);
    expect(host).toHaveBeenCalledWith(true);
  });
});

describe('autoplay', () => {
  it('starts a battle at once, plays it through with the bot and keeps no save', () => {
    const w = liveWorld(veteran(), 'speed=200&autoplay');
    expect(w.game.menu.visible).toBe(false);
    const b = w.game.battle!;
    for (let i = 0; i < 400 && !b.result; i++) w.frame(100);
    expect(b.result).not.toBeNull();
    w.game.store();
    expect(w.save().runs).toBe(veteran().runs);
  });
});

describe('a new player', () => {
  it('lands in the first battle with the tutorial, which the skip button ends', () => {
    const w = liveWorld(newMeta());
    expect(w.game.menu.visible).toBe(false);
    expect(w.game.tutorial).not.toBeNull();
    w.frame();
    tap(w.stage, `${t('tutorial.skip')} ›`);
    expect(w.game.tutorial).toBeNull();
  });
});
