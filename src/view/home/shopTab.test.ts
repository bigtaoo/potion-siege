// The shop tab drawn on its own (shopTab.ts): the freebies, the potions for sale and the ad-free
// strip, on a phone page and a wide one, read back by their English words.
import '../layout/measure';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { buttons, englishPage, texts } from '../../game/testWorld';
import { ADS_PER_DAY, newMeta, unlockPrice, type MetaSave } from '../../sim/meta';
import { HERO_KINDS } from '../../sim/types';
import { PillButton } from '../kit';
import { loggedActions } from './homeTestBits';
import type { HomeExtras } from './types';
import type { Area } from './shared';
import { shopTab } from './shopTab';

// every potion locked, the four the game starts with too: three to a row, and cards with no price
const lockAll = vi.hoisted(() => ({ on: false }));
vi.mock('../../sim/meta', async (orig) => {
  const real = await orig<typeof import('../../sim/meta')>();
  return { ...real, heroUnlocked: (m: MetaSave, k: never) => !lockAll.on && real.heroUnlocked(m, k) };
});

beforeAll(englishPage);
beforeEach(() => {
  lockAll.on = false;
});

const TODAY = '2026-10-28';
const PHONE: Area = { x: 0, y: 0, w: 1080, h: 1700, wide: false };
const WIDE: Area = { x: 0, y: 0, w: 2400, h: 1000, wide: true };

/** A save with every potion open (`open`) or only the starting four. */
function save(open = false, crystals = 0): MetaSave {
  const m = newMeta();
  m.crystals = crystals;
  if (open) m.unlocked = ['poison', 'wind'];
  return m;
}

function draw(m: MetaSave, a: Area, ads: boolean, hosted: boolean, adFree: HomeExtras['adFree'] | null = null) {
  const root = new Container();
  const { act, calls } = loggedActions();
  shopTab(root, m, act, a, TODAY, ads, hosted, adFree);
  return { root, calls, words: texts(root) };
}

/** The one pill button reading `caption`. */
function pill(root: Container, caption: string): PillButton {
  const found = buttons(root, caption);
  expect(found, `one button "${caption}"`).toHaveLength(1);
  return found[0] as PillButton;
}
const on = (b: PillButton) => b['enabled'] as boolean;
const press = (b: Container) => b.emit('pointertap', { stopPropagation() {} } as never);

function all(root: Container, test: (c: Container) => boolean): Container[] {
  const out: Container[] = [];
  const walk = (c: Container) => {
    if (test(c)) out.push(c);
    c.children.forEach(walk);
  };
  walk(root);
  return out;
}

describe('the freebies alone, every potion open', () => {
  it.each([
    ['a phone', PHONE],
    ['a wide page', WIDE],
  ])('show the chest and the ad on %s', (_, a) => {
    const { root, words, calls } = draw(save(true), a, true, true);
    expect(words).toContain(t('store.daily'));
    expect(words).not.toContain(t('store.unlocks'));
    expect(words).toContain(t('store.ad.desc', { n: ADS_PER_DAY, total: ADS_PER_DAY }));
    press(pill(root, t('store.watch')));
    press(pill(root, t('store.open')));
    expect(calls.map((c) => c[0])).toEqual(['watchAd', 'claimChest']);
  });

  it.each([
    ['a phone', PHONE],
    ['a wide page', WIDE],
  ])('leave the ad card out on %s where the host has no ads', (_, a) => {
    const { root, words } = draw(save(true), a, false, false);
    expect(words).not.toContain(t('store.ad.name'));
    expect(words).toContain(t('store.chest.name'));
    expect(on(pill(root, t('store.open')))).toBe(true);
  });

  it('put tomorrow on the chest once it was opened today', () => {
    const m = save(true);
    m.shop.chestDay = TODAY;
    const { root } = draw(m, PHONE, false, false);
    expect(on(pill(root, t('tomorrow')))).toBe(false);
  });
});

