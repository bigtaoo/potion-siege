import '../layout/measure';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { englishPage } from '../../game/testWorld';
import { newMeta } from '../../sim/meta';
import { chaptersPanel, scrollChapters } from './chaptersPanel';
import { loggedActions, PHONE } from './homeTestBits';

beforeAll(englishPage);
beforeEach(scrollChapters);

/** A wide page, too short for all five chapters at full size. */
const SHORT = { scale: 1, w: 1920, h: 1080, wide: true };

/** The list's window and what scrolls in it: the window is the box's child with a mask. */
function list(panel: Container): { view: Container; content: Container } {
  const box = panel.children[1] as Container;
  const view = box.children.find((c) => c.mask) as Container;
  return { view, content: view.children[0] as Container };
}

describe('the chapters panel', () => {
  it('shows every chapter whole on a tall phone, nothing to scroll', () => {
    const panel = chaptersPanel(newMeta(), loggedActions().act, PHONE);
    const { content } = list(panel);
    expect((panel.children[1] as Container).scale.x).toBe(1);
    expect(content.y).toBe(0);
  });

  it('keeps full size on a short page and scrolls the rows instead of shrinking them', () => {
    // four chapters open: too tall for the page
    const m = newMeta();
    m.cleared = 30;
    m.stage = 1;
    const panel = chaptersPanel(m, loggedActions().act, SHORT);
    expect((panel.children[1] as Container).scale.x).toBe(1);
    const { view, content } = list(panel);
    const start = content.y;
    view.emit('wheel', { deltaY: 200 } as never);
    expect(content.y).toBe(start - 200);
  });

  it('keeps a chapter not open yet to a short row: its name and what opens it', () => {
    const { content } = list(chaptersPanel(newMeta(), loggedActions().act, PHONE));
    const [open, locked, next] = content.children as Container[];
    expect(open.height).toBeGreaterThan(locked.height + 100);
    expect(next.y - locked.y).toBeLessThan(locked.y - open.y);
  });

  it('marks the chapter chest button with a chest and the star chests one with a star', () => {
    const m = newMeta();
    m.cleared = 10;
    for (let s = 1; s <= 10; s++) m.stars.normal[s - 1] = 3;
    const panel = chaptersPanel(m, loggedActions().act, PHONE);
    for (const id of ['chapter_chest', 'star_chest']) {
      const b = panel.getChildByLabel(id, true) as Container;
      // the pill, its caption and the icon in front
      expect(b.children).toHaveLength(3);
      expect(b.children[2].x).toBeLessThan(b.children[1].x);
    }
  });

  it("opens at the chosen stage's chapter and keeps its place over a rebuild", () => {
    const m = newMeta();
    m.cleared = 30;
    m.stage = 31;
    m.chapterChests = [1, 2, 3];
    const { act } = loggedActions();
    const first = list(chaptersPanel(m, act, SHORT));
    const opened = -first.content.y;
    expect(opened).toBeGreaterThan(0);
    first.view.emit('wheel', { deltaY: -100 } as never);
    expect(-list(chaptersPanel(m, act, SHORT)).content.y).toBe(opened - 100);
    scrollChapters();
    expect(-list(chaptersPanel(m, act, SHORT)).content.y).toBe(opened);
  });

  it("opens at the first chapter with a chest waiting, ahead of the chosen stage's", () => {
    const m = newMeta();
    m.cleared = 30;
    m.stage = 31;
    m.chapterChests = [1];
    // chapter 2's row: one row and its gap down
    expect(-list(chaptersPanel(m, loggedActions().act, SHORT)).content.y).toBe(300 + 18);
  });
});
