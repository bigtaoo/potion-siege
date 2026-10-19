// The play statistics question over the home screen, for players where the law asks first.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { ink, inkWrapped, P, PillButton, tappable } from '../kit';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions } from './types';

/** The question to a player in the EEA, the UK or Switzerland, once per session from the first
 *  home screen on: send play statistics or not. Closing it (the ✕, a tap beside it) answers
 *  nothing, and nothing is sent. */
export function consentPanel(act: HomeActions, fit: MenuFit, policy: boolean): Container {
  const text = inkWrapped(t('privacy.ask'), 40, 820);
  const h = 110 + text.height + 60 + 120 + (policy ? 120 : 0) + 50;
  const { panel, box } = frame(act, t('privacy.title'), h, fit);
  text.anchor.set(0.5, 0);
  text.y = -h / 2 + 110;
  box.addChild(text);
  const row = text.y + text.height + 60 + 60;
  const allow = new PillButton(t('privacy.allow'), 380, 120, 'green', () => act.shareData(true), 48);
  allow.position.set(-205, row);
  const decline = new PillButton(t('privacy.decline'), 380, 120, 'brass', () => act.shareData(false), 44);
  decline.position.set(205, row);
  box.addChild(allow, decline);
  if (policy) {
    const link = tappable(new Container(), act.privacyPolicy);
    const word = ink(t('sound.policy'), 36, { fill: P.brassDark });
    const line = new Graphics().rect(-word.width / 2, 22, word.width, 3).fill(P.brassDark);
    link.addChild(word, line);
    link.position.set(0, row + 125);
    box.addChild(link);
  }
  return panel;
}
