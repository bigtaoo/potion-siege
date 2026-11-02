// The idle hand on a later player's home screen (homeIdle.ts) on a real home screen: it waits
// IDLE_HINT.home of quiet, points at something to claim before the start button, at a panel's
// close when the panel has nothing to point at, rests after IGNORE_LIMIT shows in vain until the
// next battle, and stays off with hints off, in the first battles and under a guide hand.
import '../view/layout/measure';
import { Container } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { gameDay } from '../sim/daily';
import { GUIDE_CHAPTERS, GUIDE_LATER } from '../sim/guide';
import { newMeta, type MetaSave } from '../sim/meta';
import { IGNORE_LIMIT } from '../view/nextMove';
import { IDLE_HINT } from '../view/nudges';
import { took } from './homeIdle';
import { home, homeFrame } from './homeScreen';
import { englishPage, world, type World } from './testWorld';

beforeAll(englishPage);

/** A player back from `runs` battles, every guide step behind them and nothing to claim. */
function back(runs: number, edit: (m: MetaSave) => void = () => {}): World {
  const m = newMeta();
  m.runs = runs;
  m.tutorial = true;
  m.upgradeHint = true;
  // nothing cleared yet: no codex step to claim
  m.cleared = 0;
  m.stage = 1;
  m.crystals = 0;
  const today = gameDay(m, new Date());
  m.daily.lastClaim = today;
  m.shop.chestDay = today;
  m.welcome.gifts = 99;
  m.guide = [...GUIDE_CHAPTERS.flat(), ...GUIDE_LATER];
  edit(m);
  const w = world(m);
  w.game['tab'] = 'battle';
  // the day's login was shown by itself already
  w.game.loginShown = today;
  home(w.game);
  return w;
}

const page = (w: World): Container => w.game['menu'].children[0];
/** What the idle hand is on: the button under its mark, or null. */
const marked = (w: World) => (page(w).getChildByLabel('guideMark', true) ? shown(w) : null);
const shown = (w: World) => (w.events('idle_hint').filter((e) => e.result === 'shown').slice(-1)[0]?.target as string) ?? null;
const press = (w: World, label: string) => page(w).getChildByLabel(label, true)!.emit('pointertap', { stopPropagation() {} } as never);
const wait = (w: World, s: number) => homeFrame(w.game, s);

describe('the idle hand at home', () => {
  it('waits for the quiet, then points at the start button', () => {
    const w = back(5);
    wait(w, IDLE_HINT.home - 0.1);
    expect(marked(w)).toBeNull();
    wait(w, 0.1);
    expect(marked(w)).toBe('start');
    expect(w.events('idle_hint')).toEqual([{ where: 'home', target: 'start', result: 'shown', run: 5 }]);
  });

  it('puts something to claim first, follows it into its panel, and counts the taps that took it', () => {
    const w = back(5, (m) => (m.daily.lastClaim = ''));
    wait(w, IDLE_HINT.home);
    expect(marked(w)).toBe('login');
    press(w, 'top_login');
    expect(w.events('idle_hint').map((e) => e.result)).toEqual(['shown', 'followed']);
    wait(w, IDLE_HINT.home);
    expect(page(w).getChildByLabel('claim_login', true)).not.toBeNull();
    expect(marked(w)).toBe('login');
  });

  it("goes to a panel's close when nothing in it is to be done", () => {
    const w = back(5);
    press(w, 'top_settings');
    wait(w, IDLE_HINT.home);
    expect(marked(w)).toBe('close');
    press(w, 'panel_close');
    expect(w.events('idle_hint').slice(-1)[0]).toMatchObject({ target: 'close', result: 'followed' });
  });

  it('rests a pick shown IGNORE_LIMIT times in vain until the next battle', () => {
    const w = back(5);
    for (let i = 0; i < IGNORE_LIMIT; i++) {
      home(w.game);
      wait(w, IDLE_HINT.home);
      expect(marked(w)).toBe('start');
    }
    home(w.game);
    wait(w, IDLE_HINT.home);
    expect(page(w).getChildByLabel('guideMark', true)).toBeNull();
    w.game.save.runs++;
    home(w.game);
    wait(w, IDLE_HINT.home);
    expect(marked(w)).toBe('start');
  });

  it('stays off with hints off, in the first battles and in autoplay', () => {
    for (const w of [back(5, (m) => (m.sound.hints = false)), back(2)]) {
      wait(w, IDLE_HINT.home * 2);
      expect(page(w).getChildByLabel('guideMark', true)).toBeNull();
    }
  });

  it('hands the switch to the battle and reports its idle hand', () => {
    const w = back(5, (m) => (m.sound.hints = false));
    expect(w.game.hud.hints).toBe(false);
    w.game.hud.next.onHint('pair', 'followed');
    expect(w.events('idle_hint')).toEqual([{ where: 'battle', target: 'pair', result: 'followed', run: 5 }]);
  });
});

describe('a tap that takes the hint', () => {
  const start = { id: 'start', label: 'tab_battle', rule: { can: () => true, aim: () => null, tap: (a: string) => (a === 'play' ? 'done' as const : 'path' as const) } };
  it('is the pick itself or the tab or panel button on its way', () => {
    expect(took(start, 'play', undefined)).toBe(true);
    expect(took(start, 'tab', 'battle')).toBe(true);
    expect(took(start, 'tab', 'shop')).toBe(false);
    expect(took({ ...start, label: 'top_login' }, 'panel', 'login')).toBe(true);
    expect(took({ ...start, label: 'stageCard' }, 'panel', 'chapters')).toBe(true);
    expect(took({ ...start, label: 'stageCard' }, 'panel', 'settings')).toBe(false);
    expect(took({ id: 'close', label: 'panel_close', rule: null }, 'panel', null)).toBe(true);
    expect(took({ id: 'close', label: 'panel_close', rule: null }, 'tab', 'shop')).toBe(false);
  });
});
