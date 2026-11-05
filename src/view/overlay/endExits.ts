// The third loss in a row on a stage (plan 4c): under the tips, the ways round it. A lineup whose
// potions set off more reactions between them, hard mode of a chapter behind (it pays as stages
// further on), and the tower. Each row is one tap.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { bottle, infinityIcon, ink, lightTile, P, plate, swordsIcon, tappable } from '../kit';
import type { Section } from './endRows';
import type { ExitKind, ExitsEnd } from './endTypes';

/** The rows there are, in order: the lineup, then hard mode, then the tower. */
export function exitKinds(e: ExitsEnd): ExitKind[] {
  const out: ExitKind[] = [];
  if (e.lineup) out.push('lineup');
  if (e.hardChapter != null) out.push('hard');
  if (e.tower) out.push('tower');
  return out;
}

export function exits(e: ExitsEnd, onExit: (kind: ExitKind) => void, cw: number): Section | null {
  const kinds = exitKinds(e);
  if (kinds.length === 0) return null;
  const c = new Container();
  const title = plate(t('alchemy.exits.title'), 40, 300, 'brass');
  title.y = 40;
  c.addChild(title);
  const rh = 108;
  const gap = 14;
  const top = 96;
  kinds.forEach((kind, i) => {
    const row = new Container();
    row.label = `exit_${kind}`;
    row.y = top + i * (rh + gap) + rh / 2;
    row.addChild(lightTile(cw, rh, 22));
    let tx = -cw / 2 + 130;
    let name = '';
    let desc = '';
    if (kind === 'lineup' && e.lineup) {
      e.lineup.forEach((k, j) => {
        const b = bottle(k, 62);
        b.x = -cw / 2 + 50 + j * 52;
        row.addChild(b);
      });
      tx = -cw / 2 + 50 + 4 * 52;
      name = t('alchemy.exits.lineup');
      desc = t('alchemy.exits.reacts', { n: e.reactions });
    } else if (kind === 'hard') {
      const pic = swordsIcon();
      pic.scale.set(0.7);
      pic.x = -cw / 2 + 64;
      row.addChild(pic);
      name = t('alchemy.exits.hard', { c: e.hardChapter ?? 1 });
      desc = t('alchemy.exits.hardDesc');
    } else {
      const pic = infinityIcon();
      pic.x = -cw / 2 + 64;
      row.addChild(pic);
      name = t('alchemy.exits.tower');
      desc = t('alchemy.exits.towerDesc');
    }
    const room = cw / 2 - 80 - tx;
    const n = ink(name, 38);
    n.anchor.set(0, 0.5);
    n.position.set(tx, -18);
    if (n.width > room) n.scale.set(room / n.width);
    const d = ink(desc, 30, { fill: P.inkSoft });
    d.anchor.set(0, 0.5);
    d.position.set(tx, 24);
    if (d.width > room) d.scale.set(room / d.width);
    const go = new Graphics()
      .poly([cw / 2 - 58, -22, cw / 2 - 34, 0, cw / 2 - 58, 22], false)
      .stroke({ width: 8, color: P.inkSoft, cap: 'round', join: 'round' });
    row.addChild(n, d, go);
    tappable(row, () => onExit(kind));
    c.addChild(row);
  });
  return { c, h: top + kinds.length * (rh + gap) + 20 };
}
