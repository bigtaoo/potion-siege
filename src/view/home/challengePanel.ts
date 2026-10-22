// Today's challenge as a panel over the home screen.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { bestToday, canPlayAd, canPlayFree, CHALLENGE_TIERS, msToTomorrow, streak, tierOf, todaysChallenge } from '../../sim/challenge';
import type { MetaSave } from '../../sim/meta';
import { fit as fitText, ink, LIGHT, lightTile, modifierIcon, P, PillButton } from '../kit';
import { gem } from '../ui';
import type { MenuFit } from '../viewport';
import { frame } from './frame';
import { adIcon, tick } from './shared';
import type { HomeActions } from './types';

/** Today's challenge in full, over the page: the two modifiers, the reward tiers (those reached
 *  today ticked), the best wave and streak, and the way in: the free attempt, then the
 *  rewarded retry, then the time until the next one. */
export function challengePanel(m: MetaSave, act: HomeActions, today: string, ads: boolean, fit: MenuFit): Container {
  const h = 980;
  const ch = todaysChallenge(m, today);
  const { panel, box } = frame(act, `${t('challenge.title')} · ${t('stage', { n: ch.stage })}`, h, fit);
  const top = -h / 2;
  // the modifiers, a row each
  ch.mods.forEach((id, i) => {
    const r = new Container();
    r.position.set(0, top + 170 + i * 150);
    const icon = modifierIcon(id, ch.trial);
    icon.scale.set(0.8);
    icon.x = -360;
    const name = ink(t(`challenge.mod.${id}.name`), 42, { fontWeight: '900' });
    name.anchor.set(0, 0.5);
    name.position.set(-290, -24);
    fitText(name, 680);
    const desc = ink(t(`challenge.mod.${id}.desc`, { hero: ch.trial ? t(`hero.${ch.trial}`) : '' }), 32, { fill: P.inkSoft });
    desc.anchor.set(0, 0.5);
    desc.position.set(-290, 26);
    fitText(desc, 680);
    r.addChild(lightTile(860, 130, 22), icon, name, desc);
    box.addChild(r);
  });
  // the reward tiers, side by side
  const best = bestToday(m, today);
  const reached = tierOf(best);
  const head = ink(t('challenge.rewards'), 34, { fill: P.brassDark });
  head.y = top + 440;
  box.addChild(head);
  CHALLENGE_TIERS.forEach((tier, i) => {
    const on = i < reached;
    const tw = 270;
    const r = new Container();
    r.position.set((i - 1) * (tw + 20), top + 540);
    r.addChild(new Graphics().roundRect(-tw / 2, -60, tw, 120, 24).fill(on ? 0xd4eec0 : LIGHT.inset).stroke({ width: 4, color: on ? P.greenOn : LIGHT.insetEdge }));
    const wave = fitText(ink(t('challenge.wave', { n: tier.wave }), 32, { fill: on ? P.greenInk : P.ink }), tw - 30);
    wave.y = -26;
    const n = ink(String(tier.reward), 40, { fill: LIGHT.crystal, fontWeight: '900' });
    n.position.set(18, 24);
    r.addChild(wave, n, gem(new Graphics(), 18 - n.width / 2 - 26, 22, 18));
    if (on) {
      const tk = tick(20);
      tk.position.set(tw / 2 - 18, -54);
      r.addChild(tk);
    }
    box.addChild(r);
  });
  // how it went so far
  const days = streak(m, today);
  const status = ink([t('challenge.best', { n: best }), ...(days > 0 ? [t('challenge.streak', { n: days })] : [])].join('   ·   '), 34, { fill: P.inkSoft });
  status.y = top + 660;
  box.addChild(fitText(status, 820));
  // the way in, or when the next one comes
  const foot = h / 2 - 130;
  if (canPlayFree(m, today)) {
    const go = new PillButton(t('challenge.go'), 520, 140, 'green', act.challenge, 60);
    go.y = foot;
    box.addChild(go);
  } else if (ads && canPlayAd(m, today)) {
    const again = new PillButton(t('challenge.retry'), 520, 140, 'purple', act.challengeAd, 52);
    const cap = again.children[1];
    cap.x = 34;
    const tv = adIcon();
    tv.scale.set(0.55);
    tv.position.set(34 - cap.width / 2 - 56, -6);
    again.addChild(tv);
    again.y = foot;
    box.addChild(again);
  } else {
    const left = ink('', 40, { fill: P.inkSoft });
    left.y = foot;
    let shown = '';
    left.onRender = () => {
      const secs = Math.ceil(msToTomorrow(new Date()) / 1000);
      const p = (v: number) => String(v).padStart(2, '0');
      const text = t('challenge.next', { time: `${p(Math.floor(secs / 3600))}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}` });
      if (text !== shown) left.text = shown = text;
    };
    box.addChild(left);
  }
  return panel;
}
