// The rewarded ads and the ad-free card as the player meets them: the real game over a stand-in
// Pixi app and a host whose ads answer as each test scripts them, driven by tapping the real
// buttons. An ad can be watched, closed early, fail to load, or break (the host throws).
import './view/layout/measure';
import { beforeAll, describe, expect, it } from 'vitest';
import { Container, Text, type Application } from 'pixi.js';
import { Analytics } from './analytics/analytics';
import { MemorySink } from './analytics/sinks';
import { PrivacyChoice } from './analytics/privacy';
import { loadLocale, setLocale, t } from './i18n';
import { SafeStore, type Platform, type Store } from './platform/types';
import { AD_CRYSTALS, ADS_PER_DAY, adsLeft, doublesLeft, newMeta, type MetaSave } from './sim/meta';
import { dayOf } from './sim/daily';
import { Game } from './app';

type Answer = 'watched' | 'closed' | 'failed' | 'broke';

/** A host whose rewarded ads answer from `answers`, in order. */
class Host implements Platform {
  readonly name = 'test';
  storage = new SafeStore(null);
  answers: Answer[] = [];
  available = true;
  rewardedCalls = 0;
  midgames = 0;
  celebrated = 0;
  muted: boolean[] = [];
  store: Store | null = null;
  languages(): string[] {
    return ['en'];
  }
  loaded(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  celebrate(): void {
    this.celebrated++;
  }
  rewardedAvailable(): boolean {
    return this.available;
  }
  async rewarded(onStart: () => void): Promise<boolean> {
    this.rewardedCalls++;
    const a = this.answers.shift();
    if (a === undefined) throw new Error('no ad scripted');
    if (a === 'broke') throw new Error('the ad broke');
    if (a === 'failed') return false;
    onStart();
    await Promise.resolve();
    return a === 'watched';
  }
  async midgame(onStart: () => void): Promise<void> {
    this.midgames++;
    onStart();
  }
  onHostMute(): void {}
}

/** The ad-free card's store, answering buy and restore as scripted. */
class Card implements Store {
  isOwned = false;
  cost: string | null = '$4.99';
  buys: (Awaited<ReturnType<Store['buy']>> | 'broke')[] = [];
  restores: (Awaited<ReturnType<Store['restore']>> | 'broke')[] = [];
  price(): string | null {
    return this.cost;
  }
  owned(): boolean {
    return this.isOwned;
  }
  async buy() {
    const a = this.buys.shift() ?? 'failed';
    if (a === 'broke') throw new Error('StoreKit broke');
    if (a === 'owned') this.isOwned = true;
    return a;
  }
  async restore() {
    const a = this.restores.shift() ?? 'failed';
    if (a === 'broke') throw new Error('StoreKit broke');
    if (a === 'owned') this.isOwned = true;
    return a;
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A player some battles in, past the tutorial and on stage 20 with weak potions, so an idle
 *  battle there is lost within a few waves. */
function veteran(): MetaSave {
  const m = newMeta();
  m.runs = 8;
  m.tutorial = true;
  m.upgradeHint = true;
  m.cleared = 19;
  m.stage = 20;
  m.crystals = 100;
  m.achievements.stats.merges = 5;
  return m;
}

interface World {
  game: Game;
  host: Host;
  stage: Container;
  sink: MemorySink;
  analytics: Analytics;
  save(): MetaSave;
  events(name: string): Record<string, unknown>[];
}

function world(save: MetaSave = veteran(), setup: (h: Host) => void = () => {}): World {
  const host = new Host();
  setup(host);
  host.storage.setItem('mb.save', JSON.stringify(save));
  const stage = new Container();
  const app = { stage, ticker: { add() {} }, screen: { width: 1080, height: 1920 }, renderer: {} } as unknown as Application;
  const sink = new MemorySink();
  const analytics = new Analytics(host.storage, [sink], 'test', host.name);
  const game = new Game(app, host, new URLSearchParams('speed=200'), analytics, new PrivacyChoice(host.storage, 'notice'));
  game.start();
  return {
    game,
    host,
    stage,
    sink,
    analytics,
    save: () => JSON.parse(host.storage.getItem('mb.save')!) as MetaSave,
    events: (name) => {
      analytics.flush();
      return sink.events.filter((e) => e.name === name).map((e) => e.props);
    },
  };
}

function shown(c: Container): boolean {
  for (let n: Container | null = c; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/** The shown, tappable things under `root` with a Text reading `caption` in them. */
function buttons(root: Container, caption: string): Container[] {
  const out: Container[] = [];
  const has = (c: Container): boolean => (c instanceof Text && c.text === caption) || c.children.some(has);
  const walk = (c: Container): void => {
    if (!c.visible) return;
    if (c.listenerCount('pointertap') > 0 && has(c) && shown(c)) out.push(c);
    for (const k of c.children) walk(k);
  };
  walk(root);
  return out;
}

/** Taps the one button reading `caption`, as the player would. */
function tap(root: Container, caption: string): void {
  const found = buttons(root, caption);
  expect(found, `one button "${caption}"`).toHaveLength(1);
  found[0].emit('pointertap', { stopPropagation() {} } as never);
}

/** Runs the battle on, picking the first card at each offer, until its result screen is up. */
function playToEnd(w: World, pick = (g: Game) => g['pick'](g['battle']!.choices![0])): void {
  const g = w.game;
  for (let i = 0; i < 2000 && !g['ended']; i++) {
    g['tick'](0.1);
    if (g['battle']?.choices && g['overlay'].visible) pick(g);
  }
  expect(g['ended'], 'the battle ended').toBe(true);
  expect(g['overlay'].visible).toBe(true);
}

/** Starts a battle from the home screen's play button. */
function play(w: World): void {
  w.game['tab'] = 'battle';
  w.game['home']();
  tap(w.stage, t('start'));
  expect(w.game['menu'].visible).toBe(false);
}

beforeAll(async () => {
  const doc = { addEventListener() {}, visibilityState: 'visible' };
  (globalThis as { document?: unknown }).document ??= doc;
  await loadLocale('en');
  setLocale('en');
});

describe('the shop ad', () => {
  const today = dayOf(new Date());
  const open = (w: World) => {
    w.game['tab'] = 'shop';
    w.game['home']();
  };

  it('pays its crystals when watched, and counts against the day', async () => {
    const w = world();
    open(w);
    w.host.answers = ['watched'];
    tap(w.stage, t('store.watch'));
    expect(w.game['menu'].interactiveChildren, 'no second tap while it plays').toBe(false);
    await flush();
    expect(w.save().crystals).toBe(100 + AD_CRYSTALS);
    expect(adsLeft(w.save(), today)).toBe(ADS_PER_DAY - 1);
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(w.events('ad_shop')).toEqual([{ ok: true }]);
  });

  it.each(['closed', 'failed', 'broke'] as const)('pays nothing when the ad was %s, and gives the menu back', async (answer) => {
    const w = world();
    open(w);
    w.host.answers = [answer];
    tap(w.stage, t('store.watch'));
    await flush();
    expect(w.save().crystals).toBe(100);
    expect(adsLeft(w.save(), today)).toBe(ADS_PER_DAY);
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(w.game['menu'].visible).toBe(true);
    expect(w.events('ad_shop')).toEqual([{ ok: false }]);
  });

  it('stops at the daily cap: the button turns off and a stray tap plays nothing', async () => {
    const w = world();
    open(w);
    for (let i = 0; i < ADS_PER_DAY; i++) {
      w.host.answers = ['watched'];
      tap(w.stage, t('store.watch'));
      await flush();
    }
    expect(w.save().crystals).toBe(100 + ADS_PER_DAY * AD_CRYSTALS);
    expect(buttons(w.stage, t('store.watch'))).toHaveLength(0);
    expect(buttons(w.stage, t('tomorrow')).length).toBeGreaterThan(0);
    // the action itself guards the cap too, whatever calls it
    await w.game['shopAd']();
    expect(w.host.rewardedCalls).toBe(ADS_PER_DAY);
    expect(w.save().crystals).toBe(100 + ADS_PER_DAY * AD_CRYSTALS);
  });

  it('drops the ad card where the host has none, the free chest left on its own', () => {
    const w = world(veteran(), (h) => (h.available = false));
    open(w);
    expect(buttons(w.stage, t('store.watch'))).toHaveLength(0);
    expect(texts(w.stage)).not.toContain(t('store.ad.name'));
    expect(texts(w.stage)).toContain(t('store.chest.name'));
  });
});

describe("the challenge's second go", () => {
  const used = () => {
    const m = veteran();
    const today = dayOf(new Date());
    m.challenge.date = today;
    m.challenge.attempts = 1;
    return m;
  };

  it('starts the retry when the ad was watched', async () => {
    const w = world(used());
    w.game['home']('challenge');
    w.host.answers = ['watched'];
    tap(w.stage, t('challenge.retry'));
    await flush();
    expect(w.game['challenge']).not.toBeNull();
    expect(w.game['menu'].visible).toBe(false);
    expect(w.save().challenge.attempts).toBe(2);
  });

  it.each(['closed', 'broke'] as const)('stays home with the retry still on offer when the ad was %s', async (answer) => {
    const w = world(used());
    w.game['home']('challenge');
    w.host.answers = [answer];
    tap(w.stage, t('challenge.retry'));
    await flush();
    expect(w.game['challenge']).toBeNull();
    expect(w.game['menu'].visible).toBe(true);
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(w.save().challenge.attempts).toBe(1);
  });
});

describe('the result screen', () => {
  it('revives the battle when the ad was watched', async () => {
    const w = world();
    play(w);
    playToEnd(w);
    w.host.answers = ['watched'];
    tap(w.stage, t('revive'));
    await flush();
    const b = w.game['battle']!;
    expect(b.result).toBeNull();
    expect(w.game['ended']).toBe(false);
    expect(w.game['overlay'].visible).toBe(false);
    // a revived battle that is lost again offers no second revive
    playToEnd(w);
    expect(buttons(w.stage, t('revive'))).toHaveLength(0);
  });

  it.each(['closed', 'failed', 'broke'] as const)('brings the result back without the revive when the ad was %s', async (answer) => {
    const w = world();
    play(w);
    playToEnd(w);
    const runs = w.save().runs;
    w.host.answers = [answer];
    tap(w.stage, t('revive'));
    await flush();
    expect(w.game['battle']!.result).toBe('lost');
    expect(w.game['overlay'].visible).toBe(true);
    expect(buttons(w.stage, t('revive'))).toHaveLength(0);
    expect(w.save().runs, 'still one run').toBe(runs);
  });

  /** A lost battle whose revive was turned down: the ×2 is offered in its place. */
  async function doubleOffered(): Promise<World> {
    const w = world();
    play(w);
    playToEnd(w);
    w.host.answers = ['closed'];
    tap(w.stage, t('revive'));
    await flush();
    expect(w.game['purse'].paid).toBeGreaterThan(0);
    return w;
  }

  it('pays the battle once more for a watched ×2, once', async () => {
    const w = await doubleOffered();
    const before = w.save().crystals;
    const paid = w.game['purse'].paid;
    const left = doublesLeft(w.save());
    w.host.answers = ['watched'];
    tap(w.stage, t('double'));
    await flush();
    expect(w.save().crystals).toBe(before + paid);
    expect(doublesLeft(w.save())).toBe(left - 1);
    expect(buttons(w.stage, t('double'))).toHaveLength(0);
    // no midgame ad chained after a rewarded one in the same break
    tap(w.stage, t('continue'));
    await flush();
    expect(w.host.midgames).toBe(0);
  });

  it.each(['closed', 'failed', 'broke'] as const)('pays nothing for a ×2 that was %s, and the screen still answers', async (answer) => {
    const w = await doubleOffered();
    const before = w.save().crystals;
    w.host.answers = [answer];
    tap(w.stage, t('double'));
    await flush();
    expect(w.save().crystals).toBe(before);
    expect(w.game['overlay'].interactiveChildren).toBe(true);
    expect(w.game['overlay'].visible).toBe(true);
    tap(w.stage, t('continue'));
    await flush();
    expect(w.game['menu'].visible).toBe(true);
    // a break after a battle with no ad watched gets the portal's midgame ad
    expect(w.host.midgames).toBe(1);
  });

  it('plays no ×2 ad once the day is used up', async () => {
    const m = veteran();
    m.daily.day = dayOf(new Date());
    m.daily.doubles = 99;
    const w = world(m);
    play(w);
    playToEnd(w);
    w.host.answers = ['closed'];
    tap(w.stage, t('revive'));
    await flush();
    const crystals = w.save().crystals;
    // the button stays, greyed out, over its "none left today" note
    tap(w.stage, t('double'));
    await flush();
    expect(w.host.rewardedCalls).toBe(1);
    expect(w.save().crystals).toBe(crystals);
  });
});

describe('the card reroll', () => {
  /** Buys a skill offer with gold handed over (an idle battle loses before it earns one), so
   *  the cards come up with their reroll. */
  function offer(w: World): void {
    const g = w.game;
    g['battle']!.gold = 1000;
    expect(g['battle']!.upgrade()).toBe(true);
    g['tick'](0.001);
    expect(buttons(w.stage, t('reroll'))).toHaveLength(1);
  }

  it('deals new cards when the ad was watched', async () => {
    const w = world();
    play(w);
    offer(w);
    const b = w.game['battle']!;
    const before = [...b.choices!];
    w.host.answers = ['watched'];
    tap(w.stage, t('reroll'));
    await flush();
    expect(b.choices).not.toEqual(before);
    expect(w.game['overlay'].visible).toBe(true);
    expect(w.game['overlay'].interactiveChildren).toBe(true);
  });

  it.each(['closed', 'failed', 'broke'] as const)('keeps the cards and takes the reroll away when the ad was %s', async (answer) => {
    const w = world();
    play(w);
    offer(w);
    const b = w.game['battle']!;
    const before = [...b.choices!];
    w.host.answers = [answer];
    tap(w.stage, t('reroll'));
    await flush();
    expect(b.choices).toEqual(before);
    expect(w.game['overlay'].visible).toBe(true);
    expect(w.game['overlay'].interactiveChildren).toBe(true);
    expect(buttons(w.stage, t('reroll'))).toHaveLength(0);
  });
});

describe('the ad-free card', () => {
  const shop = (setup: (c: Card) => void = () => {}) => {
    const card = new Card();
    setup(card);
    const w = world(veteran(), (h) => (h.store = card));
    w.game['tab'] = 'shop';
    w.game['home']();
    return { w, card };
  };

  it('is not in the shop where nothing is sold', () => {
    const w = world();
    w.game['tab'] = 'shop';
    w.game['home']();
    expect(buttons(w.stage, t('store.adFree.restore'))).toHaveLength(0);
  });

  it('sells at its price, then shows owned and celebrates', async () => {
    const { w, card } = shop((c) => (c.buys = ['owned']));
    tap(w.stage, '$4.99');
    await flush();
    expect(card.isOwned).toBe(true);
    expect(w.host.celebrated).toBe(1);
    expect(buttons(w.stage, '$4.99')).toHaveLength(0);
    expect(buttons(w.stage, t('store.adFree.restore'))).toHaveLength(0);
    expect(w.events('iap')).toEqual([{ op: 'buy', outcome: 'owned', run: 8 }]);
  });

  it('cannot be bought before the store has a price', () => {
    const { w, card } = shop((c) => (c.cost = null));
    tap(w.stage, '…');
    expect(card.buys).toEqual([]);
    expect(w.events('iap')).toEqual([]);
  });

  it.each([
    ['pending', 'store.adFree.pending'],
    ['failed', 'store.adFree.failed'],
  ] as const)('says so on its strip when the purchase is %s', async (outcome, note) => {
    const { w } = shop((c) => (c.buys = [outcome]));
    tap(w.stage, '$4.99');
    await flush();
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(buttons(w.stage, '$4.99')).toHaveLength(1);
    expect(texts(w.stage)).toContain(t(note));
    expect(w.host.celebrated).toBe(0);
  });

  it('says nothing for a purchase sheet the player cancelled', async () => {
    const { w } = shop((c) => (c.buys = ['cancelled']));
    tap(w.stage, '$4.99');
    await flush();
    expect(texts(w.stage)).toContain(t('store.adFree.desc'));
  });

  it('counts a store that broke as a failed purchase', async () => {
    const { w } = shop((c) => (c.buys = ['broke']));
    tap(w.stage, '$4.99');
    await flush();
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(texts(w.stage)).toContain(t('store.adFree.failed'));
    expect(w.events('iap')).toEqual([{ op: 'buy', outcome: 'failed', run: 8 }]);
  });

  it.each([
    ['owned', 'store.adFree.restored'],
    ['none', 'store.adFree.nothing'],
    ['failed', 'store.adFree.failed'],
    ['broke', 'store.adFree.failed'],
  ] as const)('restores: %s', async (outcome, note) => {
    const { w } = shop((c) => (c.restores = [outcome]));
    tap(w.stage, t('store.adFree.restore'));
    await flush();
    expect(w.game['menu'].interactiveChildren).toBe(true);
    expect(texts(w.stage)).toContain(t(note));
  });

  it("the strip's note goes when the tab changes", async () => {
    const { w } = shop((c) => (c.buys = ['failed']));
    tap(w.stage, '$4.99');
    await flush();
    w.game['home']();
    expect(texts(w.stage)).toContain(t('store.adFree.failed'));
    tap(w.stage, t('tabs.battle'));
    tap(w.stage, t('tabs.shop'));
    expect(texts(w.stage)).not.toContain(t('store.adFree.failed'));
  });
});

function texts(root: Container): string[] {
  const out: string[] = [];
  const walk = (c: Container): void => {
    if (!c.visible) return;
    if (c instanceof Text) out.push(c.text);
    for (const k of c.children) walk(k);
  };
  walk(root);
  return out;
}
