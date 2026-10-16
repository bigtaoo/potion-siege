// The first battle's tutorial over the whole screen: the page dimmed except for a cut-out
// around the control to use, a pulsing hand on it (dragging from one hero to the other for the
// merge), and a cream speech card in the light workshop style with a skip button. Taps inside
// the cut-out reach the battle below; everything else on the dim is swallowed.

import { Container, Graphics, type Text } from 'pixi.js';
import { t } from '../i18n';
import { TUTORIAL_STEPS, type TutorialStep } from '../sim/tutorial';
import { balanced, fit, LIGHT, lightPanel, lightTile, P, ink, tappable } from './kit';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What to point at, in page units: the cut-outs, where the hand goes (dragging `from` to `to`
 *  for the merge), and the area the card keeps out of (the board on a wide screen, the skill
 *  cards during the pick). */
export interface Lesson {
  step: TutorialStep;
  holes: Rect[];
  from: { x: number; y: number };
  to?: { x: number; y: number };
  clear: Rect;
}

/** The dim, a warm dark brown rather than black. */
const DIM = { color: P.line, alpha: 0.62 };
const PAD = 14;

export class TutorialLayer extends Container {
  private readonly dim = new Graphics();
  private readonly rings = new Graphics();
  private readonly arrow = new Graphics();
  private readonly hand = handShape();
  private readonly card = new Container();
  private holes: Rect[] = [];
  private key = '';
  private time = 0;

  constructor(private readonly onSkip: () => void) {
    super();
    this.visible = false;
    this.dim.eventMode = 'static'; // swallow taps outside the cut-outs
    this.dim.hitArea = { contains: (x: number, y: number) => !this.holes.some((r) => inside(r, x, y)) };
    this.hand.eventMode = 'none';
    this.arrow.eventMode = 'none';
    this.rings.eventMode = 'none';
    this.addChild(this.dim, this.rings, this.arrow, this.hand, this.card);
  }

  /** Shows `lesson` on a `w` x `h` page, or hides the layer when it is null. */
  show(lesson: Lesson | null, w: number, h: number, wide: boolean, dt: number): void {
    this.visible = lesson !== null;
    if (!lesson) {
      this.key = '';
      return;
    }
    this.time += dt;
    const pick = lesson.step === 'pick';
    this.holes = pick ? [] : joined(lesson.holes.map((r) => grow(r, PAD)));
    this.dim.visible = !pick;
    this.dim.eventMode = pick ? 'none' : 'static';
    this.hand.visible = !pick;

    const key = `${lesson.step}|${Math.round(w)}x${Math.round(h)}|${this.holes.map((r) => `${Math.round(r.x)},${Math.round(r.y)}`).join(';')}`;
    if (key !== this.key) {
      this.key = key;
      this.drawDim(w, h);
      this.buildCard(lesson, w, h, wide);
    }
    this.animate(lesson);
  }

  private drawDim(w: number, h: number): void {
    const g = this.dim.clear().rect(0, 0, w, h).fill(DIM);
    for (const r of this.holes) g.roundRect(r.x, r.y, r.w, r.h, 30).cut();
  }

