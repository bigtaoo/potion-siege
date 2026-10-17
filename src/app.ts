// The game shell: owns the Pixi app, fits the 1080x1920 design to the screen and runs the
// flow title -> battle (with skill picks) -> end -> home (upgrades) -> battle. The very first
// battle starts from the title with one tap; the home screen comes after it.

import { Application, Container, Graphics, Text } from 'pixi.js';
import pkg from '../package.json';
import { Analytics, type Sink } from './analytics/analytics';
import { memProbe } from './analytics/memProbe';
import { deviceProps, PerfReport } from './analytics/perfReport';
import { RunTracker } from './analytics/runTracker';
import { GameAudio } from './audio/engine';
import { BeaconSink, ConsoleSink, MemorySink } from './analytics/sinks';
import { setLocale, t } from './i18n';
import type { Platform } from './platform/types';
import { Battle, slotCenter } from './sim/battle';
import { beginAttempt, bookAttempt, challengeSetup, todaysChallenge, type Challenge, type ChallengeResult } from './sim/challenge';
import { claimTier, recordChallenge, recordEvents } from './sim/achievements';
import { addProgress, canClaimLogin, claimBonus, claimLogin, claimTask, dayOf, rollDay } from './sim/daily';
import {
  adsLeft, battleSetup, benched, buyHero, buyUnlock, buyWorkshop, claimAd, claimChest, endOffers, heroUnlocked, maxStage, parseMeta, Purse, swapLineup,
  type MetaSave,
} from './sim/meta';
import { botAct } from './sim/bot';
import { mergeablePair, Tutorial } from './sim/tutorial';
import { FP } from './sim/math/fixed';
import { BALANCE, HERO_KINDS, type BattleEvent, type HeroKind } from './sim/types';
import { loadArt } from './view/art';
import { BattleView } from './view/BattleView';
import { Hud } from './view/Hud';
import { buildHome, type HomePanel, type HomeTab } from './view/Home';
import { uiSound, workshopWall } from './view/kit';
import { Overlay, SKILL_BOX } from './view/Overlay';
import { TutorialLayer, type Lesson, type Rect } from './view/Tutorial';
import { COLORS } from './view/ui';
import { flyCrystals } from './view/fly';
import { SideInfo } from './view/SideInfo';
import { FixedStep } from './view/fixedStep';
import { levelRange, QUALITY_MODES, type DeviceInfo, type QualityMode } from './view/quality';
import { gpuName, QualityRuntime } from './view/qualityRuntime';
import { DESIGN_H, DESIGN_W, fitDesign, fitMenu, textBoost, type MenuFit } from './view/viewport';

const SAVE_KEY = 'mb.save';


export async function boot(platform: Platform): Promise<void> {
  const params = new URLSearchParams(location.search);
  const lang = setLocale([params.get('lang'), ...platform.languages()]);
  document.title = t('title');

  const app = new Application();
  await app.init({
    background: COLORS.bg,
    resizeTo: window,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    antialias: true,
    preference: 'webgl',
  });
  document.body.appendChild(app.canvas);
  await loadArt();
  app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const analytics = createAnalytics(platform, params);
  const game = new Game(app, platform, params, analytics);
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
    ...safeDevice(app),
  });
  game.perf.anomalies.listen(window, app.canvas);
  // mobile browsers often skip pagehide, so also flush whenever the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      game.perf.hidden();
      analytics.flush();
    }
  });
  window.addEventListener('pagehide', () => game.leave());
  game.start();
}

/** What the quality level starts from; a touch screen with a phone's browser counts as a phone. */
function device(app: Application): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let gpu = '';
  try {
    gpu = gpuName(app.renderer);
  } catch {
    // no WebGL details: judged by the rest
  }
  return {
    mobile: navigator.maxTouchPoints > 0 && /mobi|android|iphone|ipad/i.test(navigator.userAgent),
    cores: nav.hardwareConcurrency || 0,
    memoryGB: nav.deviceMemory || 0,
    gpu,
  };
}

function safeDevice(app: Application): ReturnType<typeof deviceProps> {
  try {
    return deviceProps(app.renderer);
  } catch {
    return {};
  }
}

