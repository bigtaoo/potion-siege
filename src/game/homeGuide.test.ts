// The home guide (homeGuide.ts) on a real home screen: each chapter's hand and line, a tap that
// does the step, one that goes round it, the skip link, and steps with nothing to do passed over.
import '../view/layout/measure';
import { Container, Text } from 'pixi.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { gameDay } from '../sim/daily';
import { newMeta, type MetaSave } from '../sim/meta';
import { boxIn, overlap } from '../view/home/hintPlace';
import { liveWorld } from './flowHelpers';
import { home } from './homeScreen';
import { englishPage, tap, texts, world, type World } from './testWorld';

beforeAll(englishPage);

/** A new player back from `runs` battles, the welcome gift and login put away unless `edit`
 *  says otherwise. */
function fresh(runs: number, edit: (m: MetaSave) => void = () => {}): World {
  const m = newMeta();
  m.runs = runs;
  m.tutorial = true;
  m.cleared = runs;
  m.stage = runs + 1;
  m.crystals = 0;
  m.daily.lastClaim = gameDay(m, new Date());
  m.welcome.gifts = 99;
  edit(m);
  const w = world(m);
  w.game['tab'] = 'battle';
  home(w.game);
  return w;
}

const page = (w: World): Container => w.game['menu'].children[0];
const mark = (w: World) => page(w).getChildByLabel('guideMark', true);
const line = (w: World) => texts(page(w).getChildByLabel('guideCard', true) ?? new Container())[0]?.replace(/\n/g, ' ') ?? null;
/** Taps the button labelled `label` on the page. */
const press = (w: World, label: string) => page(w).getChildByLabel(label, true)!.emit('pointertap', { stopPropagation() {} } as never);
const steps = (w: World) => w.events('guide_step').map((e) => `${e.id}:${e.result}`);

describe('the home guide', () => {
  it('passes over what there is nothing to do for and ends chapter 1 at the start button', () => {
    const w = fresh(1);
    expect(line(w)).toBe(t('guide.toBattle1', { n: 2 }));
    expect(steps(w)).toEqual(['gift:none', 'upgrade:none', 'upgradeMore:none', 'upgradeLast:none']);
    expect(w.game['hintHand']).not.toBeNull();
    tap(w.stage, t('start'));
    expect(steps(w)).toContain('toBattle1:done');
    expect(w.save().guide).toContain('toBattle1');
  });

  it('points at the potion upgrade while the crystals last, three times at most', () => {
    const w = fresh(1, (m) => (m.crystals = 1000));
    expect(line(w)).toBe(t('guide.upgrade'));
    press(w, 'tab_potions');
    expect(line(w)).toBe(t('guide.upgrade'));
    // the potions tab draws its own hand on the price
    expect(page(w).getChildrenByLabel('hintHand', true)).toHaveLength(1);
    for (let i = 0; i < 3; i++) press(w, 'price_fire');
    expect(steps(w)).toEqual(['gift:none', 'upgrade:done', 'upgradeMore:done', 'upgradeLast:done']);
    expect(w.save().heroes.fire).toBe(4);
    expect(w.save().upgradeHint).toBe(true);
    // the start step's line waits for the battle tab, clear of the potion cards
    expect(line(w)).toBeNull();
    expect(mark(w)).not.toBeNull();
    press(w, 'tab_battle');
    expect(line(w)).toBe(t('guide.toBattle1', { n: 2 }));
  });

  it('marks a step gone round when the player taps elsewhere, and the skip link skips the rest', () => {
    const w = fresh(2, (m) => {
      m.daily.lastClaim = '';
      m.crystals = 500;
    });
    expect(line(w)).toBe(t('guide.login'));
    // the shop tab opened instead: the login was gone round
    press(w, 'tab_shop');
    // no task done yet: nothing to claim, on to the workshop
    expect(steps(w)).toEqual(['login:other', 'tasks:none']);
    // chapter 2 points at a potion's level again before the workshop
    expect(line(w)).toBe(t('guide.upgrade'));
    press(w, 'tab_workshop');
    expect(steps(w)).toContain('heroes2:other');
    expect(line(w)).toBe(t('guide.workshop'));
    press(w, 'guideSkip');
    expect(steps(w)).toContain('workshop:skipped');
    press(w, 'tab_battle');
    expect(line(w)).toBe(t('guide.toBattle', { n: 3 }));
  });

  it('is not there after the third chapter or in a save that played before it', () => {
    expect(mark(fresh(4))).toBeNull();
    const w = fresh(2, (m) => (m.guide = ['login', 'tasks', 'workshop', 'toBattle2']));
    expect(mark(w)).toBeNull();
  });

  it("keeps the codex line off the other claims on a wide page, its lines set left", () => {
    const m = newMeta();
    Object.assign(m, { runs: 3, tutorial: true, cleared: 3, stage: 4, crystals: 0 });
    m.daily.lastClaim = gameDay(m, new Date());
    m.welcome.gifts = 99;
    m.achievements.stats.merges = 100;
    for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }]) {
      const w = liveWorld(m, '', size);
      w.frame();
      w.game['tab'] = 'codex';
      home(w.game);
      const root = page(w);
      const card = root.getChildByLabel('guideCard', true)!;
      expect(line(w)).toBe(t('guide.codex'));
      const body = card.children.find((c): c is Text => c instanceof Text && c.text.includes('\n'));
      expect(body?.style.align).toBe('left');
      const box = boxIn(root, card);
      const covered: string[] = [];
      const walk = (c: Container) => {
        if (!c.visible || c.label === 'guideMark') return;
        const b = boxIn(root, c);
        // the page's own scroll area takes taps too, and lies under any line
        if (c.eventMode === 'static' && b.w * b.h < 120_000 && overlap(box, b) > 0) covered.push(c.label);
        c.children.forEach((k) => walk(k as Container));
      };
      walk(root);
      expect(covered, `${size.width}x${size.height}`).toEqual([]);
    }
  });
});
