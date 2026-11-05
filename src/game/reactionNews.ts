// The save's side of a reaction going off in a live battle: the first time ever a kind goes off it
// pays its find reward at once and says so over the field; a kind reaching a mastery star says
// what the star brings (more power from the next battle on, reactionPower.ts). Runs before the
// frame's events are counted, which is what tells a first time from the rest.

import type { Game } from '../app';
import { t } from '../i18n';
import { reactionNews } from '../sim/reactionPower';
import { BALANCE, type BattleEvent } from '../sim/types';

/** Seconds the line stays up. */
export const NEWS_SECONDS = 3.5;

export function announceReactions(g: Game, events: readonly BattleEvent[]): void {
  if (!events.some((e) => e.type === 'reaction')) return;
  const news = reactionNews(g.save, events);
  const C = BALANCE.reactions;
  for (const id of news.found) {
    g.save.crystals += C.findReward;
    g.hud.note(t('alchemy.found', { name: t(`codex.rx.${id}`), n: C.findReward }), NEWS_SECONDS);
    g.audio.play('crystal');
  }
  for (const [id, stars] of news.starred) {
    if (news.found.includes(id)) continue;
    g.hud.note(t('alchemy.starred', { name: t(`codex.rx.${id}`), s: stars, p: Math.round(C.masteryStep * stars * 100) }), NEWS_SECONDS);
    g.audio.play('levelup');
  }
  if (news.found.length || news.starred.length) g.store();
}