/** Console with `?track`, an in-memory log in dev, and the collector when VITE_ANALYTICS_URL is set. */
function createAnalytics(platform: Platform, params: URLSearchParams): Analytics {
  const sinks: Sink[] = [];
  if (import.meta.env.DEV) sinks.push(new MemorySink());
  if (params.has('track')) sinks.push(new ConsoleSink());
  const url = import.meta.env.VITE_ANALYTICS_URL as string | undefined;
  if (url && !params.has('autoplay')) sinks.push(new BeaconSink(url));
  return new Analytics(platform.storage, sinks, pkg.version, platform.name);
}

class Game {
  private readonly root = new Container();
  private readonly view = new BattleView();
  private readonly hud: Hud;
  /** On the whole screen like the menus, over the battle. */
  private readonly overlay = new Overlay();
  /** The first battle's tutorial, over everything in the battle. */
  private readonly lessons = new TutorialLayer(() => this.endTutorial(true));
  private tutorial: Tutorial | null = null;
  /** The workshop wall beside the board when the screen is wider than it. */
  private readonly wall = new Container();
  /** On the wall: the skills and damage on the left, the coming waves on the right. */
  private readonly side = new SideInfo();
  private wallSize = '';
  /** The home screen, laid out on the whole screen rather than the battle's board. */
  private readonly menu = new Container();
  private menuFit: MenuFit | null = null;
  private tab: HomeTab = 'battle';
  private panel: HomePanel = null;
  private battle: Battle | null = null;
  private run: RunTracker | null = null;
  private save: MetaSave;
  /** Crystals paid for the current battle: what it earned and the ×2. */
  private purse = new Purse();
  /** A reserve potion tapped on the lineup row, waiting for the one it replaces. */
  private picked: HeroKind | null = null;
  /** The battle is today's challenge: which one, the streak bonus its start paid and, once it
   *  ended, what it booked. */
  private challenge: { ch: Challenge; streakBonus: number; result: ChallengeResult | null } | null = null;
  private revived = false;
  /** The battle's end is booked: the battle stands still and is not booked again while the
   *  result screen waits on an ad (it is hidden then) until a revive brings it back. */
  private ended = false;
  /** The result screen's ad offers already reported, so a screen shown again does not count twice. */
  private offered = { revive: false, double: false };
  /** A rewarded ad was watched since the battle ended (the ×2): the portal wants no midgame ad
   *  chained after it in the same break. */
  private rewardedSinceEnd = false;
  /** The day the login panel last opened by itself. */
  private loginShown = '';
  private readonly autoplay: boolean;
  private readonly speed: number;
  /** Turns frame time into battle ticks, `speed` times over, and says how far into the next
   *  tick the view is. */
  private loop = new FixedStep();
  private readonly audio = new GameAudio();
  /** The `perf` and `anomaly` telemetry: battle frames only, see analytics/perfReport. */
  readonly perf: PerfReport;

