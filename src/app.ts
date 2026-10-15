// The game shell: owns the Pixi app, fits the 1080x1920 design to the screen and runs the
// flow title -> battle (with skill picks) -> end -> battle again.

import { Application, Container } from 'pixi.js';
import pkg from '../package.json';
import { Analytics, type Sink } from './analytics/analytics';
import { RunTracker } from './analytics/runTracker';
import { BeaconSink, ConsoleSink, MemorySink } from './analytics/sinks';
import { setLocale, t } from './i18n';
import type { Platform } from './platform/types';
import { Battle } from './sim/battle';
import { botAct } from './sim/bot';
import { loadArt } from './view/art';
import { BattleView } from './view/BattleView';
import { Hud } from './view/Hud';
import { Overlay } from './view/Overlay';
import { COLORS } from './view/ui';
import { fitDesign } from './view/viewport';

const SAVE_KEY = 'mb.save';

interface Save {
  bestWave: number;
  runs: number;
}

function loadSave(platform: Platform): Save {
  try {
    const raw = JSON.parse(platform.storage.getItem(SAVE_KEY) ?? '{}') as Partial<Save>;
    return { bestWave: Number(raw.bestWave) || 0, runs: Number(raw.runs) || 0 };
  } catch {
    return { bestWave: 0, runs: 0 };
  }
}

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
  private battle: Battle | null = null;
  private run: RunTracker | null = null;
  private save: Save;
  private revived = false;
  private readonly autoplay: boolean;
  private readonly speed: number;

  constructor(
    private readonly app: Application,
    private readonly platform: Platform,
    params: URLSearchParams,
    readonly analytics: Analytics,
  ) {
    this.save = loadSave(platform);
    this.autoplay = params.has('autoplay');
    this.speed = Math.max(1, Number(params.get('speed')) || 1);
    this.hud = new Hud(
      () => this.battle?.summon(),
      () => this.battle?.upgrade(),
    );
    this.root.addChild(this.view, this.hud, this.overlay);
    app.stage.addChild(this.root);
    app.ticker.add((ticker) => this.tick(Math.min(ticker.deltaMS / 1000, 0.1)));
  }

  start(): void {
    if (this.autoplay) {
      this.newBattle('autoplay');
      this.platform.gameplayStart();
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
    this.run?.close('pagehide');
    this.analytics.track('session_end', { secs: this.analytics.sessionSeconds, runs: this.save.runs, best: this.save.bestWave });
    this.analytics.flush();
  }

  /** `cause` null: the title screen is up and the run starts when the player taps. */
  private newBattle(cause: 'again' | 'autoplay' | null): void {
    this.run?.close('again');
    this.battle = new Battle((Math.random() * 2 ** 32) >>> 0);
    this.run = cause ? new RunTracker(this.analytics, this.battle, this.save.runs + 1, cause) : null;
    this.revived = false;
    this.view.attach(this.battle);
    this.hud.attach(this.battle);
  }

  private tick(dt: number): void {
    const fit = fitDesign(this.app.screen.width, this.app.screen.height);
    this.root.scale.set(fit.scale);
    this.root.position.set(fit.x, fit.y);

    const b = this.battle;
    if (b && !this.overlay.visible) {
      for (let i = 0; i < this.speed; i++) {
        if (this.autoplay) botAct(b);
        b.step(dt);
      }
      const events = b.drain();
      this.run?.onEvents(events);
      this.view.react(events);
      this.hud.react(events);
      if (b.choices) this.overlay.showSkills(b.choices, t(b.choiceReason === 'ultimate' ? 'ultimatePick' : 'upgradePick'), (id) => this.pick(id));
      else if (b.result) this.finish(b);
    }
    this.view.update(dt);
    this.hud.update(dt);
  }

  private pick(id: Parameters<Battle['choose']>[0]): void {
    if (this.battle?.choices) this.run?.onSkillPick(id, this.battle.choices);
    this.battle?.choose(id);
    this.overlay.hide();
  }

  private finish(b: Battle): void {
    this.platform.gameplayStop();
    if (!this.revived) this.save.runs++; // a revived run ending again is still one run
    this.save.bestWave = Math.max(this.save.bestWave, b.wave);
    this.platform.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
    if (b.result === 'won') this.platform.celebrate();
    this.run?.onEnd();
    this.showEnd(b);
    if (this.autoplay) setTimeout(() => void this.again(), 1500);
  }

  private showEnd(b: Battle): void {
    const secs = Math.round(b.time);
    const stats = t('stats', { wave: b.wave, kills: b.kills, time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` });
    const canRevive = b.result === 'lost' && !this.revived && this.platform.rewardedAvailable();
    if (canRevive) this.run?.onReviveOffer();
    this.overlay.showEnd(b.result === 'won', stats, () => void this.again(), canRevive ? () => void this.revive(b) : null);
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
    this.newBattle(this.autoplay ? 'autoplay' : 'again');
    this.platform.gameplayStart();
  }

  /** No sound yet; this is where ads will silence it. */
  private mute(_on: boolean): void {}
}
