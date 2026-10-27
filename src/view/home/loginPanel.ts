// The daily login panel over the home screen: the seven days of the track and the claim.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { canClaimLogin, loginDay, loginReward } from '../../sim/daily';
import type { MetaSave } from '../../sim/meta';
import { ink, lightTile, P, PillButton } from '../kit';
import { gem } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import { claimedTile, markClaimed } from './shared';
import type { HomeActions } from './types';

/** The seven days of the login track: claimed ones ticked, today's lit up. */
export function loginPanel(m: MetaSave, act: HomeActions, today: string, fit: MenuFit): Container {
  const h = 820;
  const { panel, box } = frame(act, t('login'), h, fit);
  const can = canClaimLogin(m, today);
  let done = loginDay(m);
  if (!can && done === 0 && m.daily.claims > 0) done = 7;
  for (let i = 0; i < 7; i++) {
    // four days on the first row; days five and six, then the big seventh, on the second
    const last = i === 6;
    const w = last ? 400 : 190;
    const tile = new Container();
    tile.position.set(last ? 210 : -315 + (i % 4) * 210, i < 4 ? -190 : 70);
    const lit = can && i === done;
    const got = i < done;
    tile.addChild(got ? claimedTile(w, 220) : lightTile(w, 220, 24));
    if (lit) tile.addChild(new Graphics().roundRect(-w / 2 - 6, -116, w + 12, 232, 28).stroke({ width: 8, color: P.brass }));
    const day = ink(t('day', { n: i + 1 }), 34, { fill: lit ? P.brassDark : P.inkSoft });
    day.position.set(0, -76);
    const amount = ink(String(loginReward(i)), 40);
    amount.position.set(0, 72);
    tile.addChild(gem(new Graphics(), 0, -6, last ? 50 : 38), day, amount);
    if (got) markClaimed(tile, amount);
    box.addChild(tile);
  }
  const claim: PillButton = new PillButton(can ? t('claim') : t('tomorrow'), 520, 140, 'green', () => act.claimLogin(claim), 52).setEnabled(can);
  claim.position.set(0, h / 2 - 110);
  box.addChild(claim);
  return panel;
}
