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
    const panel = chaptersPanel(newMeta(), loggedActions().act, SHORT);
    expect((panel.children[1] as Container).scale.x).toBe(1);
    const { view, content } = list(panel);
    const start = content.y;
    view.emit('wheel', { deltaY: 400 } as never);
    expect(content.y).toBe(start - 400);
  });

  it("opens at the chosen stage's chapter and keeps its place over a rebuild", () => {
    const m = newMeta();
    m.cleared = 30;
    m.stage = 31;
    const { act } = loggedActions();
    const first = list(chaptersPanel(m, act, SHORT));
    const opened = -first.content.y;
    expect(opened).toBeGreaterThan(0);
    first.view.emit('wheel', { deltaY: -100 } as never);
    expect(-list(chaptersPanel(m, act, SHORT)).content.y).toBe(opened - 100);
    scrollChapters();
    expect(-list(chaptersPanel(m, act, SHORT)).content.y).toBe(opened);
  });
});
