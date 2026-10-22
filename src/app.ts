// The game shell: owns the Pixi app, fits the 1080x1920 design to the screen and runs the
// flow battle (with skill picks) -> end -> home (upgrades) -> battle. A new player lands in a
// live first battle as soon as loading is over, no tap first; the home screen comes after it.
// The flows the Game runs live in src/game/: the tutorial (tutorialFlow.ts), a battle's end
// (ending.ts) and its result screen (resultScreen.ts), the home screen (homeScreen.ts) and its
// taps (homeActions.ts), the challenge and endless modes (modes.ts); boot()'s helpers in
// startup.ts.

import { Application, Container, Graphics } from 'pixi.js';
import type { Analytics } from './analytics/analytics';
import { memProbe } from './analytics/memProbe';
import { deviceTimeZone, PrivacyChoice, privacyRegion } from './analytics/privacy';
import { PerfReport } from './analytics/perfReport';
import { RunTracker } from './analytics/runTracker';
import { GameAudio } from './audio/engine';
import { detectLocale, loadLocale, setLocale, t } from './i18n';
import type { Platform } from './platform/types';
import { Battle } from './sim/battle';
import { challengeSetup, type Challenge, type ChallengeResult } from './sim/challenge';
import { recordEvents } from './sim/achievements';
import { endlessSetup, type EndlessResult } from './sim/endless';
import { addProgress, dayOf, rollDay } from './sim/daily';
import { battleSetup, firstSeed, parseMeta, Purse, type MetaSave } from './sim/meta';
import { botAct } from './sim/bot';
import { Tutorial, type TutorialStep } from './sim/tutorial';
import { BALANCE, type BattleEvent, type HeroKind } from './sim/types';
import { loadArt, restOfArt } from './view/art';
import { BattleView } from './view/BattleView';
import { Hud, VETERAN_MERGES } from './view/Hud';
import type { HomePanel, HomeTab } from './view/Home';
import type { FeedbackAsk } from './view/feedback';
import { uiSound, workshopWall } from './view/kit';
import { Overlay } from './view/Overlay';
import { TutorialLayer } from './view/Tutorial';
import { COLORS } from './view/ui';
import { SideInfo } from './view/SideInfo';
import { FixedStep } from './view/fixedStep';
import { levelRange, QUALITY_MODES, type QualityMode } from './view/quality';
import { QualityRuntime } from './view/qualityRuntime';
import { fitDesign, fitMenu, textBoost, type MenuFit } from './view/viewport';
import { finish } from './game/ending';
import { home } from './game/homeScreen';
import { LANG_KEY, SAVE_KEY } from './game/keys';
import { createAnalytics, device, loadedBeacon, pointerKind, safeDevice, showLocale } from './game/startup';
import { beginTutorial, endTutorial, lesson } from './game/tutorialFlow';

/** What a host's entry can do with the game once it is up. */
export interface GameHandle {
  /** Draws the home screen again if it is up: the store or the ads changed (iOS). */
  refresh(): void;
}

