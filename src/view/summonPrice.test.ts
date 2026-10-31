import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { Battle } from '../sim/battle';
import { BASE_SETUP } from '../sim/meta';
import { summonPrice } from './summonPrice';

describe('summonPrice', () => {

  it('shows the gold a summon costs', () => {
    const b = new Battle(1, BASE_SETUP);
    b.summonCost = () => 35;
    expect(summonPrice(b)).toBe('\n● 35');
  });

  it('reads Free for a free summon that can be taken', () => {
    const b = new Battle(1, { ...BASE_SETUP, freeSummons: 1 });
    expect(b.canSummon()).toBe(true);
    expect(summonPrice(b)).toBe(`\n${t('free')}`);
  });

  it('shows no price at all on a greyed-out free summon, never 0', () => {
    const b = new Battle(1, { ...BASE_SETUP, freeSummons: 1 });
    b.canSummon = () => false;
    expect(summonPrice(b)).toBe('');
    expect(summonPrice(b)).not.toContain('0');
  });
});
