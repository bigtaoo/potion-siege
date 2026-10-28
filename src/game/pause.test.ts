// The battle's pause (pause.ts) as the player meets it: the HUD's button, the host's pause and a
// phone turned sideways open it over the real game; Resume, Give up and the switches in it.
import '../view/layout/measure';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Container } from 'pixi.js';
import { t } from '../i18n';
import { newMeta } from '../sim/meta';
import { home } from './homeScreen';
import { GIVE_UP_WAIT, openPause } from './pause';
import { endTutorial } from './tutorialFlow';
import { buttons, englishPage, play, playToEnd, tap, texts, veteran, world, type Host, type World } from './testWorld';

beforeAll(englishPage);
afterEach(() => vi.unstubAllGlobals());

/** A veteran in a battle, the host's gameplay calls counted from here on. */
function battle(w: World = world()) {
  play(w);
  const calls: string[] = [];
  w.host.gameplayStart = () => calls.push('start');
  w.host.gameplayStop = () => calls.push('stop');
  return { w, g: w.game, calls };
}

const pauseButton = (w: World) => w.game['hud']['pauseButton'].emit('pointertap', { stopPropagation() {} } as never);
const giveUpShown = (w: World) => buttons(w.stage, t('pause.giveUp')).length + buttons(w.stage, t('pause.confirm')).length > 0;

describe('opening the pause', () => {
  it('stops gameplay on the platform from the HUD button, and Resume starts it again', () => {
    const { w, g, calls } = battle();
    pauseButton(w);
    expect(g.pause.open).toBe(true);
    expect(texts(w.stage)).toContain(t('pause.title'));
    expect(calls).toEqual(['stop']);
    tap(w.stage, t('pause.resume'));
    expect(g.pause.open).toBe(false);
    expect(texts(w.stage)).not.toContain(t('pause.title'));
    expect(calls).toEqual(['stop', 'start']);
  });

  it('does nothing when opened a second time', () => {
    const { w, g, calls } = battle();
    openPause(g);
    openPause(g);
    pauseButton(w);
    expect(calls).toEqual(['stop']);
    expect(buttons(w.stage, t('pause.resume'))).toHaveLength(1);
  });

  it('does not open on the home screen, with no run under the menu', () => {
    const w = world();
    w.host.gameplayStop = () => expect.fail('stopped on the home screen');
    openPause(w.game);
    expect(w.game.pause.open).toBe(false);
  });

  it('does not open on the result screen', () => {
    const { w, g, calls } = battle();
    playToEnd(w);
    const before = [...calls];
    openPause(g);
    expect(g.pause.open).toBe(false);
    expect(calls).toEqual(before);
  });

  it('does not open over the card offer', () => {
    const { w, g } = battle();
    for (let i = 0; i < 2000 && !g['overlay'].visible; i++) g['tick'](0.1);
    expect(g['overlay'].visible, 'a card offer came up').toBe(true);
    pauseButton(w);
    expect(g.pause.open).toBe(false);
  });

  it('does not open under autoplay', () => {
    const w = world(veteran(), () => {}, 'autoplay&speed=200');
    expect(w.game['run']).not.toBeNull();
    openPause(w.game);
    expect(w.game.pause.open).toBe(false);
  });

  it('holds the battle still while open, and lets it run on after Resume', () => {
    const { w, g } = battle();
    const b = g['battle']!;
    g['tick'](0.1);
    openPause(g);
    const at = { time: b.time, wave: b.wave, enemies: b.enemies.length, gold: b.gold };
    for (let i = 0; i < 50; i++) g['tick'](0.1);
    expect({ time: b.time, wave: b.wave, enemies: b.enemies.length, gold: b.gold }).toEqual(at);
    tap(w.stage, t('pause.resume'));
    g['tick'](0.1);
    expect(b.time).toBeGreaterThan(at.time);
  });

  it('opens from the host pause the game hooks up', () => {
    let hostPause = () => {};
    const w = world(veteran(), (h) => Object.assign(h, { onHostPause: (l: () => void) => (hostPause = l) }));
    hostPause();
    expect(w.game.pause.open, 'not on the home screen').toBe(false);
    play(w);
    hostPause();
    expect(w.game.pause.open).toBe(true);
    expect(buttons(w.stage, t('pause.resume'))).toHaveLength(1);
  });
});