export async function boot(platform: Platform): Promise<GameHandle> {
  const params = new URLSearchParams(location.search);
  // ?lang= (testing) over the player's pick over the device's language; a table that cannot be
  // fetched (offline) leaves English
  const want = detectLocale([params.get('lang'), platform.storage.getItem(LANG_KEY), ...platform.languages()]);
  // the language's table and the first battle's art come in while the renderer starts
  const table = loadLocale(want);
  const art = loadArt();

  const app = new Application();
  await app.init({
    background: COLORS.bg,
    resizeTo: platform.mount ?? window,
    // the quality levels lower it (view/quality.ts); 3 is a 3x phone's own pixels
    resolution: Math.min(window.devicePixelRatio || 1, 3),
    autoDensity: true,
    antialias: true,
    preference: 'webgl',
  });
  (platform.mount ?? document.body).appendChild(app.canvas);
  await table;
  const lang = showLocale(setLocale(want));
  await art;
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // players in the EEA, the UK and Switzerland are asked before play statistics go out
  const privacy = new PrivacyChoice(platform.storage, privacyRegion(platform.country?.() ?? null, deviceTimeZone()));
  const analytics = createAnalytics(platform, params, privacy);
  const game = new Game(app, platform, params, analytics, privacy);
  // our own frame loop from here on: a frame rate and resolution the device keeps up with
  const mode = params.get('quality') as QualityMode;
  new QualityRuntime(app, levelRange(QUALITY_MODES.includes(mode) ? mode : 'auto', device(app)), () => game.calm());
  if (import.meta.env.DEV) Object.assign(window, { __game: game });
  platform.loaded();
  analytics.track('session_start', {
    loadMs: Math.round(performance.now()),
    lang,
    w: window.innerWidth,
    h: window.innerHeight,
    touch: navigator.maxTouchPoints > 0,
    // the beacons' test, so players and launches split the same way
    device: pointerKind(),
    ...safeDevice(app),
  });
  // inside a portal's iframe the page can have no size yet at boot: the size once it has one
  if (!(window.innerWidth > 0 && window.innerHeight > 0)) {
    const sized = () => {
      if (!(window.innerWidth > 0 && window.innerHeight > 0)) return;
      window.removeEventListener('resize', sized);
      analytics.track('viewport', { w: window.innerWidth, h: window.innerHeight, t: analytics.sessionSeconds });
    };
    window.addEventListener('resize', sized);
    requestAnimationFrame(() => requestAnimationFrame(sized));
  }
  game.perf.anomalies.listen(window, app.canvas);
  // the first tap or key ever: the player is really there (the battle is already live by then)
  const input = () => {
    analytics.first('first_input', { t: analytics.sessionSeconds });
    for (const type of ['pointerdown', 'keydown']) window.removeEventListener(type, input, true);
  };
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, input, { capture: true, passive: true });
  // mobile browsers often skip pagehide, so also flush whenever the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      game.perf.hidden();
      analytics.flush();
    }
  });
  window.addEventListener('pagehide', () => game.leave());
  game.start();
  // the art the first frame did not wait for: screens built without it are built again
  void restOfArt().then(() => game.artIn());
  // the first battle frame is on screen two animation frames later: the `loaded` checkpoint, and
  // the mark scripts/firstFrame.mjs times
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      performance.mark('first_frame');
      loadedBeacon(platform.name, analytics);
    }),
  );
  return { refresh: () => game.refresh() };
}

/** Exported for the modules in src/game/ that run its flows, and for the ad-flow tests, which
 *  drive it over a stand-in Pixi app. */
