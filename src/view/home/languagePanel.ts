// The language picker over the home screen.

import type { Container } from 'pixi.js';
import { getLocale, LOCALES, localeName, t } from '../../i18n';
import { PillButton } from '../kit';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import type { HomeActions } from './types';

/** Every language by its own name, two to a row, the one in use green; a pick closes it. */
export function languagePanel(act: HomeActions, fit: MenuFit): Container {
  const rows = Math.ceil(LOCALES.length / 2);
  const h = rows * 124 + 150;
  const { panel, box } = frame(act, t('sound.language'), h, fit);
  LOCALES.forEach((l, i) => {
    const b = new PillButton(localeName(l), 400, 100, l === getLocale() ? 'green' : 'brass', () => act.language(l), 42);
    b.position.set(i % 2 ? 210 : -210, -h / 2 + 140 + Math.floor(i / 2) * 124);
    box.addChild(b);
  });
  return panel;
}
