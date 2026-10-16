// The claim animation: crystals burst from where a reward was claimed and fly in an arc into
// the purse in the top bar, its count ticking up and the purse bouncing as each one lands.

import { Container, Graphics, type Text } from 'pixi.js';
import { gem } from './ui';

/** Seconds of the burst, of each crystal's flight, and between one crystal and the next. */
const BURST = 0.22;
const FLIGHT = 0.55;
const STAGGER = 0.06;

/** Flies crystals from `from` (in `layer`'s units) to `purse`, whose `count` shows `before`
 *  until the first lands and `after` once the last has. */
export function flyCrystals(layer: Container, from: { x: number; y: number }, purse: Container, count: Text, before: number, after: number): void {
  const to = layer.toLocal(purse.getGlobalPosition());
  const n = Math.min(12, Math.max(5, Math.round((after - before) / 15)));
  count.text = String(before);
  const fx = new Container();
  fx.eventMode = 'none';
  layer.addChild(fx);
  const gems = Array.from({ length: n }, (_, i) => {
    const g = gem(new Graphics(), 0, 0, 24);
    g.visible = false;
    fx.addChild(g);
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const r = 70 + Math.random() * 60;
    return { g, dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8, delay: i * STAGGER, landed: false };
  });
  const start = performance.now();
  let landed = 0;
  let lastLand = -1;
  fx.onRender = () => {
    if (purse.destroyed || count.destroyed) return;
    const t = (performance.now() - start) / 1000;
    for (const p of gems) {
      const e = t - p.delay;
      if (e < 0 || p.landed) continue;
      p.g.visible = true;
      if (e < BURST) {
        // out of the button, easing to a stop
        const k = 1 - (1 - e / BURST) ** 3;
        p.g.position.set(from.x + p.dx * k, from.y + p.dy * k);
        p.g.scale.set(0.6 + 0.4 * k);
        p.g.rotation = k * 0.6;
        continue;
      }
      const k = Math.min(1, (e - BURST) / FLIGHT);
      const q = k * k; // speeding up toward the purse
      const sx = from.x + p.dx;
      const sy = from.y + p.dy;
      // a curve through a point above the line, so the crystals arc rather than slide
      const cx = (sx + to.x) / 2 + p.dx * 0.5;
      const cy = Math.min(sy, to.y) - 160;
      p.g.position.set((1 - q) ** 2 * sx + 2 * (1 - q) * q * cx + q * q * to.x, (1 - q) ** 2 * sy + 2 * (1 - q) * q * cy + q * q * to.y);
      p.g.scale.set(1 - 0.35 * q);
      p.g.rotation = 0.6 + q * 2;
      if (k >= 1) {
        p.landed = true;
        p.g.visible = false;
        landed++;
        lastLand = t;
        count.text = String(Math.round(before + ((after - before) * landed) / n));
      }
    }
    // the purse swells a little with each crystal and settles back
    const since = lastLand < 0 ? 1 : t - lastLand;
    purse.scale.set(1 + 0.14 * Math.max(0, 1 - since / 0.18));
    if (landed === n && since > 0.2) {
      purse.scale.set(1);
      count.text = String(after);
      fx.onRender = null;
      fx.visible = false;
      queueMicrotask(() => fx.destroyed || fx.destroy({ children: true }));
    }
  };
}