export class Game {
  // The game's own, open to the flows in src/game/ (and the tests), not to be touched from
  // anywhere else.
  readonly root = new Container();
  private readonly view = new BattleView();
  readonly hud: Hud;
  /** On the whole screen like the menus, over the battle. */
  readonly overlay = new Overlay();
  /** The first battle's tutorial, over everything in the battle. */
  readonly lessons = new TutorialLayer(() => endTutorial(this, true));
  tutorial: Tutorial | null = null;
  /** The workshop wall beside the board when the screen is wider than it. */
  private readonly wall = new Container();
  /** On the wall: the skills and damage on the left, the coming waves on the right. */
  private readonly side = new SideInfo();
  private wallSize = '';
  /** The home screen, laid out on the whole screen rather than the battle's board. */
  readonly menu = new Container();
  menuFit: MenuFit | null = null;
  tab: HomeTab = 'battle';
  panel: HomePanel = null;
  /** How the last buy or restore of the ad-free card went, on its strip until the tab changes. */
  storeNote: string | null = null;
  battle: Battle | null = null;
  run: RunTracker | null = null;
  save: MetaSave;
  /** Crystals paid for the current battle: what it earned and the ×2. */
  purse = new Purse();
  /** A reserve potion tapped on the lineup row, waiting for the one it replaces. */
  picked: HeroKind | null = null;
  /** The battle is today's challenge: which one, the streak bonus its start paid and, once it
   *  ended, what it booked. */
  challenge: { ch: Challenge; streakBonus: number; result: ChallengeResult | null } | null = null;
  /** The battle is an endless run: what its ends booked so far (a revived run ends twice). */
  endless: { result: EndlessResult | null } | null = null;
  revived = false;
  /** The battle's end is booked: the battle stands still and is not booked again while the
   *  result screen waits on an ad (it is hidden then) until a revive brings it back. */
  ended = false;
  /** The result screen's ad offers already reported, so a screen shown again does not count twice. */
  offered = { revive: false, double: false };
  /** A rewarded ad was watched since the battle ended (the ×2): the portal wants no midgame ad
   *  chained after it in the same break. */
  rewardedSinceEnd = false;
  /** The day the login panel last opened by itself. */
  loginShown = '';
  /** The consent panel opened by itself this session (once is enough; the settings have the switch). */
  consentShown = false;
  /** How the last copy of the player ID went, shown on its button until the settings close. */
  idNote: 'copied' | 'failed' | null = null;
  /** The tutorial step on screen for `tutorial_step`: when it first showed (battle seconds) and
   *  whether the assist did it. */
  tutLog: { step: TutorialStep; shownT: number | null; assisted: boolean } | null = null;
  /** When this battle's result screen first came up (ms), for `result_action`; 0 before. */
  resultAt = 0;
  /** The one-time rating question on the result screen after run 3 (web only), while it is up. */
  ask: FeedbackAsk | null = null;
  /** The home screen's one-time pointer is on the potion's button (so leaving the tab ends it). */
  hintOnButton = false;
  hintHand: Container | null = null;
  readonly autoplay: boolean;
  private readonly speed: number;
  /** Turns frame time into battle ticks, `speed` times over, and says how far into the next
   *  tick the view is. */
  private loop = new FixedStep();
  readonly audio = new GameAudio();
  /** The `perf` and `anomaly` telemetry: battle frames only, see analytics/perfReport. */
  readonly perf: PerfReport;

  constructor(
    readonly app: Application,
    readonly platform: Platform,
    params: URLSearchParams,
    readonly analytics: Analytics,
    readonly privacy: PrivacyChoice,
  ) {
    this.save = parseMeta(platform.storage.getItem(SAVE_KEY));
    this.autoplay = params.has('autoplay');
    this.speed = Math.max(1, Number(params.get('speed')) || 1);
    this.perf = new PerfReport(analytics, memProbe(app), () => this.place(), this.speed);
    this.audio.attach();
    this.audio.prefs(this.save.sound);
    platform.onHostMute((muted) => this.audio.host(muted));
    uiSound.tap = () => this.audio.play('tap');
    this.hud = new Hud(
      () => this.battle?.summon(),
      () => this.battle?.upgrade(),
    );
    this.root.addChild(this.view, this.hud);
    this.menu.visible = false;
    app.stage.addChild(this.wall, this.side, this.root, this.overlay, this.lessons, this.menu);
    app.ticker.add((ticker) => {
      this.tick(Math.min(ticker.deltaMS / 1000, 0.1));
      this.perf.tick(ticker.deltaMS, this.measured(), this.battle?.enemies.length ?? 0);
    });
  }

  start(): void {
    if (this.autoplay) {
      this.newBattle('autoplay');
      this.platform.gameplayStart();
      return;
    }
    if (this.save.runs > 0) {
      home(this);
      return;
    }
    // a new player: straight into the first battle, live, with the tutorial pointing
    this.newBattle('first');
    beginTutorial(this);
    this.platform.gameplayStart();
  }

  /** The page is going away: report the run in progress and the session length. */
  leave(): void {
    this.store(); // task progress made in the battle so far
    if (this.run && this.battle && !this.battle.result) this.perf.quit();
    this.run?.close('pagehide');
    this.analytics.track('session_end', { secs: this.analytics.sessionSeconds, runs: this.save.runs, best: this.save.bestWave });
    this.analytics.flush();
  }

