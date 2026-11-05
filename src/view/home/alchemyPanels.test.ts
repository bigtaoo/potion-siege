// The late-game panels (rebrew, week, talents) and the battle tab's "next thing" pill, drawn on
// hand-built saves: what each shows and which action its buttons ask for.
import '../layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { englishPage, tap, texts } from '../../game/testWorld';
import { newMeta, type MetaSave } from '../../sim/meta';
import { essenceFor, perkCost } from '../../sim/rebrew';
import { BALANCE, REACTION_IDS } from '../../sim/types';
import { rollWeek, weekGoal, weekOf, weekRule } from '../../sim/week';
import { nextThing } from './nextCard';
import { loggedActions, PHONE } from './homeTestBits';
import { rebrewPanel } from './rebrewPanel';
import { talentPanel } from './talentPanel';
import { ruleName, weekPanel } from './weekPanel';

const TODAY = '2026-11-05';
const R = BALANCE.alchemy.rebrew;

beforeAll(englishPage);

/** A save past the whole campaign. */
function done(): MetaSave {
  const m = newMeta();
  m.cleared = BALANCE.meta.stageCount;
  m.stage = BALANCE.meta.stageCount;
  return m;
}

describe('the week panel', () => {
  it("names today's rule and no best yet on a save still in an older week", () => {
    const m = done();
    rollWeek(m, '2026-10-20');
    m.alchemy.week.best = 40;
    const words = texts(weekPanel(m, loggedActions().act, TODAY, true, PHONE));
    expect(words).toContain(t('alchemy.week.rule', { name: ruleName(weekRule(weekOf(TODAY))) }));
    expect(words).toContain(t('alchemy.week.best', { n: 0 }));
  });

  it('pays a task once its goal is met, and offers the climb only with the tower open', () => {
    const m = done();
    rollWeek(m, TODAY);
    m.alchemy.week.reactions = weekGoal('react');
    m.alchemy.week.best = 7;
    const { act, calls } = loggedActions();
    const panel = weekPanel(m, act, TODAY, true, PHONE);
    expect(texts(panel)).toContain(t('alchemy.week.best', { n: 7 }));
    const claim = panel.getChildByLabel('claimWeek_react', true)!;
    claim.emit('pointertap', { stopPropagation() {} } as never);
    expect(calls.map((c) => c[0])).toContain('claimWeek');
    tap(panel, t('alchemy.week.play'));
    expect(calls.map((c) => c[0])).toContain('endless');
    expect(texts(weekPanel(m, act, TODAY, false, PHONE))).not.toContain(t('alchemy.week.play'));
  });
});

describe('the rebrew panel', () => {
  it('asks a second tap before pouring the save back', () => {
    const m = done();
    const { act, calls } = loggedActions();
    const first = rebrewPanel(m, act, PHONE, false);
    tap(first, t('alchemy.rebrew.go', { n: essenceFor(m) }));
    expect(calls).toEqual([['panel', ['rebrewSure']]]);
    tap(rebrewPanel(m, act, PHONE, true), t('alchemy.rebrew.sure'));
    expect(calls[calls.length - 1]![0]).toBe('rebrew');
  });

  it('stays shut before the campaign is cleared, and sells a perk once essence covers it', () => {
    const m = newMeta();
    const { act, calls } = loggedActions();
    tap(rebrewPanel(m, act, PHONE, false), t('alchemy.rebrew.locked', { n: R.from }));
    expect(calls).toEqual([]);
    m.alchemy.rebrew.essence = perkCost('wall', 0)!;
    tap(rebrewPanel(m, act, PHONE, false), `${perkCost('wall', 0)} ✦`);
    expect(calls[calls.length - 1]).toEqual(['perk', ['wall']]);
  });
});

describe('the talent panel', () => {
  it('lists the tiers and draws for any potion', () => {
    const m = done();
    m.heroes.fire = 30;
    const words = texts(talentPanel(m, loggedActions().act, 'fire', PHONE));
    expect(words.join(' ')).toContain(t('alchemy.talents.free'));
  });
});

describe('the next thing', () => {
  it('stays away early, then names a rebrew before anything else', () => {
    expect(nextThing(newMeta(), TODAY)).toBeNull();
    expect(nextThing(done(), TODAY)?.go).toBe('rebrew');
  });

  it('points to the week, the codex and the tower in that order', () => {
    const m = newMeta();
    m.cleared = 20;
    m.stage = 21;
    rollWeek(m, TODAY);
    m.alchemy.week.reactions = weekGoal('react');
    expect(nextThing(m, TODAY)?.go).toBe('week');
    m.alchemy.week.claimed = ['react'];
    m.achievements.stats.reactions[REACTION_IDS[0]!] = 1;
    expect(nextThing(m, TODAY)?.go).toBe('codex');
    for (const id of REACTION_IDS) m.achievements.stats.reactions[id] = 1;
    // the tower's line names today's rule even before the save has rolled on to its week
    m.alchemy.week.id = '';
    expect(nextThing(m, TODAY)).toEqual({ text: t('alchemy.next.tower', { name: ruleName(weekRule(weekOf(TODAY))), n: 0 }), go: 'endless' });
  });
});
