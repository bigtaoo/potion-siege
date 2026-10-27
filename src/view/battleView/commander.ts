// The commander under the wall, as the battle draws it: where it stands and where a tap casts,
// its raise-and-throw, its charge badge, the count over its head, the call to tap at its feet, and its
// flasks in the air.

import type { Graphics } from 'pixi.js';
import { t as tr } from '../../i18n';
import type { Battle } from '../../sim/battle';
import { ticks } from '../../sim/math/fixed';
import { BALANCE, type CommanderSkill } from '../../sim/types';
import { commanderTexture, potionLook, type SpriteLayer } from '../art';
import { aside, drawUpright, isLand } from '../landView';
import { INK } from '../potion';
import { drawHero, heroShadow } from '../shapes';
import { summonCircle } from '../stone';
import { COLORS, label } from '../ui';
import { LIGHT, P } from '../kit/palette';
import { DESIGN_H } from '../viewport';
import { BAR_H, BAR_Y } from './wall';

const C = BALANCE.commander;
/** Where the commander stands: feet on this point, below the wall between the two buttons. On a
 *  field turned on its side the buttons are in the band under it, so it stands in the middle of
 *  the strip behind the wall's health bar, a little below the field's middle, the wall's numbers
 *  over its head. */
const STAND = { x: C.x, feet: C.y };
const LAND_STAND = { x: C.x + 120, feet: (BAR_Y + BAR_H + DESIGN_H) / 2 };
export const CMD_HEIGHT = 180;
/** How far from the commander's middle a tap still casts. */
const CMD_TAP = 120;
/** The charge badge: up by the commander's raised flask (nearer on a turned field, where the
 *  wall's bar is close by). */
const BADGE = { dx: 100, landDx: 82, dy: -CMD_HEIGHT + 30, r: 34 };
/** The call to tap: across the commander's boots, clear of the wall's health bar, no wider
 *  than the gap between the two buttons, or than the strip behind the wall on a turned field. */
const TAP = { dy: -34, maxW: 340, landW: 250 };

/** The view point `dx` right of and `dy` below the commander's feet on the screen. */
export function byCommander(dx: number, dy: number): { x: number; y: number } {
  const s = isLand() ? LAND_STAND : STAND;
  return { ...aside(s.x, s.feet, dx, dy) };
}

/** The commander's middle. */
export const commanderMid = () => byCommander(0, -CMD_HEIGHT / 2);
/** The middle of its charge badge. */
export const badgeAt = () => byCommander(isLand() ? BADGE.landDx : BADGE.dx, BADGE.dy);
/** Where the wall's numbers go on a turned field: over the commander's head and its count. */
export const landNumbersAt = () => byCommander(0, -CMD_HEIGHT - 112);
/** Seconds the commander's raise-and-throw takes. */
const CAST_TIME = 0.5;
/** How high the thrown flask arcs above its straight path. */
const FLASK_ARC = 320;
export const BREW_COLOR = 0xb36bff;
export const BOMB_COLOR = 0xff8a3d;

/** Whether a tap at (x, y) is on the commander or its charge badge. */
export function onCommander(x: number, y: number): boolean {
  const mid = commanderMid();
  const badge = badgeAt();
  return Math.hypot(x - mid.x, y - mid.y) < CMD_TAP || Math.hypot(x - badge.x, y - badge.y) < BADGE.r * 1.8;
}

/** Its two labels go into the view under the wall's numbers. */
export class CommanderArt {
  /** How far it is through the summons that build the next cell, over its head. */
  readonly count = label('', 34, { stroke: { color: P.umber, width: 5 } });
  /** The call to tap once it is charged, at its feet. */
  readonly castTap = label('', 40, { stroke: { color: P.umber, width: 6 } });
  /** The pop as a cell is built, running down. */
  pulse = 0;
  /** The commander's last cast, for the raise-and-throw; a summon gets a smaller nod. */
  cast: { at: number; skill: CommanderSkill } = { at: -99, skill: 'bomb' };
  nod = -99;
  /** The commander's flasks in the air, as the view throws them. */
  thrown: { x: number; y: number; at: number; flight: number }[] = [];
  /** The small words' growth on a small board (see textBoost). */
  private boost = 1;

