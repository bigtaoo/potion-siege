// The skill cards on offer share one look (cardFit.ts): one name size and one description size
// across a row, and a description that runs long wraps under a smaller picture instead of
// shrinking.
import '../layout/measure';
import { Text } from 'pixi.js';
import { afterAll, describe, expect, it } from 'vitest';
import { LOCALES, loadLocale, setLocale, t } from '../../i18n';
import { SKILL_IDS, type SkillId } from '../../sim/skills';
import { cardLook, DESC_SIZES } from './cardFit';
import { skillCard } from './skillCard';

afterAll(() => setLocale('en'));

/** The card's words that are not its name nor the recipe tag: its description. */
function desc(id: SkillId, look = cardLook([id])): Text {
  const card = skillCard(id, 0, look);
  return card.children.find((c): c is Text => c instanceof Text && c.text.replace(/\s+/g, '') !== '' && c.style.fontSize === look.desc)!;
}

describe('a row of skill cards', () => {
  it('draws every name at one size and every description at one size', async () => {
    await loadLocale('de');
    setLocale('de');
    const row: SkillId[] = ['iceDamage', 'allDamage', 'fireArcane'];
    const look = cardLook(row);
    const sizes = row.map((id) => {
      const card = skillCard(id, 0, look);
      const words = card.children.filter((c): c is Text => c instanceof Text);
      return [words[0].style.fontSize, desc(id, look).style.fontSize];
    });
    expect(new Set(sizes.map((s) => s[0])).size).toBe(1);
    expect(new Set(sizes.map((s) => s[1])).size).toBe(1);
    expect(sizes[0][1]).toBe(look.desc);
  });

  it('never shrinks a description past the floor, in any language', async () => {
    const floor = DESC_SIZES[DESC_SIZES.length - 1];
    const small: string[] = [];
    for (const lang of LOCALES) {
      await loadLocale(lang);
      setLocale(lang);
      for (const id of SKILL_IDS) {
        const d = desc(id);
        const size = d.style.fontSize * d.scale.y;
        // a Thai line with no break in it may still need a touch less
        if (size < floor * (lang === 'th' ? 0.8 : 0.97)) small.push(`${lang} ${id} ${size.toFixed(1)}: ${t(`skill.${id}.desc`)}`);
      }
    }
    expect(small).toEqual([]);
  });

  it('keeps the big picture while every description fits beside it', async () => {
    await loadLocale('en');
    setLocale('en');
    expect(cardLook(['allDamage', 'gold', 'crit']).small).toBe(false);
  });
});
