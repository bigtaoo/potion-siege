// The welcome week panel over the home screen: the seven gifts of a new install (sim/welcome.ts),
// laid out as the login track is, with the potion as the big seventh. So the two are not taken
// for each other, this one has a red title and its gifts are wrapped: a rose tile with a bow.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import type { MetaSave } from '../../sim/meta';
import { canClaimWelcome, welcomeGift, WELCOME_GIFTS } from '../../sim/welcome';
import { bottle, ink, lightTile, P, PillButton } from '../kit';
import { gem } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import { claimedTile, markClaimed } from './shared';
import type { HomeActions } from './types';

/** The seven gifts: claimed ones ticked, today's lit up. */
export function welcomePanel(m: MetaSave, act: HomeActions, today: string, fit: MenuFit): Container {
  const h = 860;
  const { panel, box } = frame(act, t('welcome.title'), h, fit, 'red');
  const can = canClaimWelcome(m, today);
  const done = m.welcome.gifts;
  const note = ink(t('welcome.note'), 30, { fill: P.inkSoft });
  note.position.set(0, -330);
  box.addChild(note);
  for (let i = 0; i < WELCOME_GIFTS.length; i++) {
    // four gifts on the first row; five and six, then the big seventh, on the second
    const last = i === WELCOME_GIFTS.length - 1;
    const w = last ? 400 : 190;
    const tile = new Container();
    tile.position.set(last ? 210 : -315 + (i % 4) * 210, i < 4 ? -160 : 100);
    const lit = can && i === done;
    const got = i < done;
    tile.addChild(got ? claimedTile(w, 220) : wrapped(w, 220));
    if (lit) tile.addChild(new Graphics().roundRect(-w / 2 - 6, -116, w + 12, 232, 28).stroke({ width: 8, color: P.brass }));
    const day = ink(t('day', { n: i + 1 }), 34, { fill: lit ? P.brassDark : P.inkSoft });
    day.position.set(0, -76);
    const gift = welcomeGift(m, i);
    if (gift.potion) {
      const b = bottle(gift.potion, 110);
      b.position.set(0, -6);
      const name = ink(t(`hero.${gift.potion}`), 34);
      name.position.set(0, 76);
      tile.addChild(b, day, name);
      if (got) markClaimed(tile, name);
    } else {
      const amount = ink(String(gift.crystals), 40);
      amount.position.set(0, 72);
      tile.addChild(gem(new Graphics(), 0, -6, last ? 50 : 38), day, amount);
      if (got) markClaimed(tile, amount);
    }
    box.addChild(tile);
  }
  const claim: PillButton = new PillButton(can ? t('claim') : t('tomorrow'), 520, 140, 'green', () => act.claimWelcome(claim), 52).setEnabled(can);
  claim.position.set(0, h / 2 - 110);
  claim.label = 'claim_welcome';
  box.addChild(claim);
  return panel;
}

const RIBBON = 0xc9463d;
const RIBBON_DARK = 0x7e2421;

/** A gift not yet opened: the tile blushed rose, a ribbon round its edge and a bow on its top. */
function wrapped(w: number, h: number): Container {
  const c = new Container();
  c.addChild(
    lightTile(w, h, 24),
    new Graphics().roundRect(-w / 2, -h / 2, w, h - 8, 24).fill({ color: RIBBON, alpha: 0.12 }).roundRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 22, 18).stroke({ width: 5, color: RIBBON, alpha: 0.7 }),
  );
  const bow = new Graphics();
  for (const s of [-1, 1]) bow.ellipse(s * 20, -h / 2 + 2, 20, 12).fill(RIBBON).stroke({ width: 3, color: RIBBON_DARK });
  bow.circle(0, -h / 2 + 3, 9).fill(RIBBON).stroke({ width: 3, color: RIBBON_DARK });
  c.addChild(bow);
  return c;
}