describe('giving up', () => {
  it('asks again on the first tap, and the ask runs out after the wait', () => {
    const { w, g } = battle();
    openPause(g);
    tap(w.stage, t('pause.giveUp'));
    expect(g.pause.confirm).toBe(GIVE_UP_WAIT);
    expect(buttons(w.stage, t('pause.giveUp'))).toHaveLength(0);
    g['tick'](GIVE_UP_WAIT / 2);
    expect(buttons(w.stage, t('pause.confirm'))).toHaveLength(1);
    for (let s = GIVE_UP_WAIT / 2; s < GIVE_UP_WAIT + 0.5; s += 0.1) g['tick'](0.1);
    expect(g.pause.confirm).toBe(0);
    expect(buttons(w.stage, t('pause.confirm'))).toHaveLength(0);
    expect(buttons(w.stage, t('pause.giveUp'))).toHaveLength(1);
    expect(g.pause.open, 'still paused').toBe(true);
  });

  it('leaves the battle for home on a second tap within the wait, booking nothing', () => {
    const { w, g } = battle();
    const store = vi.spyOn(g, 'store');
    const quit = vi.spyOn(g.perf, 'quit');
    openPause(g);
    tap(w.stage, t('pause.giveUp'));
    g['tick'](GIVE_UP_WAIT - 0.5);
    tap(w.stage, t('pause.confirm'));
    expect(g.pause.open).toBe(false);
    expect(texts(w.stage)).not.toContain(t('pause.title'));
    expect(g['menu'].visible).toBe(true);
    expect(store).toHaveBeenCalled();
    expect(quit).toHaveBeenCalledOnce();
    expect(w.events('run_quit')).toEqual([expect.objectContaining({ giveUp: true })]);
    expect(w.events('run_end')).toEqual([]);
    expect(w.save().runs).toBe(8);
    expect(w.save().cleared).toBe(19);
  });

  it('is not offered in a new player first battle, even with the tutorial skipped', () => {
    const w = world(newMeta());
    expect(w.game['tutorial']).not.toBeNull();
    openPause(w.game);
    expect(buttons(w.stage, t('pause.resume'))).toHaveLength(1);
    expect(giveUpShown(w)).toBe(false);
    tap(w.stage, t('pause.resume'));
    endTutorial(w.game, true);
    openPause(w.game);
    expect(giveUpShown(w)).toBe(false);
  });

  it('is not offered while the tutorial points, past the first battle', () => {
    const save = newMeta();
    save.runs = 2;
    const w = world(save);
    play(w);
    expect(w.game['tutorial']).not.toBeNull();
    openPause(w.game);
    expect(giveUpShown(w)).toBe(false);
  });
});

describe('a battle that goes away under the panel', () => {
  it('takes the panel with it when the home screen comes up', () => {
    const { w, g } = battle();
    openPause(g);
    home(g);
    g['tick'](0.1);
    expect(g.pause.open).toBe(false);
    expect(texts(w.stage)).not.toContain(t('pause.title'));
  });

  it('takes the panel with it when the battle ends', () => {
    const { w, g } = battle();
    openPause(g);
    g['ended'] = true;
    g['tick'](0.1);
    expect(g.pause.open).toBe(false);
    expect(buttons(w.stage, t('pause.resume'))).toHaveLength(0);
  });
});

describe('the switches in the panel', () => {
  it('flip music and sound in the save, and keep it', () => {
    const { w, g } = battle();
    openPause(g);
    tap(w.stage, t('sound.music'));
    expect(w.save().sound.music).toBe(false);
    tap(w.stage, t('sound.sfx'));
    expect(w.save().sound.sfx).toBe(false);
    tap(w.stage, t('sound.music'));
    expect(w.save().sound.music).toBe(true);
    expect(g.pause.open, 'still paused').toBe(true);
  });

  it('flip vibration only where the host can vibrate', () => {
    const plain = battle();
    openPause(plain.g);
    expect(buttons(plain.w.stage, t('sound.haptics'))).toHaveLength(0);
    const { w, g } = battle(world(veteran(), (h: Host) => Object.assign(h, { vibrate: () => {} })));
    openPause(g);
    const was = w.game.save.sound.haptics;
    tap(w.stage, t('sound.haptics'));
    expect(w.save().sound.haptics).toBe(!was);
  });
});

describe('a phone held sideways', () => {
  /** A touch phone 390 by 844; its page starts upright. */
  const phone = () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('screen', { width: 390, height: 844 });
    return battle();
  };
  const turn = (g: World['game'], w: number, h: number) => Object.assign(g.app.screen, { width: w, height: h });
  const cover = (g: World['game']) => texts(g.pause.cover as Container);

  it('puts up the upright cover and pauses; turned back, it stays paused until Resume', () => {
    const { w, g, calls } = phone();
    g['tick'](0.1);
    expect(cover(g)).toEqual([]);
    expect(g.pause.open).toBe(false);
    turn(g, 1920, 1080);
    g['tick'](0.1);
    expect(cover(g)).toContain(t('rotate'));
    expect(g.pause.open).toBe(true);
    expect(calls).toEqual(['stop']);
    turn(g, 1080, 1920);
    const time = g['battle']!.time;
    g['tick'](0.1);
    expect(cover(g)).toEqual([]);
    expect(g.pause.open).toBe(true);
    expect(g['battle']!.time).toBe(time);
    tap(w.stage, t('pause.resume'));
    expect(g.pause.open).toBe(false);
    expect(calls).toEqual(['stop', 'start']);
  });

  it('keeps Resume from leaving the pause while still sideways', () => {
    const { w, g } = phone();
    turn(g, 1920, 1080);
    g['tick'](0.1);
    tap(w.stage, t('pause.resume'));
    g['tick'](0.1);
    expect(g.pause.open).toBe(true);
    expect(cover(g)).toContain(t('rotate'));
  });

  it('leaves a tablet or desktop playing on a wide screen', () => {
    const { g } = battle();
    turn(g, 1920, 1080);
    g['tick'](0.1);
    expect(cover(g)).toEqual([]);
    expect(g.pause.open).toBe(false);
  });
});
