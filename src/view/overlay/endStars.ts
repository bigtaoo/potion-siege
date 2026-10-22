// The result board's notes on a stage win's stars: a first hard win or a new best, a chapter's
// hard mode just opened, and while three stars are still to get, what they take.

import { t } from '../../i18n';
import { STARS, type StarsResult } from '../../sim/stars';
import { fit, ink, P } from '../kit';
import { ribbon, section, type Section } from './endRows';

/** The ribbons and the hint for `s`, each `w` wide at most; none without a win's stars. */
export function starNotes(s: StarsResult | undefined, w: number): Section[] {
  if (!s || s.stars === 0) return [];
  const out: Section[] = [];
  if (s.hard && s.before === 0) out.push(section(ribbon(t('stars.hardFirst'), w), 110));
  else if (s.before > 0 && s.stars > s.before) out.push(section(ribbon(t('stars.best'), w), 110));
  if (s.opened > 0) out.push(section(ribbon(t('stars.hardOpen', { n: s.opened }), w), 110));
  if (Math.max(s.stars, s.before) < 3) {
    const hint = fit(ink(t('stars.rule', { p: Math.round(STARS.three * 100) }), 32, { fill: P.inkSoft, fontWeight: '900' }), w);
    out.push(section(hint, 60));
  }
  return out;
}
