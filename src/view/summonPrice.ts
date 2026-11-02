// 召唤's price line (audit V5): the gold, "free" for a free summon (the first battle's next gift
// too, while its countdown fills the button), and nothing at all while some other free one cannot
// be taken, so a greyed-out button never reads "● 0".
import { t } from '../i18n';
import type { Battle } from '../sim/battle';

export function summonPrice(b: Battle): string {
  const cost = b.summonCost();
  return cost > 0 ? `\n● ${cost}` : b.canSummon() || b.giftLeft() > 0 ? `\n${t('free')}` : '';
}
