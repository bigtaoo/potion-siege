// The codex tab, in three pages tabs at the top turn between, one board each. The potions: each
// with its four star forms (the ones not in the game yet greyed out and locked) under one row of
// stars. The clockwork army: a card per enemy with its art, what it is in a word and the one
// element it fears and the one it shrugs off most; a tap opens its panel with the numbers and
// the whole damage table. And the achievements: each track's next tier, how far along it is and
// its claim button, the ones to claim on top.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { achievementsClaimable, type TrackId } from '../../sim/achievements';
import type { MetaSave } from '../../sim/meta';
import type { EnemyKind } from '../../sim/types';
import { fit, ink, LIGHT, P, redDot, tappable } from '../kit';
import { label } from '../ui';
import { featsBoard, scrollFeats } from './achievements';
import type { CodexArea } from './common';
import { enemiesPage } from './enemies';
import { potionsPage } from './potions';

export type { CodexArea } from './common';
export { isEnemy } from './enemies';
export { enemyPanel } from './enemyDetail';
export { scrollFeats } from './achievements';

export const CODEX_PAGES = ['potions', 'enemies', 'feats'] as const;
export type CodexPage = (typeof CODEX_PAGES)[number];
/** The page shown, kept while the tab is rebuilt. */
let codexPage: CodexPage = 'potions';

/** Turns the codex to `p` for its next build (the layout test walks every page). */
export function setCodexPage(p: CodexPage): void {
  codexPage = p;
}

/** `claim`: the next tier of an achievement track, from the button tapped; `open`: an enemy's
 *  panel, from its card. */
export function buildCodex(m: MetaSave, a: CodexArea, claim: (id: TrackId, at: Container) => void, open: (kind: EnemyKind) => void): Container {
  const root = new Container();
  const page = new Container();
  const bar = new Container();
  root.addChild(page, bar);
  // portrait: the board moves down to make room for the tabs; landscape: they sit in the top
  // bar's row, between its buttons and the crystals
  const top = a.wide ? a.y + 50 : a.y + 136;
  const show = (): void => {
    for (const c of [...page.removeChildren(), ...bar.removeChildren()]) c.destroy({ children: true });
    if (codexPage === 'potions') potionsPage(page, m, a, top);
    else if (codexPage === 'enemies') enemiesPage(page, m, a, top, open);
    else featsBoard(page, m, a, top, claim);
    // rebuilt after the tap, which is still running on the tab about to go
    bar.addChild(pageTabs(m, a, () => queueMicrotask(show)));
  };
  show();
  return root;
}

/** The three page tabs, the one shown lit; a dot on the achievements while a tier waits. */
function pageTabs(m: MetaSave, a: CodexArea, turned: () => void): Container {
  const c = new Container();
  // landscape: midway between the top bar's buttons (to a.x + 450) and the crystals (from 360
  // short of the right edge, room for a seven-digit count)
  c.position.set(a.wide ? a.x + (450 + a.w - 360) / 2 : a.x + a.w / 2, a.wide ? 70 : a.y + 58);
  const tw = a.wide ? 250 : Math.min(320, (a.w - 76) / 3);
  const th = 64;
  CODEX_PAGES.forEach((id, i) => {
    const on = codexPage === id;
    const tab = new Container();
    tab.x = (i - 1) * (tw + 8);
    tab.addChild(
      new Graphics()
        .roundRect(-tw / 2, -th / 2 + 6, tw, th, th / 2)
        .fill({ color: P.line, alpha: 0.35 })
        .roundRect(-tw / 2, -th / 2, tw, th, th / 2)
        .fill(on ? P.brass : LIGHT.face)
        .stroke({ width: 5, color: on ? P.line : LIGHT.edge }),
      fit(on ? label(t(`codex.page.${id}`), 32, { fill: P.cream, stroke: { color: P.line, width: 6 } }) : ink(t(`codex.page.${id}`), 32, { fill: P.inkSoft }), tw - 50),
    );
    if (id === 'feats' && achievementsClaimable(m)) redDot(tab, tw / 2 - 16, -th / 2 + 6);
    if (!on)
      tappable(tab, () => {
        codexPage = id;
        if (id === 'feats') scrollFeats();
        turned();
      });
    c.addChild(tab);
  });
  return c;
}