  constructor(
    private readonly app: Application,
    private readonly platform: Platform,
    params: URLSearchParams,
    readonly analytics: Analytics,
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
      this.home();
      return;
    }
    this.newBattle(null);
    this.overlay.showTitle(this.save.bestWave, () => {
      this.overlay.hide();
      this.analytics.first('first_tap_start', { t: this.analytics.sessionSeconds });
      this.run = new RunTracker(this.analytics, this.battle!, this.save.runs + 1, 'first');
      this.perf.start();
      this.beginTutorial();
      this.platform.gameplayStart();
    });
  }

  /** The page is going away: report the run in progress and the session length. */
  leave(): void {
    this.store(); // task progress made in the battle so far
    if (this.run && this.battle && !this.battle.result) this.perf.quit();
    this.run?.close('pagehide');
    this.analytics.track('session_end', { secs: this.analytics.sessionSeconds, runs: this.save.runs, best: this.save.bestWave });
    this.analytics.flush();
  }

  /** `cause` null: the title screen is up and the run starts when the player taps. */
  private newBattle(cause: 'again' | 'autoplay' | 'challenge' | null, ch: Challenge | null = null): void {
    this.run?.close('again');
    this.battle = ch ? new Battle(ch.seed, challengeSetup(this.save, ch)) : new Battle((Math.random() * 2 ** 32) >>> 0, battleSetup(this.save));
    this.challenge = null;
    this.purse = new Purse();
    this.run = cause ? new RunTracker(this.analytics, this.battle, this.save.runs + 1, cause) : null;
    if (this.run) this.perf.start();
    this.revived = false;
    this.ended = false;
    this.offered = { revive: false, double: false };
    this.tutorial = null;
    this.hud.hint = true;
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
      const old = this.menuFit;
      // a new page size is a new layout
      if (!old || old.wide !== m.wide || Math.abs(old.w - m.w) > 1 || Math.abs(old.h - m.h) > 1) this.home(this.panel);
      return;
    }

    const b = this.battle;
    let events: BattleEvent[] = [];
    if (b && !this.overlay.visible && !this.ended) {
      // the battle stands still while a tutorial step waits for its tap
      // (the bot picks its cards at once, so autoplay never stops for an offer)
      if (this.autoplay && b.choices) botAct(b);
      if (!this.tutorial?.holds(b) && !b.paused) {
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
      if (b.choices) this.showSkills(b);
      else if (b.result) this.finish(b);
    }
    this.lesson(b, events, m, dt);
    this.view.update(dt, this.loop.alpha);
    this.hud.update(dt);
  }

  /** The tutorial starts with the first battle of stage 1 on a save that has not seen it. */
  private beginTutorial(): void {
    if (this.autoplay || this.save.tutorial || this.battle?.setup.stage !== 1) return;
    this.tutorial = new Tutorial();
    this.hud.hint = false;
  }

  /** Done or skipped: never again on this save. */
  private endTutorial(skipped: boolean): void {
    const tut = this.tutorial;
    if (!tut) return;
    this.analytics.track('tutorial_end', { step: skipped ? (tut.step ?? 'done') : 'done', skipped });
    this.tutorial = null;
    this.hud.hint = true;
    this.save.tutorial = true;
    this.store();
  }

  /** Moves the tutorial on and points at what its step needs, in page units. */
  private lesson(b: Battle | null, events: BattleEvent[], m: MenuFit, dt: number): void {
    const tut = this.tutorial;
    if (tut && b) {
      tut.update(b, events);
      if (tut.done) this.endTutorial(false);
    }
    const step = this.tutorial && b && this.root.visible ? this.tutorial.showing(b) : null;
    // the pick shows over the skill cards, every other step over the battle itself
    const up = step === 'pick' ? this.overlay.visible : !this.overlay.visible;
    this.lessons.scale.set(m.scale);
    this.lessons.show(step && up && b ? this.lessonFor(step, b, m) : null, m.w, m.h, m.wide, dt);
  }

  private lessonFor(step: NonNullable<ReturnType<Tutorial['showing']>>, b: Battle, m: MenuFit): Lesson {
    // the board's design units to page units
    const k = this.root.scale.x / m.scale;
    const ox = this.root.x / m.scale;
    const oy = this.root.y / m.scale;
    const page = (r: Rect): Rect => ({ x: ox + r.x * k, y: oy + r.y * k, w: r.w * k, h: r.h * k });
    const board = page({ x: 0, y: 0, w: DESIGN_W, h: DESIGN_H });
    const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    if (step === 'pick') {
      const s = Math.min(1, (m.w - 40) / SKILL_BOX.w, (m.h - 40) / SKILL_BOX.h);
      const box = { x: m.w / 2 - (SKILL_BOX.w * s) / 2, y: m.h / 2 - (SKILL_BOX.h * s) / 2, w: SKILL_BOX.w * s, h: SKILL_BOX.h * s };
      return { step, holes: [], from: center(box), clear: box };
    }
    if (step === 'merge') {
      const pair = mergeablePair(b)!;
      const holes = pair.map((slot) => {
        const c = slotCenter(slot);
        const g = BALANCE.grid;
        return page({ x: c.x - g.cellW / 2, y: c.y - g.cellH / 2, w: g.cellW, h: g.cellH });
      });
      return { step, holes, from: center(holes[0]), to: center(holes[1]), clear: board };
    }
    const r = page(this.hud.buttonRect(step));
    return { step, holes: [r], from: { x: r.x + r.w / 2, y: r.y + 8 }, clear: board };
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

  /** Plays a rewarded ad over the overlay that is up, which takes no taps until it is over. */
  private async watch(): Promise<boolean> {
    this.overlay.interactiveChildren = false; // no second tap while the ad plays
    try {
      const ok = await this.platform.rewarded(() => this.mute(true));
      if (ok) this.rewardedSinceEnd = true;
      return ok;
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

  private finish(b: Battle): void {
    this.ended = true;
    this.rewardedSinceEnd = false;
    if (this.challenge) {
      this.finishChallenge(b, this.challenge);
      return;
    }
    this.platform.gameplayStop();
    // the tutorial belongs to the first battle only, however far it got
    if (this.tutorial) this.endTutorial(true);
    rollDay(this.save, dayOf(new Date()));
    if (!this.revived) {
      this.save.runs++; // a revived run ending again is still one run
      if (!this.autoplay) addProgress(this.save, 'play');
    }
    if (b.result === 'won' && !this.autoplay) addProgress(this.save, 'win');
    const result = { stage: b.setup.stage, won: b.result === 'won', wave: b.wave, kills: b.kills };
    // a revived battle ending again pays only what it earned on top
    const { crystals: gain, firstClear } = this.purse.settle(this.save, result);
    this.store();
    if (b.result === 'won') this.platform.celebrate();
    this.run?.onEnd();
    this.perf.end();
    this.analytics.track('crystals', { gain, total: this.save.crystals, stage: result.stage, first: firstClear });
    this.showEnd(b);
    if (this.autoplay) setTimeout(() => void this.again(), 1500);
  }

  /** Books a challenge attempt: the tier it reached pays what it adds to today's best; no
   *  campaign crystals, no revive and no ×2. */
  private finishChallenge(b: Battle, run: NonNullable<Game['challenge']>): void {
    this.platform.gameplayStop();
    rollDay(this.save, dayOf(new Date()));
    this.save.runs++;
    addProgress(this.save, 'play');
    addProgress(this.save, 'challenge');
    if (b.result === 'won') addProgress(this.save, 'win');
    run.result = bookAttempt(this.save, b.wave);
    recordChallenge(this.save, run.result.tier);
    this.save.bestWave = Math.max(this.save.bestWave, b.wave);
    this.store();
    if (run.result.tier > 0) this.platform.celebrate();
    this.run?.onEnd();
    this.perf.end();
    this.analytics.track('challenge_end', { day: run.ch.day, wave: b.wave, tier: run.result.tier, gain: run.result.crystals, attempt: this.save.challenge.attempts });
    this.showEnd(b);
  }

  /** Starts today's challenge (`ad`: the retry a rewarded ad bought). */
  private playChallenge(ad: boolean): void {
    const today = dayOf(new Date());
    const ch = todaysChallenge(this.save, today);
    const bonus = beginAttempt(this.save, today, ad);
    if (bonus === null) return;
    this.store();
    this.analytics.track('challenge_start', { day: today, stage: ch.stage, mods: ch.mods.join(','), ad, streak: this.save.challenge.streak });
    this.newBattle('challenge', ch);
    this.hud.showMods(ch.mods, ch.trial);
    this.challenge = { ch, streakBonus: bonus, result: null };
    this.menu.visible = false;
    this.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.root.visible = true;
    this.platform.gameplayStart();
  }

  /** The rewarded ad for a second go at today's challenge; the menu takes no taps while it plays. */
  private async challengeAd(): Promise<void> {
    this.menu.interactiveChildren = false;
    let ok = false;
    try {
      ok = await this.platform.rewarded(() => this.mute(true));
    } catch {
      // not watched: no retry
    } finally {
      this.menu.interactiveChildren = true;
      this.mute(false);
    }
    this.analytics.track('ad_challenge', { ok });
    if (ok) this.playChallenge(true);
    else if (this.menu.visible) this.home();
  }

  private store(): void {
    this.platform.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
  }

  /** The home screen over an idle battle of the chosen stage; the login reward opens by itself
   *  the first time each day it can be claimed. */
  private home(panel: HomePanel = null): void {
    const today = dayOf(new Date());
    rollDay(this.save, today);
    if (panel === null && canClaimLogin(this.save, today) && this.loginShown !== today) panel = 'login';
    if (panel === 'login') this.loginShown = today;
    this.newBattle(null);
    this.panel = panel;
    this.overlay.hide();
    this.root.visible = false;
    const fit = fitMenu(this.app.screen.width, this.app.screen.height);
    this.menuFit = fit;
    this.menu.scale.set(fit.scale);
    this.menu.visible = true;
    this.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.menu.addChild(buildHome(this.save, {
      tab: (tab) => {
        this.tab = tab;
        this.picked = null;
        this.home();
      },
      panel: (p) => this.home(p),
      claimLogin: (at) => {
        const n = claimLogin(this.save, today);
        if (n > 0) this.claimed('login', n, panel, at);
      },
      claimTask: (i, at) => {
        const id = this.save.daily.tasks[i]?.id;
        const n = claimTask(this.save, i);
        if (n > 0) this.claimed(`task_${id}`, n, panel, at);
      },
      claimBonus: (at) => {
        const n = claimBonus(this.save);
        if (n > 0) this.claimed('task_all', n, panel, at);
      },
      claimTier: (id, at) => {
        const n = claimTier(this.save, id);
        if (n > 0) this.claimed(`ach_${id}`, n, panel, at);
      },
      stage: (d) => {
        this.save.stage = Math.min(maxStage(this.save), Math.max(1, this.save.stage + d));
        this.store();
        this.home();
      },
      hero: (kind) => this.buy(buyHero(this.save, kind), `hero_${kind}`),
      lineup: (kind) => this.lineup(kind),
      workshop: (id) => this.buy(buyWorkshop(this.save, id), `shop_${id}`),
      claimChest: (at) => {
        const n = claimChest(this.save, today);
        if (n > 0) this.claimed('shop_chest', n, panel, at);
      },
      watchAd: () => void this.shopAd(),
      unlock: (kind) => this.buy(buyUnlock(this.save, kind), `unlock_${kind}`),
      challenge: () => this.playChallenge(false),
      challengeAd: () => void this.challengeAd(),
      sound: (which) => {
        this.save.sound[which] = !this.save.sound[which];
        this.audio.prefs(this.save.sound);
        this.store();
        this.home('settings');
      },
      play: () => {
        this.newBattle('again');
        this.beginTutorial();
        this.menu.visible = false;
        this.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
        this.root.visible = true;
        this.platform.gameplayStart();
      },
    }, this.tab, panel, today, fit, this.picked, !this.autoplay && this.platform.rewardedAvailable()));
  }

  /** The shop's rewarded ad: crystals when it was watched, a few times a day. The menu takes no
   *  taps while it plays, and an ad that broke counts as not watched. */
  private async shopAd(): Promise<void> {
    if (adsLeft(this.save, dayOf(new Date())) <= 0) return;
    this.menu.interactiveChildren = false;
    let ok = false;
    try {
      ok = await this.platform.rewarded(() => this.mute(true));
    } catch {
      // not watched: nothing paid
    } finally {
      this.menu.interactiveChildren = true;
      this.mute(false);
    }
    this.analytics.track('ad_shop', { ok });
    const n = ok ? claimAd(this.save, dayOf(new Date())) : 0;
    if (n > 0) this.claimed('shop_ad', n, null);
    else if (this.menu.visible) this.home();
  }

  /** A tap on the lineup row: a potion in the lineup swaps out for the reserve (the one picked,
   *  or the only one); a reserve potion is picked, or unpicked. */
  private lineup(kind: HeroKind): void {
    const m = this.save;
    if (!heroUnlocked(m, kind)) return;
    if (m.lineup.includes(kind)) {
      const bench = benched(m);
      const into = this.picked ?? (bench.length === 1 ? bench[0] : null);
      if (!into || !swapLineup(m, kind, into)) return;
      this.picked = null;
      this.store();
      this.analytics.track('lineup', { out: kind, in: into });
    } else {
      this.picked = this.picked === kind ? null : kind;
    }
    this.home();
  }

  /** Crystals paid for `item`: saved, then the page rebuilt and the crystals flown from the
   *  button tapped (`at`, or the middle of the page) into the purse. */
  private claimed(item: string, crystals: number, panel: HomePanel, at?: Container): void {
    this.audio.play(item === 'shop_chest' ? 'chest' : 'crystal');
    this.store();
    this.analytics.track('daily_claim', { item, crystals, total: this.save.crystals });
    const fit = this.menuFit;
    const from = at && !at.destroyed ? this.menu.toLocal(at.getGlobalPosition()) : { x: (fit?.w ?? 0) / 2, y: (fit?.h ?? 0) / 2 };
    this.home(panel);
    const purse = this.menu.getChildByLabel('purse', true);
    const count = this.menu.getChildByLabel('purseCount', true);
    if (purse && count instanceof Text) flyCrystals(this.menu, from, purse, count, this.save.crystals - crystals, this.save.crystals);
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

  private buy(ok: boolean, item: string): void {
    if (!ok) return;
    this.audio.play('levelup');
    this.store();
    this.analytics.track('meta_buy', { item, crystals: this.save.crystals });
    this.home();
  }

  private showEnd(b: Battle): void {
    const secs = Math.round(b.seconds);
    const stats = t('stats', { wave: b.wave, kills: b.kills, time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` });
    const run = this.challenge;
    if (run?.result) {
      const dealt = HERO_KINDS.flatMap((kind) => (b.dealt[kind] > 0 ? [{ kind, damage: Math.round(b.dealt[kind] / FP) }] : []));
      const reward = { crystals: run.result.crystals + run.streakBonus, firstClear: false, unlocked: [] };
      this.overlay.showEnd(b.result === 'won', stats, reward, () => void this.again(), null, {
        onDouble: null,
        doubled: false,
        dealt,
        onTip: null,
        challenge: { result: run.result, mods: run.ch.mods, trial: run.ch.trial, streak: this.save.challenge.streak, streakBonus: run.streakBonus },
      });
      return;
    }
    const ads = !this.autoplay && this.platform.rewardedAvailable();
    const { revive: canRevive, double: canDouble } = endOffers(b.result === 'lost', this.revived, ads, this.purse);
    if (canRevive && !this.offered.revive) this.run?.onReviveOffer();
    if (canDouble && !this.offered.double) this.run?.onDoubleOffer();
    this.offered.revive ||= canRevive;
    this.offered.double ||= canDouble;
    const dealt = HERO_KINDS.flatMap((kind) => (b.dealt[kind] > 0 ? [{ kind, damage: Math.round(b.dealt[kind] / FP) }] : []));
    this.overlay.showEnd(b.result === 'won', stats, this.purse.reward, () => void this.again(), canRevive ? () => void this.revive(b) : null, {
      onDouble: canDouble ? () => void this.double(b) : null,
      doubled: this.purse.bonus > 0,
      dealt,
      onTip: b.result === 'lost' ? (tab) => void this.again(tab) : null,
    });
  }

  /** The rewarded ×2: what the battle earned, paid once more. */
  private async double(b: Battle): Promise<void> {
    const ok = await this.watch();
    this.run?.onDoubleResult(ok);
    const bonus = this.purse.double(this.save, ok);
    if (bonus > 0) {
      this.store();
      this.analytics.track('crystals', { gain: bonus, total: this.save.crystals, stage: b.setup.stage, double: true });
    }
    if (this.overlay.visible) this.showEnd(b);
  }

  private async revive(b: Battle): Promise<void> {
    this.overlay.hide();
    let ok = false;
    try {
      ok = await this.platform.rewarded(() => this.mute(true));
    } catch {
      // an ad that broke counts as not watched: the result comes back up without the revive
    } finally {
      this.mute(false);
    }
    this.run?.onReviveResult(ok);
    if (ok) {
      this.revived = true;
      this.ended = false;
      b.revive();
      this.platform.gameplayStart();
    } else {
      this.revived = true; // one offer per battle, even when the ad failed
      this.showEnd(b);
    }
  }

  /** Back home (to `tab`, when a tip after a loss was tapped). */
  private async again(tab?: HomeTab): Promise<void> {
    this.overlay.hide();
    if (tab) this.tab = tab;
    // never an ad after the very first battle, nor right after a rewarded one
    if (this.save.runs > 1 && !this.rewardedSinceEnd) {
      await this.platform.midgame(() => this.mute(true));
      this.analytics.track('ad_midgame', { run: this.save.runs });
    }
    this.mute(false);
    if (!this.autoplay) {
      this.home();
      return;
    }
    this.newBattle('autoplay');
    this.platform.gameplayStart();
  }

  /** Ads silence the game while they play. */
  private mute(on: boolean): void {
    this.audio.ad(on);
  }
}
