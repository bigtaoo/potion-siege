// The home guide's one-time pointers after its chapters (homeGuideLate.ts) on a real home screen:
// a chapter's chest through the chapters panel and then the panel's close, endless after it, a new
// potion on the bench, a chapter's start step waiting for them, and chapter 2's workshop step on
// the wall.
import '../view/layout/measure';
import { Container } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { gameDay } from '../sim/daily';
import { GUIDE_CHAPTERS } from '../sim/guide';
import { newMeta, type MetaSave } from '../sim/meta';
import { guideAim, guideWorkshop } from './homeGuide';
import { home } from './homeScreen';
import { englishPage, texts, world, type World } from './testWorld';

beforeAll(englishPage);

/** A player back from `runs` battles with `cleared` stages won, the chapters' steps done. */
function back(runs: number, cleared: number, edit: (m: MetaSave) => void = () => {}): World {
  const m = newMeta();
  m.runs = runs;
  m.tutorial = true;
  m.cleared = cleared;
  m.stage = cleared + 1;
  m.crystals = 0;
  m.daily.lastClaim = gameDay(m, new Date());
  m.welcome.gifts = 99;
  m.guide = GUIDE_CHAPTERS.flat();
  edit(m);
  const w = world(m);
  w.game['tab'] = 'battle';
  home(w.game);
  return w;
}

const page = (w: World): Container => w.game['menu'].children[0];
const mark = (w: World) => page(w).getChildByLabel('guideMark', true);
const line = (w: World) => texts(page(w).getChildByLabel('guideCard', true) ?? new Container())[0]?.replace(/\n/g, ' ') ?? null;
const press = (w: World, label: string) => page(w).getChildByLabel(label, true)!.emit('pointertap', { stopPropagation() {} } as never);
const steps = (w: World) => w.events('guide_step').map((e) => `${e.id}:${e.result}`);
/** What the hand is on: the guide's target on this screen. */
const aimed = (w: World) => guideAim(w.game, w.game.panel, w.game.tab, gameDay(w.game.save, new Date()))?.target ?? null;

describe('the one-time home pointers', () => {
  it("leads to a finished chapter's chest and its star chest, then to the panel's close, then to endless", () => {
    const w = back(10, 10, (m) => m.guide.push('lineup'));
    expect(line(w)).toBe(t('guide.chapterChest'));
    expect(aimed(w)).toBe('stageCard');
    press(w, 'stageCard');
    expect(aimed(w)).toBe('chapter_chest');
    press(w, 'chapter_chest');
    expect(steps(w)).toEqual(['chapterChest:done']);
    // the chapter's stars filled a chest in the same panel
    expect(aimed(w)).toBe('star_chest');
    press(w, 'star_chest');
    expect(steps(w)).toEqual(['chapterChest:done', 'starChest:done']);
    // both chests open: the next pointer is outside the panel, so the hand is on its close
    expect(aimed(w)).toBe('panel_close');
    expect(line(w)).toBeNull();
    press(w, 'panel_close');
    expect(line(w)).toBe(t('guide.endless'));
    expect(aimed(w)).toBe('endless');
  });

  it("points at an open panel's own claim before its close, the claim going round no step", () => {
    const w = back(10, 10, (m) => {
      m.guide.push('chapterChest', 'starChest');
      m.daily.lastClaim = '';
    });
    home(w.game, 'login');
    expect(aimed(w)).toBe('claim_login');
    press(w, 'claim_login');
    // claimed: the claim is gone, and no step was counted done or gone round
    expect(steps(w)).toEqual([]);
    expect(aimed(w)).not.toBe('claim_login');
  });

  it('shows a new potion its place in the lineup, and counts a tap elsewhere as gone round', () => {
    const w = back(5, 5, (m) => m.unlocked.push('poison'));
    expect(aimed(w)).toBe('tab_potions');
    press(w, 'tab_potions');
    expect(aimed(w)).toBe('bench');
    expect(line(w)).toBe(t('guide.lineup'));
    press(w, 'tab_workshop');
    expect(steps(w)).toEqual(['lineup:other']);
    expect(mark(w)).toBeNull();
  });

  it("goes before a chapter's start step, and the skip link drops only itself", () => {
    const w = back(1, 1, (m) => {
      m.guide = ['gift', 'upgrade', 'upgradeMore', 'upgradeLast'];
      m.unlocked.push('poison');
    });
    expect(line(w)).toBe(t('guide.lineup'));
    press(w, 'guideSkip');
    expect(steps(w)).toEqual(['lineup:skipped']);
    expect(line(w)).toBe(t('guide.toBattle1', { n: 2 }));
  });

  it('is gone once each pointer is done or skipped', () => {
    const w = back(10, 10, (m) => m.guide.push('chapterChest', 'starChest', 'lineup', 'endless', 'hard'));
    expect(mark(w)).toBeNull();
  });
});

describe("chapter 2's workshop step", () => {
  it('points at the wall when the crystals pay for it, else the cheapest level', () => {
    const m = newMeta();
    m.crystals = 10_000;
    expect(guideWorkshop(m)).toBe('wall');
    m.crystals = 0;
    expect(guideWorkshop(m)).toBeNull();
  });
});
