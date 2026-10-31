import '../layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { englishPage, tap, texts } from '../../game/testWorld';
import { t } from '../../i18n';
import { newMeta } from '../../sim/meta';
import { STAR_CHESTS } from '../../sim/starChest';
import { chaptersPanel } from './chaptersPanel';
import { loggedActions, PHONE } from './homeTestBits';
import { starChestBar } from './starChestBar';

beforeAll(englishPage);

/** Chapter 1 cleared with every stage at `each` stars. */
function chapterOne(each: number) {
  const m = newMeta();
  m.cleared = 10;
  m.stage = 11;
  for (let i = 0; i < 10; i++) m.stars.normal[i] = each;
  return m;
}

describe("a chapter's star chests", () => {
  it('shows what the next tier pays while none is reached', () => {
    const m = newMeta();
    const { act } = loggedActions();
    const bar = starChestBar(m, act, 1);
    expect(texts(bar)).toContain(String(STAR_CHESTS[0].reward));
    expect(texts(bar)).toContain(`★${STAR_CHESTS[2].stars}`);
  });

  it('opens the reached tiers from the chapters panel', () => {
    const m = chapterOne(2);
    const { act, calls } = loggedActions();
    const panel = chaptersPanel(m, act, PHONE);
    const bar = panel.getChildByLabel('starChests_1', true)!;
    tap(bar, t('chapter.chestOpen'));
    expect(calls.filter(([k]) => k === 'claimStarChest').map(([, a]) => a[0])).toEqual([1]);
  });

  it('says so once all three are open', () => {
    const m = chapterOne(3);
    m.starChests[0] = STAR_CHESTS.length;
    const { act } = loggedActions();
    expect(texts(starChestBar(m, act, 1))).toContain(t('chapter.chestDone'));
  });
});