  /** `cause` null: an idle battle under the home screen, no run. */
  newBattle(cause: 'first' | 'again' | 'next' | 'autoplay' | 'challenge' | 'endless' | null, ch: Challenge | null = null): void {
    this.run?.close('again');
    // a new player's runs on stage 1 share one seed until the first win, for comparable telemetry
    const fixed = cause === 'first' || cause === 'again' ? firstSeed(this.save) : null;
    const seed = fixed ?? (Math.random() * 2 ** 32) >>> 0;
    this.battle = ch ? new Battle(ch.seed, challengeSetup(this.save, ch)) : new Battle(seed, cause === 'endless' ? endlessSetup(this.save) : battleSetup(this.save));
    this.challenge = null;
    this.endless = cause === 'endless' ? { result: null } : null;
    this.purse = new Purse();
    this.run = cause ? new RunTracker(this.analytics, this.battle, this.save.runs + 1, cause) : null;
    if (this.run) this.perf.start();
    this.revived = false;
    this.ended = false;
    this.offered = { revive: false, double: false };
    this.resultAt = 0;
    this.tutorial = null;
    this.tutLog = null;
    // the merge hint, until the player has merged once
    this.hud.hint = this.save.achievements.stats.merges === 0;
    this.hud.nudge = true;
    this.hud.veteran = this.save.achievements.stats.merges >= VETERAN_MERGES;
    this.loop = new FixedStep();
    this.view.attach(this.battle);
    this.hud.attach(this.battle);
    // today's tasks exist before the first battle counts toward them (a fresh save has none)
    rollDay(this.save, dayOf(new Date()));
  }

  /** A battle frame worth measuring: a run on screen and moving, no menu, overlay or skill pick up, the tab visible. */
  private measured(): boolean {
    const b = this.battle;
    return !!(this.run && b && !b.paused && !this.menu.visible && !this.overlay.visible && !this.ended && document.visibilityState === 'visible');
  }

  /** Nothing fast on screen: the frame loop drops to its calm rate. */
  calm(): boolean {
    return !this.measured();
  }

  /** Where the player is, for an `anomaly`. */
  private place(): { place: string; wave?: number } {
    if (this.menu.visible) return { place: 'home' };
    if (!this.run || !this.battle) return { place: 'title' };
    return { place: this.ended ? 'results' : 'run', wave: this.battle.wave };
  }

  private tick(dt: number): void {
    const fit = fitDesign(this.app.screen.width, this.app.screen.height);
    this.root.scale.set(fit.scale);
    this.root.position.set(fit.x, fit.y);
    const boost = textBoost(fit.scale);
    this.hud.legible(boost);
    this.view.legible(boost);
    const m = fitMenu(this.app.screen.width, this.app.screen.height);
    this.overlay.scale.set(m.scale);
    this.overlay.layout(m.w, m.h);
    this.sideWall(fit.x, m);
    this.side.update(this.battle, fit.x / m.scale, m, this.wall.visible && !this.menu.visible, dt);
    // the workshop tune on the menus and the title, the battle loop while a battle runs
    this.audio.music(this.menu.visible || !this.run ? 'workshop' : this.ended ? null : 'battle');

    if (this.menu.visible) {
      this.lessons.visible = false;
      this.menu.scale.set(m.scale);
      // the pointer's hand pushes toward what it points at and back
      const hand = this.hintHand && !this.hintHand.destroyed ? this.hintHand.children[0] : null;
      if (hand) hand.y = 14 + Math.sin(performance.now() / 160) * 14;
      const old = this.menuFit;
      // a new page size is a new layout
      if (!old || old.wide !== m.wide || Math.abs(old.w - m.w) > 1 || Math.abs(old.h - m.h) > 1) home(this, this.panel);
      return;
    }

    const b = this.battle;
    let events: BattleEvent[] = [];
    if (b && !this.overlay.visible && !this.ended) {
      // the bot picks its cards at once, so autoplay never stops for an offer
      if (this.autoplay && b.choices) botAct(b);
      if (!b.paused) {
        const steps = this.loop.advance(dt * 1000, this.speed);
        for (let i = 0; i < steps; i++) {
          if (this.autoplay) botAct(b);
          if (b.paused) break;
          b.step();
        }
      }
      events = b.drain();
      this.run?.onEvents(events);
      if (this.run && !this.autoplay) this.countDaily(events);
      this.view.react(events);
      this.audio.battle(events);
      this.hud.react(events);
      // an offer made on the tick's last step (or by the bot's own upgrade) would otherwise open the overlay
      if (this.autoplay && b.choices) botAct(b);
      if (b.choices) this.showSkills(b);
      else if (b.result) finish(this, b);
    }
    lesson(this, b, events, m, dt);
    this.view.update(dt, this.loop.alpha);
    this.hud.update(dt);
  }