  private buildCard(lesson: Lesson, w: number, h: number, wide: boolean): void {
    this.card.removeChildren().forEach((c) => c.destroy({ children: true }));
    const target = lesson.step === 'pick' ? lesson.clear : bounds(lesson.holes.map((r) => grow(r, PAD)));
    const c = lesson.clear;
    // beside the board (or the skill cards) on a wide screen, above or below the target on a tall one
    let cw: number;
    let side: 'left' | 'right' | 'above' | 'below';
    if (wide) {
      const left = c.x;
      const right = w - (c.x + c.w);
      side = lesson.step === 'pick' || target.x + target.w / 2 < c.x + c.w / 2 ? (left >= right ? 'left' : 'right') : right >= left ? 'right' : 'left';
      cw = Math.min(560, (side === 'left' ? left : right) - 50);
    } else {
      cw = Math.min(880, w - 80);
      side = target.y + target.h / 2 > h * 0.45 ? 'above' : 'below';
    }

    const n = TUTORIAL_STEPS.indexOf(lesson.step) + 1;
    const head = ink(t('tutorial.step', { n, total: TUTORIAL_STEPS.length }), 32, { fill: P.inkSoft });
    const body = balanced(t(`tutorial.${lesson.step}`), cw < 500 ? 40 : 46, cw - 130, { fill: LIGHT.edge, lineHeight: cw < 500 ? 54 : 62 });
    const skip = skipButton(() => this.onSkip());
    // the step and the skip button share the top row on a roomy card; a narrow one has skip below
    const roomy = cw >= 600;
    const ch = roomy ? 132 + 22 + body.height + 72 : 76 + head.height + 18 + body.height + 30 + 70 + 56;

    let x: number;
    let y: number;
    if (side === 'above' || side === 'below') {
      x = w / 2;
      // room for the hand between the card and what it points at
      y = side === 'above' ? target.y - (lesson.step === 'pick' ? 30 : 190) - ch / 2 : target.y + target.h + 60 + ch / 2;
      if (lesson.step === 'pick') y = Math.max(y, ch / 2 + 20);
    } else {
      x = side === 'left' ? c.x / 2 : (c.x + c.w + w) / 2;
      y = lesson.step === 'pick' ? h / 2 : target.y + target.h / 2 - (lesson.step === 'merge' ? 260 : 220);
    }
    y = clamp(y, ch / 2 + 20, h - ch / 2 - 20);
    this.card.position.set(x, y);

    if (lesson.step !== 'pick') this.card.addChild(tail(cw, ch, target.x + target.w / 2 - x, target.y + target.h / 2 - y, side));
    this.card.addChild(lightPanel(cw, ch));
    if (roomy) {
      head.anchor.set(0, 0.5);
      head.position.set(-cw / 2 + 74, -ch / 2 + 97);
      skip.position.set(cw / 2 - 74 - 110, -ch / 2 + 97);
      body.position.set(0, -ch / 2 + 132 + 22 + body.height / 2);
    } else {
      head.position.set(0, -ch / 2 + 76 + head.height / 2 - 14);
      body.position.set(0, head.y + head.height / 2 + 18 + body.height / 2);
      skip.position.set(cw / 2 - 150, ch / 2 - 30 - 70 / 2 - 22);
    }
    this.card.addChild(head, body, skip);
    this.card.eventMode = 'passive';
  }

  private animate(lesson: Lesson): void {
    const s = this.time;
    const pulse = 0.5 + 0.5 * Math.sin(s * 5);
    const g = this.rings.clear();
    for (const r of this.holes) {
      g.roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 34).stroke({ width: 10, color: P.brassLight, alpha: 0.35 + 0.55 * pulse });
      g.roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 34).stroke({ width: 3, color: LIGHT.edge, alpha: 0.6 });
    }
    const a = this.arrow.clear();
    this.hand.rotation = Math.PI - 0.35;
    if (lesson.step === 'pick') return;
    if (lesson.to) {
      // the hand drags from one hero to the other along an arc, then lifts and starts again
      const { from, to } = lesson;
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 - 0.25 * Math.hypot(to.x - from.x, to.y - from.y) };
      drawArc(a, from, mid, to);
      const cycle = (s % 1.8) / 1.8;
      const k = clamp((cycle - 0.15) / 0.65, 0, 1);
      const e = k * k * (3 - 2 * k);
      const p = quad(from, mid, to, e);
      this.hand.position.set(p.x, p.y);
      this.hand.alpha = cycle > 0.9 ? 1 - (cycle - 0.9) * 10 : Math.min(1, cycle * 10);
      this.hand.scale.set(cycle < 0.15 ? 1.08 - cycle * 0.5 : 1);
    } else {
      const bob = Math.abs(Math.sin(s * 4)) * 26;
      this.hand.position.set(lesson.from.x + Math.sin(0.35) * bob, lesson.from.y - bob);
      this.hand.alpha = 1;
      this.hand.scale.set(1);
    }
  }
}

/** A gloved hand pointing up, its fingertip at the origin: the index finger out, the other
 *  three curled against the palm, the thumb along the side and a brass cuff. */
