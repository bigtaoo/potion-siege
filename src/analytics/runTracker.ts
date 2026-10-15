// Turns one battle's events into telemetry: onboarding firsts, wave progress, skill picks and a
// run summary at the end (or when the player leaves mid-run).

import type { Battle } from '../sim/battle';
import type { SkillId } from '../sim/skills';
import type { BattleEvent } from '../sim/types';
import type { Analytics } from './analytics';

export class RunTracker {
  private merges = 0;
  private maxStar = 1;
  private revives = 0;
  private picks: SkillId[] = [];
  private ended = false;

  constructor(
    private readonly a: Analytics,
    private readonly battle: Battle,
    /** 1-based run number for this player, across sessions. */
    private readonly run: number,
    cause: 'first' | 'again' | 'autoplay',
  ) {
    a.track('run_start', { run, cause, stage: battle.setup.stage });
  }

  onEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'summon':
          this.a.first('first_summon', { t: this.a.sessionSeconds });
          break;
        case 'merge':
          this.merges++;
          this.maxStar = Math.max(this.maxStar, ev.star);
          this.a.first('first_merge', { t: this.a.sessionSeconds, wave: this.battle.wave });
          if (ev.star >= 3) this.a.first(`first_star${ev.star}`, { t: this.a.sessionSeconds, run: this.run });
          break;
        case 'wave':
          // one per wave per run: the "where do runs die" curve
          this.a.track('wave_start', { run: this.run, wave: ev.wave, boss: ev.boss, wall: this.wallPct() });
          break;
        case 'offer':
          this.a.first(`first_${ev.reason}`, { t: this.a.sessionSeconds, wave: this.battle.wave });
          break;
      }
    }
  }

  onSkillPick(id: SkillId, offered: SkillId[]): void {
    this.picks.push(id);
    this.a.track('skill_pick', { run: this.run, id, offered, reason: this.battle.choiceReason, upgrades: this.battle.upgrades, wave: this.battle.wave });
  }

  onReviveOffer(): void {
    this.a.track('ad_offer', { placement: 'revive', run: this.run, wave: this.battle.wave });
  }

  onReviveResult(ok: boolean): void {
    if (ok) this.revives++;
    this.a.track('ad_result', { placement: 'revive', ok, run: this.run, wave: this.battle.wave });
  }

  /** Called on every result screen; a revived run reports again when it ends for good. */
  onEnd(): void {
    this.a.track('run_end', this.summary());
    if (this.battle.result === 'won') this.a.first('first_win', { run: this.run });
  }

  /** Called when a fresh run replaces this one, or the page goes away mid-run. */
  close(reason: 'again' | 'pagehide'): void {
    if (this.ended) return;
    this.ended = true;
    if (reason === 'pagehide' && !this.battle.result) this.a.track('run_quit', this.summary());
  }

  private wallPct(): number {
    return Math.round((100 * Math.max(0, this.battle.wall)) / this.battle.wallMax);
  }

  private summary() {
    const b = this.battle;
    return {
      run: this.run,
      result: b.result ?? 'quit',
      wave: b.wave,
      secs: Math.round(b.time),
      kills: b.kills,
      upgrades: b.upgrades,
      summons: b.summons,
      commander: b.commanderLevel,
      merges: this.merges,
      maxStar: this.maxStar,
      revives: this.revives,
      wall: this.wallPct(),
      skills: this.picks,
    };
  }
}