  /** A new battle: nothing cast, nothing in the air. */
  reset(): void {
    this.pulse = 0;
    this.cast = { at: -99, skill: 'bomb' };
    this.nod = -99;
    this.thrown = [];
  }

  /** Grows the count and the call to tap by `k` for a small board. */
  legible(k: number): void {
    this.boost = k;
    this.count.scale.set(k);
  }

  /** The commander under the wall at `t` seconds into the battle: how far it is through the
   *  summons that build the next cell, its charge, and its raise-and-throw. */
  draw(under: Graphics, over: Graphics, art: SpriteLayer, b: Battle, dt: number, t: number): void {
    this.pulse = Math.max(0, this.pulse - dt * 1.5);
    const full = b.charge >= C.charge;
    const pop = 1 + this.pulse * 0.25;
    const feet = byCommander(0, 0);
    drawUpright(under, feet.x, feet.y, (ox, oy) => summonCircle(under, ox, oy, 124, 30));
    // charged: a golden glow behind it, pulsing, asking for the tap
    if (full) {
      const p = 0.5 + 0.5 * Math.sin(t * 6);
      const glow = byCommander(0, -CMD_HEIGHT * 0.45);
      drawUpright(under, glow.x, glow.y, (ox, oy) => under.ellipse(ox, oy, 95 + p * 14, 125 + p * 14).fill({ color: COLORS.gold, alpha: 0.18 + p * 0.17 }));
    }
    // the bomb: it leans back, then flings forward; the brew: it rises on its toes; a summon or
    // a new cell: a quick nod up
    const c = (t - this.cast.at) / CAST_TIME;
    const n = (t - this.nod) / 0.3;
    let lean = 0;
    let lift = this.pulse * 0.6;
    if (c >= 0 && c < 1) {
      if (this.cast.skill === 'bomb') lean = c < 0.35 ? (-0.18 * c) / 0.35 : 0.22 * Math.sin(((c - 0.35) / 0.65) * Math.PI);
      lift = Math.sin(c * Math.PI);
    } else if (n >= 0 && n < 1) lift = Math.max(lift, Math.sin(n * Math.PI) * 0.35);
    const tex = commanderTexture();
    if (tex) {
      heroShadow(under, feet.x, feet.y, CMD_HEIGHT * 0.6);
      const at = byCommander(0, -lift * 24);
      const s = art.put(tex, at.x, at.y, CMD_HEIGHT * pop * (1 + lift * 0.08));
      s.scale.y *= 1 + Math.sin(t * 2.2) * 0.03 + (full ? Math.abs(Math.sin(t * 6)) * 0.03 : 0);
      s.rotation = lean;
    } else {
      const at = byCommander(0, -CMD_HEIGHT / 2 - lift * 24);
      drawHero(over, 'arcane', at.x, at.y, 80 * pop);
    }
    this.drawCharge(over, b, full, t);
    const k = this.boost;
    const head = byCommander(0, -CMD_HEIGHT - 22);
    this.count.position.set(head.x, head.y);
    // once full, the call to tap across its boots on the skill's colour; the cell count stays
    // over its head
    const tap = full && !b.paused;
    this.castTap.visible = tap;
    if (tap) {
      const words = tr('castTap');
      if (this.castTap.text !== words) this.castTap.text = words;
      const maxW = isLand() ? TAP.landW : TAP.maxW;
      const s = Math.min(k, (maxW - 40 * k) / (this.castTap.width / this.castTap.scale.x));
      this.castTap.scale.set(s);
      const w = this.castTap.width + 40 * k;
      const h = 58 * k;
      const at = byCommander(0, TAP.dy);
      this.castTap.position.set(at.x, at.y);
      const color = b.nextCast === 'bomb' ? BOMB_COLOR : BREW_COLOR;
      drawUpright(over, at.x, at.y, (ox, oy) => over.roundRect(ox - w / 2, oy - h / 2, w, h, h / 2).fill({ color, alpha: 0.95 }).stroke({ width: 4, color: P.umber }));
    }
    const next = b.summonsToNextCell();
    this.count.visible = next !== null;
    if (next === null) return;
    const per = C.summonsPerCell;
    drawUpright(over, head.x, head.y, (ox, oy) => over.roundRect(ox - 56 * k, oy - 22 * k, 112 * k, 44 * k, 22 * k).fill({ color: LIGHT.edge, alpha: 0.85 }));
    this.count.text = tr('commanderNext', { n: per - next, total: per });
  }

