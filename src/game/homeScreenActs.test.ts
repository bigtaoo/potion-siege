// The home screen's actions (homeScreen.ts) called the way a stale page calls them: a second tap
// on a button of the page drawn before the first tap paid, an arrow past the open stages, a copy
// that lands after its panel closed, and the one-time upgrade pointer followed tab to tab. The
// actions handed to buildHome are kept as each page is drawn.
import '../view/layout/measure';
import { Container } from 'pixi.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { gameDay } from '../sim/daily';
import { heroCost, type MetaSave } from '../sim/meta';
import type { HomeActions } from '../view/Home';
import { home } from './homeScreen';
import { englishPage, flush, veteran, world, type World } from './testWorld';

const drawn: { act: HomeActions | null } = { act: null };
/** The button a claim is tapped on, off the page. */
const btn = new Container();

vi.mock('../view/Home', async (actual) => {
  const real = await actual<typeof import('../view/Home')>();
  return {
    ...real,
    buildHome: (...a: Parameters<typeof real.buildHome>) => {
      drawn.act = a[1];
      return real.buildHome(...a);
    },
  };
});

beforeAll(englishPage);

/** A veteran on `tab` with the login put away, and the actions of the page drawn. */
function at(tab: 'battle' | 'potions' | 'shop', edit: (m: MetaSave) => void = () => {}, setup?: Parameters<typeof world>[1]) {
  const m = veteran();
  m.daily.lastClaim = gameDay(m, new Date());
  edit(m);
  const w = world(m, setup);
  w.game['tab'] = tab;
  home(w.game);
  return { w, act: drawn.act! };
}

/** The page on the menu now: the same object while nothing drew it again. */
const page = (w: World) => w.game['menu'].children[0];

describe('a stale tap on the home screen', () => {
  it('pays nothing for a claim with nothing to claim, and leaves the page as it is', () => {
    const { w, act } = at('battle', (m) => (m.achievements.stats.merges = 0));
    const before = page(w);
    act.claimLogin(btn);
    act.claimTask(0, btn);
    act.claimBonus(btn);
    act.claimTier('merges', btn);
    expect(page(w)).toBe(before);
    expect(w.game.save.crystals).toBe(100);
    expect(w.events('daily_claim')).toEqual([]);
    expect(w.events('dialog')).toEqual([]);
  });

  it("pays a chapter's chest and the free chest once, however often their buttons are tapped", () => {
    const { w, act } = at('shop');
    act.claimChest(btn);
    act.claimChapter(1, btn);
    const paid = w.game.save.crystals;
    expect(paid).toBeGreaterThan(100);
    const after = page(w);
    // the buttons of the page before both claims, tapped again
    act.claimChest(btn);
    act.claimChapter(1, btn);
    expect(page(w)).toBe(after);
    expect(w.game.save.crystals).toBe(paid);
    expect(w.events('daily_claim').map((e) => e.item)).toEqual(['shop_chest', 'chapter_1']);
  });

  it('moves to no stage past the open ones, nor picks a locked one', () => {
    const { w, act } = at('battle');
    const before = page(w);
    act.stage(1);
    act.pickStage(21);
    act.pickStage(0);
    expect(page(w)).toBe(before);
    expect(w.game.save.stage).toBe(20);
    expect(w.host.storage.getItem('mb.save')).toContain('"stage":20');
  });
});

describe('the player ID copy', () => {
  it('copies nothing on a host with no clipboard', () => {
    const { w, act } = at('battle');
    home(w.game, 'settings');
    drawn.act!.copyId();
    act.copyId();
    expect(w.game.idNote).toBeNull();
  });

  it('keeps its note but opens no settings again once they were closed before it landed', async () => {
    const copied: string[] = [];
    const { w } = at('battle', () => {}, (h) => Object.assign(h, { copyText: async (s: string) => (copied.push(s), true) }));
    home(w.game, 'settings');
    drawn.act!.copyId();
    drawn.act!.panel(null);
    await flush();
    expect(copied).toEqual([w.analytics.playerId]);
    expect(w.game.idNote).toBe('copied');
    expect(w.game.panel).toBeNull();
  });

  it('draws nothing when it lands during a battle', async () => {
    const { w } = at('battle', () => {}, (h) => Object.assign(h, { copyText: async () => false }));
    home(w.game, 'settings');
    drawn.act!.copyId();
    drawn.act!.play();
    await flush();
    expect(w.game.idNote).toBe('failed');
    expect(w.game['menu'].visible).toBe(false);
    expect(w.game['menu'].children).toHaveLength(0);
  });
});

describe('the upgrade pointer', () => {
  /** A player after the first battle with crystals for an upgrade, the pointer not yet done. */
  const pointer = (tab: 'battle' | 'potions') =>
    at(tab, (m) => {
      m.upgradeHint = false;
      m.crystals = 1000;
    });

  it('points at the potions tab from another tab, then at the button there', () => {
    const { w, act } = pointer('battle');
    expect(w.game.hintOnButton).toBe(false);
    expect(w.events('hint_upgrade_tab')).toEqual([{ run: 8 }]);
    act.tab('potions');
    expect(w.game.hintOnButton).toBe(true);
    expect(w.events('hint_upgrade_button')).toEqual([{ run: 8 }]);
  });

  it('stays on the button while the potions tab is tapped again, and is over once the player leaves', () => {
    const { w } = pointer('potions');
    drawn.act!.tab('potions');
    expect(w.game.hintOnButton).toBe(true);
    expect(w.events('hint_upgrade_done')).toEqual([]);
    drawn.act!.tab('battle');
    expect(w.game.hintOnButton).toBe(false);
    expect(w.save().upgradeHint).toBe(true);
    expect(w.events('hint_upgrade_done')).toEqual([{ bought: false, run: 8 }]);
  });

  it('is over, bought, once the player upgrades a potion', () => {
    const { w, act } = pointer('potions');
    const lv = w.game.save.heroes.fire;
    act.hero('fire');
    expect(w.save().heroes.fire).toBe(lv + 1);
    expect(w.save().crystals).toBe(1000 - heroCost(lv)!);
    expect(w.events('hint_upgrade_done')).toEqual([{ bought: true, run: 8 }]);
  });

  it('is over, not bought, once the player starts a battle instead', () => {
    const { w, act } = pointer('potions');
    act.play();
    expect(w.game['menu'].visible).toBe(false);
    expect(w.save().upgradeHint).toBe(true);
    expect(w.events('hint_upgrade_done')).toEqual([{ bought: false, run: 8 }]);
  });
});
