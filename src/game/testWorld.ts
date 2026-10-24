// The stand-in Pixi app, host and store the game-flow tests (app.test.ts and src/game/*.test.ts)
// drive the real Game over, the player's taps on its buttons, and a battle played to its end.

import { expect } from 'vitest';
import { Container, Text, type Application } from 'pixi.js';
import { Game } from '../app';
import { Analytics } from '../analytics/analytics';
import { MemorySink } from '../analytics/sinks';
import { PrivacyChoice } from '../analytics/privacy';
import { loadLocale, setLocale, t } from '../i18n';
import { SafeStore, type Platform, type Store } from '../platform/types';
import { newMeta, type MetaSave } from '../sim/meta';
import { WELCOME_GIFTS } from '../sim/welcome';
import { home } from './homeScreen';

type Answer = 'watched' | 'closed' | 'failed' | 'broke';

/** A host whose rewarded ads answer from `answers`, in order. */
export class Host implements Platform {
  readonly name = 'test';
  storage = new SafeStore(null);
  answers: Answer[] = [];
  available = true;
  blocked = false;
  rewardedCalls = 0;
  midgames = 0;
  /** The midgame ad throws after it muted the game, as AdMob's bridge can. */
  midgameBreaks = false;
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
  adBlocked(): boolean {
    return this.blocked;
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
    if (this.midgameBreaks) throw new Error('the ad broke');
  }
  onHostMute(): void {}
}

/** The ad-free card's store, answering buy and restore as scripted. */
export class Card implements Store {
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

export const flush = () => new Promise((r) => setTimeout(r, 0));

/** A player some battles in, past the tutorial and on stage 20 with weak potions, so an idle
 *  battle there is lost within a few waves. */
export function veteran(): MetaSave {
  const m = newMeta();
  m.runs = 8;
  m.tutorial = true;
  m.upgradeHint = true;
  m.cleared = 19;
  m.stage = 20;
  m.crystals = 100;
  m.achievements.stats.merges = 5;
  // as a save from before the welcome week reads (sim/welcome.ts parseWelcome)
  m.welcome.gifts = WELCOME_GIFTS.length;
  return m;
}

export interface World {
  game: Game;
  host: Host;
  stage: Container;
  sink: MemorySink;
  analytics: Analytics;
  save(): MetaSave;
  events(name: string): Record<string, unknown>[];
}

export function world(save: MetaSave = veteran(), setup: (h: Host) => void = () => {}, switches = 'speed=200'): World {
  const host = new Host();
  setup(host);
  host.storage.setItem('mb.save', JSON.stringify(save));
  const stage = new Container();
  const app = { stage, ticker: { add() {} }, screen: { width: 1080, height: 1920 }, renderer: {} } as unknown as Application;
  const sink = new MemorySink();
  const analytics = new Analytics(host.storage, [sink], 'test', host.name);
  const game = new Game(app, host, new URLSearchParams(switches), analytics, new PrivacyChoice(host.storage, 'notice'));
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
export function buttons(root: Container, caption: string): Container[] {
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
export function tap(root: Container, caption: string): void {
  const found = buttons(root, caption);
  expect(found, `one button "${caption}"`).toHaveLength(1);
  found[0].emit('pointertap', { stopPropagation() {} } as never);
}

/** Runs the battle on, picking the first card at each offer, until its result screen is up. */
export function playToEnd(w: World, pick = (g: Game) => g['pick'](g['battle']!.choices![0])): void {
  const g = w.game;
  for (let i = 0; i < 2000 && !g['ended']; i++) {
    g['tick'](0.1);
    if (g['battle']?.choices && g['overlay'].visible) pick(g);
  }
  expect(g['ended'], 'the battle ended').toBe(true);
  expect(g['overlay'].visible).toBe(true);
}

/** Starts a battle from the home screen's play button. */
export function play(w: World): void {
  w.game['tab'] = 'battle';
  home(w.game);
  tap(w.stage, t('start'));
  expect(w.game['menu'].visible).toBe(false);
}

/** What the tests' page needs: a stand-in document, and the English table. */
export async function englishPage(): Promise<void> {
  const doc = { addEventListener() {}, visibilityState: 'visible' };
  (globalThis as { document?: unknown }).document ??= doc;
  await loadLocale('en');
  setLocale('en');
}

export function texts(root: Container): string[] {
  const out: string[] = [];
  const walk = (c: Container): void => {
    if (!c.visible) return;
    if (c instanceof Text) out.push(c.text);
    for (const k of c.children) walk(k);
  };
  walk(root);
  return out;
}
