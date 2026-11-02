// On a wide screen the battle board leaves columns either side; these boards fill them with
// what a desktop player can use: the skills taken and each potion's damage on the left, the
// waves still to come on the right.

import { Container } from 'pixi.js';
import type { Battle } from '../sim/battle';
import { SKILL_IDS } from '../sim/skills';
import type { HeroKind } from '../sim/types';
import { refresh, skillsBoard, type Live } from './sideSkills';
import { wavesBoard } from './sideWaves';
import type { MenuFit } from './viewport';

/** The narrowest column the boards are shown in, in page units. */
const MIN_COLUMN = 400;
const MAX_W = 560;
/** How often the damage shares are redrawn while they change, in seconds. */
const REFRESH = 0.25;

/** The left board's look while it has nothing to show yet. */
const EMPTY_ALPHA = 0.6;

/** Whether the columns beside a board starting at `boardX` (page units) are wide enough for the boards. */
export function hasColumns(boardX: number): boolean {
  return Math.min(MAX_W, boardX - 64) >= MIN_COLUMN - 64;
}

export class SideInfo extends Container {
  private readonly left = new Container();
  private readonly right = new Container();
  private battle: Battle | null = null;
  /** The layout, wave and skills taken: a change rebuilds both boards. */
  private key = '';
  /** The skill levels and damage shares last drawn. */
  private shown = '';
  private levels = '';
  private wait = 0;
  private live: Live | null = null;
  /** The lineup by damage, reused for every redraw. */
  private readonly order: HeroKind[] = [];

  constructor() {
    super();
    this.addChild(this.left, this.right);
  }

  /** `boardX` is where the board starts, in page units; the columns are either side of it. */
  update(b: Battle | null, boardX: number, m: MenuFit, show: boolean, dt: number): void {
    const pw = Math.min(MAX_W, boardX - 64);
    this.visible = show && !!b && hasColumns(boardX);
    if (!this.visible || !b) {
      this.key = '';
      return;
    }
    this.scale.set(m.scale);
    // the left board steps back until it has something to show: a skill taken or any damage done
    const empty = SKILL_IDS.every((id) => !(b.skills[id] > 0)) && Object.values(b.dealt).every((d) => d === 0);
    this.left.alpha = empty ? EMPTY_ALPHA : 1;
    this.wait -= dt;
    // a new layout, wave or skill at once; a new level at once, without a rebuild; the damage
    // shares at most every REFRESH
    const key = this.keyOf(b, boardX, m);
    const levels = SKILL_IDS.map((id) => b.skills[id]).join('');
    const shown = `${levels}|${this.shares(b)}`;
    if (key !== this.key || b !== this.battle) {
      this.key = key;
      this.battle = b;
      // room above for the name plate that sits on the top edge
      const ph = Math.min(m.h - 150, 1500);
      const left = skillsBoard(b, pw, ph);
      this.live = left.live;
      this.rebuild(this.left, left.board, boardX / 2, m.h / 2 + 30);
      this.rebuild(this.right, wavesBoard(b, pw, ph), m.w - boardX / 2, m.h / 2 + 30);
    } else if (shown === this.shown || (levels === this.levels && this.wait > 0)) {
      return;
    }
    this.shown = shown;
    this.levels = levels;
    this.wait = REFRESH;
    if (this.live) refresh(b, this.live, this.order);
  }

  /** The layout, the wave and which skills are taken. */
  private keyOf(b: Battle, boardX: number, m: MenuFit): string {
    const taken = SKILL_IDS.map((id) => (b.skills[id] > 0 ? 1 : 0)).join('');
    return `${Math.round(boardX)}x${Math.round(m.w)}x${Math.round(m.h)}:${b.wave}:${taken}:${b.setup.lineup.join(',')}`;
  }

  /** Each potion's share of the damage, in whole percent. */
  private shares(b: Battle): string {
    const total = Object.values(b.dealt).reduce((a, d) => a + d, 0) || 1;
    return b.setup.lineup.map((k) => Math.round((100 * b.dealt[k]) / total)).join(',');
  }

  private rebuild(side: Container, board: Container, x: number, y: number): void {
    side.removeChildren().forEach((c) => c.destroy({ children: true }));
    side.position.set(x, y);
    side.addChild(board);
  }
}