  /** Fills the bars beside the board with the workshop wall, the board casting a shadow on it. */
  private sideWall(boardX: number, m: MenuFit): void {
    this.wall.visible = this.root.visible && boardX > 1;
    const size = `${Math.round(m.w)}x${Math.round(m.h)}`;
    if (!this.wall.visible || size === this.wallSize) return;
    this.wallSize = size;
    this.wall.removeChildren().forEach((c) => c.destroy());
    this.wall.scale.set(m.scale);
    const x0 = boardX / m.scale;
    const x1 = m.w - x0;
    const shade = new Graphics();
    for (let i = 1; i <= 6; i++) shade.rect(x0 - i * 14, 0, x1 - x0 + i * 28, m.h).fill({ color: 0x000000, alpha: 0.09 });
    this.wall.addChild(workshopWall(m.w, m.h), shade);
  }

  private showSkills(b: Battle): void {
    // no ad in the tutorial's first pick: it is there to teach the cards
    const canReroll = b.canReroll() && !this.autoplay && !this.tutorial && this.platform.rewardedAvailable();
    if (canReroll) this.run?.onRerollOffer();
    const title = t(b.choiceReason === 'ultimate' ? 'ultimatePick' : 'upgradePick');
    this.overlay.showSkills(b.choices ?? [], b.skills, title, (id) => this.pick(id), canReroll ? () => void this.reroll(b) : null);
  }

  /** The rewarded refresh: a new set of cards for the waiting offer. */
  private async reroll(b: Battle): Promise<void> {
    const ok = await this.watch();
    this.run?.onRerollResult(ok);
    if (ok) b.reroll();
    else b.apply({ type: 'noReroll' }); // one offer of the ad per pick, even when it failed
    if (b.choices && this.overlay.visible) this.showSkills(b);
  }

  /** Plays a rewarded ad over the overlay that is up, which takes no taps until it is over; an
   *  ad that broke counts as not watched. */
  async watch(): Promise<boolean> {
    this.overlay.interactiveChildren = false; // no second tap while the ad plays
    try {
      const ok = await this.platform.rewarded(() => this.mute(true));
      if (ok) this.rewardedSinceEnd = true;
      return ok;
    } catch {
      return false;
    } finally {
      this.overlay.interactiveChildren = true;
      this.mute(false);
    }
  }

  private pick(id: Parameters<Battle['choose']>[0]): void {
    if (this.battle?.choices) {
      this.run?.onSkillPick(id, this.battle.choices);
      if (!this.autoplay) addProgress(this.save, 'skill');
      this.audio.play('levelup');
    }
    this.battle?.choose(id);
    this.overlay.hide();
  }

  store(): void {
    this.platform.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
  }

  /** The home screen again with what the host now says (a purchase, a refund, an ad loaded). */
  refresh(): void {
    if (this.menu.visible) home(this, this.panel);
  }

  /** The rest of the art is in (view/art.ts): the screens that show it as pictures rather than
   *  frame by frame, the home and the panel over the battle (the skill cards), are built again. */
  artIn(): void {
    this.refresh();
    this.overlay.rebuild();
  }

  /** Counts this battle's events toward today's tasks and the achievements. */
  private countDaily(events: BattleEvent[]): void {
    const m = this.save;
    recordEvents(m, events);
    for (const ev of events) {
      if (ev.type === 'summon') addProgress(m, 'summon');
      else if (ev.type === 'merge') {
        addProgress(m, 'merge');
        if (ev.star === BALANCE.maxStar) addProgress(m, 'ultimate');
      } else if (ev.type === 'kill') {
        addProgress(m, 'kill');
        if (ev.boss) addProgress(m, 'boss');
      }
    }
  }

  /** Ads silence the game while they play. */
  mute(on: boolean): void {
    this.audio.ad(on);
  }
}
