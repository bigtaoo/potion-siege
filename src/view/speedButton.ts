// The battle's speed button under the pause button: a brass medal reading ×1, green reading ×1.5
// while the battle runs fast (game/battleSpeed.ts).

import { Container } from 'pixi.js';
import { medal, P, tappable } from './kit';
import { label } from './ui';

export class SpeedButton extends Container {
  private readonly slow = new Container();
  private readonly fast = new Container();

  constructor(onTap: () => void) {
    super();
    tappable(this, onTap);
    this.label = 'speed';
    this.slow.addChild(medal(44), label('×1', 34, { stroke: { color: P.line, width: 6 } }));
    this.fast.addChild(medal(44, P.greenOn), label('×1.5', 30, { stroke: { color: P.line, width: 6 } }));
    this.addChild(this.slow, this.fast);
    this.show(false);
  }

  show(fast: boolean): void {
    this.slow.visible = !fast;
    this.fast.visible = fast;
  }
}
