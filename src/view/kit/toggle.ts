// The on/off switch the settings rows and the pause panel draw.

import { Container, Graphics } from 'pixi.js';
import { t } from '../../i18n';
import { label } from '../ui';
import { LIGHT, P } from './palette';
import { fit as fitText } from './text';

/** An on/off switch: a green track with the knob on the right, or a grey one with it on the left. */
export function toggle(on: boolean): Container {
  const c = new Container();
  const w = 220;
  const h = 96;
  const track = new Graphics()
    .roundRect(-w / 2, -h / 2 + 6, w, h, h / 2)
    .fill({ color: P.line, alpha: 0.3 })
    .roundRect(-w / 2, -h / 2, w, h, h / 2)
    .fill(on ? P.greenOn : LIGHT.inset)
    .stroke({ width: 5, color: on ? P.line : LIGHT.edge });
  const kx = on ? w / 2 - h / 2 : -w / 2 + h / 2;
  const knob = new Graphics()
    .circle(kx, 4, h / 2 - 8)
    .fill({ color: P.line, alpha: 0.3 })
    .circle(kx, 0, h / 2 - 8)
    .fill(on ? P.brassLight : LIGHT.face)
    .stroke({ width: 5, color: P.line });
  const word = label(t(on ? 'sound.on' : 'sound.off'), 34, { stroke: { color: P.line, width: 6 } });
  word.position.set(on ? -h / 2 + 18 : h / 2 - 18, -3);
  fitText(word, w - h - 16);
  c.addChild(track, knob, word);
  return c;
}
