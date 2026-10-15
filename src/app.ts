// The game shell: owns the Pixi app, fits the 1080x1920 design to the screen and runs the
// flow title -> battle (with skill picks) -> end -> home (upgrades) -> battle. The very first
// battle starts from the title with one tap; the home screen comes after it.

import { Application, Container } from 'pixi.js';
import pkg from '../package.json';
import { Analytics, type Sink } from './analytics/analytics';
import { RunTracker } from './analytics/runTracker';
import { BeaconSink, ConsoleSink, MemorySink } from './analytics/sinks';
import { setLocale, t } from './i18n';
import type { Platform } from './platform/types';
import { Battle } from './sim/battle';
import { addProgress, canClaimLogin, claimLogin, claimTask, dayOf, rollDay } from './sim/daily';
import { applyRun, battleSetup, buyHero, buyWorkshop, maxStage, parseMeta, runReward, type MetaSave, type Reward } from './sim/meta';
import { botAct } from './sim/bot';
import { BALANCE, type BattleEvent } from './sim/types';
import { loadArt } from './view/art';
import { BattleView } from './view/BattleView';
import { Hud } from './view/Hud';
import { buildHome, type HomePanel, type HomeTab } from './view/Home';
import { Overlay } from './view/Overlay';
import { COLORS } from './view/ui';
import { fitDesign, fitMenu, type MenuFit } from './view/viewport';

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
  if (import.meta.env.DEV) Object.assign(window, { __game: game });
  platform.loaded();
  analytics.track('session_start', {
    loadMs: Math.round(performance.now()),
    lang,
    w: window.innerWidth,
    h: window.innerHeight,
    touch: navigator.maxTouchPoints > 0,
  });
  // mobile browsers often skip pagehide, so also flush whenever the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') analytics.flush();
  });
  window.addEventListener('pagehide', () => game.leave());
  game.start();
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
  private readonly overlay = new Overlay();
  /** The home screen, laid out on the whole screen rather than the battle's board. */
  private readonly menu = new Container();
  private menuFit: MenuFit | null = null;
  private tab: HomeTab = 'battle';
  private panel: HomePanel = null;
  private battle: Battle | null = null;
  private run: RunTracker | null = null;
  private save: MetaSave;
  /** Crystals already paid for the current battle (a revived battle pays the difference). */
  private paid = 0;
  private revived = false;
  /** The day the login panel last opened by itself. */
  private loginShown = '';
  private reward: Reward = { crystals: 0, firstClear: false };
  private readonly autoplay: boolean;
  private readonly speed: number;

  constructor(
    private readonly app: Application,
    private readonly platform: Platform,
    params: URLSearchParams,
    readonly analytics: Analytics,
  ) {
    this.save = parseMeta(platform.storage.getItem(SAVE_KEY));
    this.autoplay = params.has('autoplay');
    this.speed = Math.max(1, Number(params.get('speed')) || 1);
    this.hud = new Hud(
      () => this.battle?.summon(),
      () => this.battle?.upgrade(),
    );
    this.root.addChild(this.view, this.hud, this.overlay);
    this.menu.visible = false;
    app.stage.addChild(this.root, this.menu);
    app.ticker.add((ticker) => this.tick(Math.min(ticker.deltaMS / 1000, 0.1)));
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
      this.platform.gameplayStart();
    });
  }

  /** The page is going away: report the run in progress and the session length. */
  leave(): void {
    this.store(); // task progress made in the battle so far
    this.run?.close('pagehide');
    this.analytics.track('session_end', { secs: this.analytics.sessionSeconds, runs: this.save.runs, best: this.save.bestWave });
    this.analytics.flush();
  }

  /** `cause` null: the title screen is up and the run starts when the player taps. */
  private newBattle(cause: 'again' | 'autoplay' | null): void {
    this.run?.close('again');
    this.battle = new Battle((Math.random() * 2 ** 32) >>> 0, battleSetup(this.save));
    this.paid = 0;
    this.run = cause ? new RunTracker(this.analytics, this.battle, this.save.runs + 1, cause) : null;
    this.revived = false;
    this.reward = { crystals: 0, firstClear: false };
    this.view.attach(this.battle);
    this.hud.attach(this.battle);
  }

  private tick(dt: number): void {
    const fit = fitDesign(this.app.screen.width, this.app.screen.height);
    this.root.scale.set(fit.scale);
    this.root.position.set(fit.x, fit.y);

    if (this.menu.visible) {
      const m = fitMenu(this.app.screen.width, this.app.screen.height);
      this.menu.scale.set(m.scale);
      const old = this.menuFit;
      // a new page size is a new layout
      if (!old || old.wide !== m.wide || Math.abs(old.w - m.w) > 1 || Math.abs(old.h - m.h) > 1) this.home(this.panel);
      return;
    }

    const b = this.battle;
    if (b && !this.overlay.visible) {
      for (let i = 0; i < this.speed; i++) {
        if (this.autoplay) botAct(b);
        b.step(dt);
      }
      const events = b.drain();
      this.run?.onEvents(events);
      if (this.run && !this.autoplay) this.countDaily(events);
      this.view.react(events);
      this.hud.react(events);
      if (b.choices) this.showSkills(b);
      else if (b.result) this.finish(b);
    }
    this.view.update(dt);
    this.hud.update(dt);
  }

  private showSkills(b: Battle): void {
    const canReroll = b.canReroll() && !this.autoplay && this.platform.rewardedAvailable();
    if (canReroll) this.run?.onRerollOffer();
    const title = t(b.choiceReason === 'ultimate' ? 'ultimatePick' : 'upgradePick');
    this.overlay.showSkills(b.choices ?? [], b.skills, title, (id) => this.pick(id), canReroll ? () => void this.reroll(b) : null);
  }

  /** The rewarded refresh: a new set of cards for the waiting offer. */
  private async reroll(b: Battle): Promise<void> {
    this.overlay.interactiveChildren = false; // no second tap while the ad plays
    const ok = await this.platform.rewarded(() => this.mute(true));
    this.overlay.interactiveChildren = true;
    this.mute(false);
    this.run?.onRerollResult(ok);
    if (ok) b.reroll();
    else b.rerolled = true; // one offer of the ad per pick, even when it failed
    if (b.choices && this.overlay.visible) this.showSkills(b);
  }

  private pick(id: Parameters<Battle['choose']>[0]): void {
    if (this.battle?.choices) {
      this.run?.onSkillPick(id, this.battle.choices);
      if (!this.autoplay) addProgress(this.save, 'skill');
    }
    this.battle?.choose(id);
    this.overlay.hide();
  }

  private finish(b: Battle): void {
    this.platform.gameplayStop();
    rollDay(this.save, dayOf(new Date()));
    if (!this.revived) {
      this.save.runs++; // a revived run ending again is still one run
      if (!this.autoplay) addProgress(this.save, 'play');
    }
    if (b.result === 'won' && !this.autoplay) addProgress(this.save, 'win');
    const result = { stage: b.setup.stage, won: b.result === 'won', wave: b.wave, kills: b.kills };
    const reward = runReward(this.save, result);
    // a revived battle ending again pays only what it earned on top
    const gain = Math.max(0, reward.crystals - this.paid);
    this.paid += gain;
    this.reward = { crystals: this.paid, firstClear: reward.firstClear || this.reward.firstClear };
    applyRun(this.save, result, { crystals: gain, firstClear: reward.firstClear });
    this.store();
    if (b.result === 'won') this.platform.celebrate();
    this.run?.onEnd();
    this.analytics.track('crystals', { gain, total: this.save.crystals, stage: result.stage, first: reward.firstClear });
    this.showEnd(b);
    if (this.autoplay) setTimeout(() => void this.again(), 1500);
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
        this.home();
      },
      panel: (p) => this.home(p),
      claimLogin: () => {
        const n = claimLogin(this.save, today);
        if (n > 0) this.claimed('login', n, panel);
      },
      claimTask: (i) => {
        const id = this.save.daily.tasks[i]?.id;
        const n = claimTask(this.save, i);
        if (n > 0) this.claimed(`task_${id}`, n, panel);
      },
      stage: (d) => {
        this.save.stage = Math.min(maxStage(this.save), Math.max(1, this.save.stage + d));
        this.store();
        this.home();
      },
      hero: (kind) => this.buy(buyHero(this.save, kind), `hero_${kind}`),
      workshop: (id) => this.buy(buyWorkshop(this.save, id), `shop_${id}`),
      play: () => {
        this.newBattle('again');
        this.menu.visible = false;
        this.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
        this.root.visible = true;
        this.platform.gameplayStart();
      },
    }, this.tab, panel, today, fit));
  }

  private claimed(item: string, crystals: number, panel: HomePanel): void {
    this.store();
    this.analytics.track('daily_claim', { item, crystals, total: this.save.crystals });
    this.home(panel);
  }

  /** Counts this battle's events toward today's tasks. */
  private countDaily(events: BattleEvent[]): void {
    const m = this.save;
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
    this.store();
    this.analytics.track('meta_buy', { item, crystals: this.save.crystals });
    this.home();
  }

  private showEnd(b: Battle): void {
    const secs = Math.round(b.time);
    const stats = t('stats', { wave: b.wave, kills: b.kills, time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` });
    const canRevive = b.result === 'lost' && !this.revived && this.platform.rewardedAvailable();
    if (canRevive) this.run?.onReviveOffer();
    this.overlay.showEnd(b.result === 'won', stats, this.reward, () => void this.again(), canRevive ? () => void this.revive(b) : null);
  }

  private async revive(b: Battle): Promise<void> {
    this.overlay.hide();
    const ok = await this.platform.rewarded(() => this.mute(true));
    this.mute(false);
    this.run?.onReviveResult(ok);
    if (ok) {
      this.revived = true;
      b.revive();
      this.platform.gameplayStart();
    } else {
      this.revived = true; // one offer per battle, even when the ad failed
      this.showEnd(b);
    }
  }

  private async again(): Promise<void> {
    this.overlay.hide();
    // never an ad after the very first battle
    if (this.save.runs > 1) {
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

  /** No sound yet; this is where ads will silence it. */
  private mute(_on: boolean): void {}
}
