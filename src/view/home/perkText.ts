// What a perk does, in words: the Lv 10 perks each have their own line, the late ones past Lv 20
// one line a step with its number.

import { t } from '../../i18n';
import { LATE, lateStepOf } from '../../sim/latePerks';
import type { PerkId, PERK_IDS } from '../../sim/skills';

export function perkText(id: PerkId): string {
  const late = lateStepOf(id);
  if (!late) return t(`perk.${id as (typeof PERK_IDS)[number]}`);
  return t(`perkLate.${late.step}`, { p: Math.round(LATE[late.step] * 100) });
}