function handShape(): Graphics {
  const edge = { width: 6, color: LIGHT.edge, join: 'round' as const };
  const glove = 0xfff6e6;
  const g = new Graphics().roundRect(-44, 78, 104, 116, 40).fill({ color: P.line, alpha: 0.22 });
  g.roundRect(-52, 62, 100, 104, 38).fill(glove).stroke(edge);
  for (const [y, w] of [[60, 34], [86, 34], [112, 30]] as const) g.roundRect(14, y, w, 30, 15).fill(glove).stroke(edge);
  g.roundRect(-80, 90, 52, 32, 16).fill(glove).stroke(edge);
  g.roundRect(-18, 0, 36, 108, 18).fill(glove).stroke(edge);
  g.roundRect(-10, 10, 8, 40, 4).fill({ color: 0xffffff, alpha: 0.8 });
  g.roundRect(-48, 158, 92, 34, 12).fill(P.brass).stroke(edge);
  return g;
}

/** The card's pointer toward the target, on the side facing it, behind the panel. */
function tail(cw: number, ch: number, dx: number, dy: number, side: 'left' | 'right' | 'above' | 'below'): Graphics {
  const g = new Graphics();
  const edge = { width: 5, color: P.line, join: 'round' as const };
  if (side === 'above' || side === 'below') {
    const s = side === 'above' ? 1 : -1;
    const x = clamp(dx, -cw / 2 + 110, cw / 2 - 110);
    const y = (s * ch) / 2 - s * 14;
    g.poly([x - 44, y, x + 44, y, x + clamp(dx - x, -40, 40), y + s * 62]).fill(P.brassDark).stroke(edge);
  } else {
    const s = side === 'left' ? 1 : -1;
    const y = clamp(dy, -ch / 2 + 90, ch / 2 - 90);
    const x = (s * cw) / 2 - s * 14;
    g.poly([x, y - 44, x, y + 44, x + s * 62, y + clamp(dy - y, -40, 40)]).fill(P.brassDark).stroke(edge);
  }
  return g;
}

function skipButton(onTap: () => void): Container {
  const c = new Container();
  const text: Text = fit(ink(`${t('tutorial.skip')} ›`, 36, { fill: LIGHT.edge }), 200);
  text.y = -4;
  c.addChild(lightTile(220, 70), text);
  return tappable(c, onTap);
}

/** The dragging arrow: a brown-edged brass arc with a head at the end. */
function drawArc(g: Graphics, a: { x: number; y: number }, m: { x: number; y: number }, b: { x: number; y: number }): void {
  const end = quad(a, m, b, 0.86);
  for (const [width, color] of [[22, LIGHT.edge], [12, P.brassLight]] as const) {
    g.moveTo(a.x, a.y).quadraticCurveTo(m.x, m.y, end.x, end.y).stroke({ width, color, cap: 'round' });
  }
  const ang = Math.atan2(b.y - end.y, b.x - end.x);
  const tip = { x: end.x + Math.cos(ang) * 34, y: end.y + Math.sin(ang) * 34 };
  const side = (s: number) => ({ x: end.x + Math.cos(ang + s * Math.PI / 2) * 26 - Math.cos(ang) * 8, y: end.y + Math.sin(ang + s * Math.PI / 2) * 26 - Math.sin(ang) * 8 });
  const l = side(1);
  const r = side(-1);
  g.poly([tip.x, tip.y, l.x, l.y, r.x, r.y]).fill(P.brassLight).stroke({ width: 5, color: LIGHT.edge, join: 'round' });
}

function quad(a: { x: number; y: number }, m: { x: number; y: number }, b: { x: number; y: number }, k: number): { x: number; y: number } {
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * m.x + k * k * b.x, y: u * u * a.y + 2 * u * k * m.y + k * k * b.y };
}

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function grow(r: Rect, d: number): Rect {
  return { x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d };
}

function bounds(rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}

/** Cut-outs that touch become one, so the dim never shows through where they overlap. */
function joined(rs: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (const r of rs) {
    const i = out.findIndex((o) => o.x <= r.x + r.w && r.x <= o.x + o.w && o.y <= r.y + r.h && r.y <= o.y + o.h);
    if (i >= 0) out[i] = bounds([out[i], r]);
    else out.push(r);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
