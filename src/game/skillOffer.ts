// A skill offer on screen (the 强化's pick, a boss's, an ultimate's): its cards, the rewarded
// refresh of them, and the pick that takes them away. Split from app.ts.

import type { Game } from '../app';
import { t } from '../i18n';
import type { Battle } from '../sim/battle';
import { addProgress } from '../sim/daily';
import { suggestSkill } from '../sim/suggest';
import { topPick } from '../view/nudges';

export function showSkills(g: Game, b: Battle): void {
  // no ad in the tutorial's first pick: it is there to teach the cards
  const canReroll = b.canReroll() && !g.autoplay && !g.tutorial && g.platform.rewardedAvailable();
  if (canReroll) g.run?.onRerollOffer();
  const title = t(b.choiceReason === 'ultimate' ? 'ultimatePick' : b.choiceReason === 'boss' ? 'bossPick' : 'upgradePick');
  const choices = b.choices ?? [];
  const top = !g.autoplay && topPick(g.save) ? suggestSkill(b, choices) : null;
  g.overlay.showSkills(choices, b.skills, title, (id) => pickSkill(g, id), canReroll ? () => void reroll(g, b) : null, top);
}

/** The rewarded refresh: a new set of cards for the waiting offer. */
async function reroll(g: Game, b: Battle): Promise<void> {
  const ok = await g.watch();
  g.run?.onRerollResult(ok);
  if (ok) b.reroll();
  else b.apply({ type: 'noReroll' }); // one offer of the ad per pick, even when it failed
  if (b.choices && g.overlay.visible) showSkills(g, b);
}

export function pickSkill(g: Game, id: Parameters<Battle['choose']>[0]): void {
  if (g.battle?.choices) {
    g.run?.onSkillPick(id, g.battle.choices);
    if (!g.autoplay) addProgress(g.save, 'skill');
    g.audio.play('levelup');
  }
  g.battle?.choose(id);
  g.overlay.hide();
}

/** The tower's catalyst pick on screen (sim/tower.ts). */
export function showCatalysts(g: Game, b: Battle): void {
  g.overlay.showCatalysts(b.catalystChoices ?? [], b.catalysts, (id) => {
    g.audio.play('levelup');
    b.apply({ type: 'catalyst', id });
    g.overlay.hide();
  });
}
