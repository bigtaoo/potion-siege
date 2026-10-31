// 召唤's price line (audit V5): the gold, "free" for a free summon, and nothing at all while a
// free one cannot be taken yet, so a greyed-out button never reads "● 0".
import { t } from '../i18n';
import type { Battle } from '../sim/battle';

export function summonPrice(b: Battle): string {
  const cost = b.summonCost();
  return cost > 0 ? `\n● ${cost}` : b.canSummon() ? `\n${t('free')}` : '';
}