describe('the ad card', () => {
  it('waits on a turning spinner while the host has ads but none is loaded', () => {
    const { root, calls } = draw(save(), PHONE, false, true);
    const [wait] = all(root, (c) => c.label === 'adLoading') as PillButton[];
    expect(on(wait)).toBe(false);
    press(wait);
    expect(calls).toEqual([]);
    const spin = wait.children.find((c) => c instanceof Graphics && c.onRender) as Graphics;
    spin.onRender!(null as never);
    expect(spin.rotation).toBeGreaterThanOrEqual(0);
    expect(spin.rotation).toBeLessThan(Math.PI * 2);
  });

  it('says tomorrow, greyed, once today\'s ads are used up', () => {
    const m = save();
    m.shop.adDay = TODAY;
    m.shop.ads = ADS_PER_DAY;
    const { root, words } = draw(m, PHONE, true, true);
    expect(words).toContain(t('store.ad.desc', { n: 0, total: ADS_PER_DAY }));
    expect(on(pill(root, t('tomorrow')))).toBe(false);
  });
});

describe('the potions for sale', () => {
  it.each([
    ['a phone with ads', PHONE, true],
    ['a phone without', PHONE, false],
    ['a wide page with ads', WIDE, true],
    ['a wide page without', WIDE, false],
  ])('sell the two locked ones on %s, priced against the crystals', (_, a, ads) => {
    const poison = unlockPrice('poison')!;
    const { root, words, calls } = draw(save(false, poison), a, ads, ads);
    expect(words).toContain(t('store.unlocks'));
    expect(words).toContain(t('hero.poison'));
    expect(words).toContain(t('hero.wind'));
    const buy = pill(root, String(poison));
    const dear = pill(root, String(unlockPrice('wind')));
    expect(on(buy)).toBe(true);
    expect(on(dear)).toBe(false);
    press(buy);
    press(dear);
    expect(calls).toEqual([['unlock', ['poison']]]);
    expect(words.join(' ')).toContain(t('unlockAt', { n: 5 }).split('\n')[0]);
  });

  it.each([
    ['a phone', PHONE, true],
    ['a wide page', WIDE, true],
    ['a wide page without ads', WIDE, false],
  ])('go three to a row on %s, the starting ones without a price or a stage', (_, a, ads) => {
    lockAll.on = true;
    const { root, words } = draw(save(), a, ads, ads);
    for (const k of HERO_KINDS) expect(words).toContain(t(`hero.${k}`));
    // only poison and wind are sold; the other four say they are locked, with no stage to open them
    expect(all(root, (c) => c instanceof PillButton && buttons(c, String(unlockPrice('poison'))).length > 0)).toHaveLength(1);
    expect(words.filter((w) => w === t('codex.locked'))).toHaveLength(4);
  });
});

describe('the ad-free strip', () => {
  it('sells the card at its price, with Restore under the line', () => {
    const { root, words, calls } = draw(save(true), PHONE, false, false, { price: '€2.99', owned: false, note: null });
    expect(words).toContain(t('store.adFree.name'));
    expect(words).toContain(t('store.adFree.desc'));
    expect(on(pill(root, '€2.99'))).toBe(true);
    press(pill(root, '€2.99'));
    press(all(root, (c) => texts(c).join() === t('store.adFree.restore') && c.listenerCount('pointertap') > 0)[0]);
    expect(calls.map((c) => c[0])).toEqual(['buyAdFree', 'restoreAdFree']);
  });

  it('waits on the price with the button off, and shows a note instead of the line', () => {
    const { root, words } = draw(save(), WIDE, true, true, { price: null, owned: false, note: 'Restored' });
    expect(words).toContain('Restored');
    expect(words).not.toContain(t('store.adFree.desc'));
    expect(on(pill(root, '…'))).toBe(false);
  });

  it('says owned, with no button and no Restore, once bought', () => {
    const { root, words } = draw(save(), PHONE, true, true, { price: '€2.99', owned: true, note: null });
    expect(words).toContain(t('store.owned'));
    expect(words).not.toContain(t('store.adFree.restore'));
    expect(buttons(root, '€2.99')).toEqual([]);
  });
});