  /** The charge badge by the commander's flask: a ring filling with kills around the next skill's
   *  sign; once full, the call to tap, the ring running down to the self-cast. */
  private drawCharge(g: Graphics, b: Battle, full: boolean, t: number): void {
    const { x, y } = badgeAt();
    const bomb = b.nextCast === 'bomb';
    const color = bomb ? BOMB_COLOR : BREW_COLOR;
    const r = BADGE.r * this.boost * (full ? 1 + Math.abs(Math.sin(t * 6)) * 0.12 : 1);
    g.circle(x, y, r + 9).fill({ color: P.umber, alpha: 0.9 });
    g.circle(x, y, r).fill(full ? color : LIGHT.edge);
    const frac = full ? 1 - b.chargedFor / ticks(C.autoCast) : b.charge / C.charge;
    if (frac > 0) {
      const a0 = -Math.PI / 2;
      g.moveTo(x, y - r - 5).arc(x, y, r + 5, a0, a0 + Math.PI * 2 * Math.min(1, frac)).stroke({ width: 7, color: full ? 0xfff3c0 : color, cap: 'round' });
    }
    // the sign: a round flask with a fuse for the bomb, a tall one with bubbles for the brew
    const k = r / 34;
    const ink = full ? 0xfff8e8 : color;
    if (bomb) {
      g.circle(x, y + 5 * k, 13 * k).fill(ink);
      g.rect(x - 4 * k, y - 15 * k, 8 * k, 10 * k).fill(ink);
      g.moveTo(x, y - 15 * k).quadraticCurveTo(x + 8 * k, y - 24 * k, x + 13 * k, y - 18 * k).stroke({ width: 3 * k, color: 0xffe08a });
    } else {
      g.roundRect(x - 8 * k, y - 14 * k, 16 * k, 30 * k, 6 * k).fill(ink);
      g.circle(x - 11 * k, y - 18 * k, 4 * k).fill(ink);
      g.circle(x + 10 * k, y - 22 * k, 3 * k).fill(ink);
    }
  }

  /** The commander's flasks in the air, arcing from its hand onto their mark, spinning. */
  drawThrown(g: Graphics, t: number, shotArt: SpriteLayer): void {
    const look = potionLook('fire');
    const hand = byCommander(40, -CMD_HEIGHT);
    for (const f of this.thrown) {
      const k = Math.min(1, (t - f.at) / f.flight);
      // the arc rises up the screen, whichever way the field lies
      const { x, y } = aside(hand.x + (f.x - hand.x) * k, hand.y + (f.y - hand.y) * k, 0, -FLASK_ARC * 4 * k * (1 - k));
      for (let i = 3; i >= 1; i--) {
        const trail = aside(x, y, 0, i * 18);
        g.circle(trail.x, trail.y, 18 - i * 3).fill({ color: BOMB_COLOR, alpha: 0.25 * (4 - i) });
      }
      if (look) {
        const s = shotArt.put(look.body, x, y, 76);
        s.anchor.set(0.5);
        s.rotation = t * 12;
      } else g.circle(x, y, 22).fill(BOMB_COLOR).stroke({ width: 4, color: INK });
    }
  }
}
