// The guide's hand (view/home/guideMark.ts) on every button of every home tab and of the panels the
// guide opens, on screens from a small phone to an ultrawide desktop: the hand stays on the page
// wherever the button is.
import "../view/layout/measure";
import type { Container } from "pixi.js";
import { beforeAll, describe, expect, it } from "vitest";
import { gameDay } from "../sim/daily";
import { newMeta } from "../sim/meta";
import { guideMark } from "../view/home/guideMark";
import { boxIn } from "../view/home/hintPlace";
import { HOME_TABS, type HomePanel, type HomeTab } from "../view/home/types";
import { liveWorld } from "./flowHelpers";
import { home } from "./homeScreen";
import { englishPage } from "./testWorld";

beforeAll(englishPage);

const SIZES = [
  [360, 640],
  [390, 844],
  [619, 846],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1920, 1080],
  [2560, 1080],
];

/** Each tab with no panel, then the panels the guide points into, over the battle tab. */
const SCREENS: [HomeTab, HomePanel][] = [
  ...HOME_TABS.map((tab): [HomeTab, HomePanel] => [tab, null]),
  ...(["welcome", "login", "tasks", "chapters", "settings"] as const).map(
    (p): [HomeTab, HomePanel] => ["battle", p],
  ),
];

/** How far a hand may reach past the page's edge and still read whole. */
const SLACK = 30;

describe("the guide hand on every home button", () => {
  it("stays on the page on every screen", () => {
    const m = newMeta();
    Object.assign(m, {
      runs: 3,
      tutorial: true,
      cleared: 3,
      stage: 4,
      crystals: 500,
    });
    m.daily.lastClaim = gameDay(m, new Date());
    // a gift left, so the top bar has its welcome button too (the one at its far right)
    m.welcome.gifts = 1;
    const off: string[] = [];
    const seen = new Set<string>();
    for (const [width, height] of SIZES) {
      const w = liveWorld(m, "", { width, height });
      w.frame();
      for (const [tab, panel] of SCREENS) {
        w.game["tab"] = tab;
        home(w.game, panel);
        const fit = w.game.menuFit!;
        const root: Container = w.game["menu"].children[0];
        // what is on the page before any mark goes on it
        const old = root.getChildByLabel("guideMark", true);
        old?.parent?.removeChild(old);
        const buttons: Container[] = [];
        const walk = (c: Container) => {
          if (!c.visible) return;
          if (c.eventMode === "static" && c.label) {
            const b = boxIn(root, c);
            if (
              b.w * b.h < fit.w * fit.h * 0.5 &&
              b.x >= 0 &&
              b.y >= 0 &&
              b.x + b.w <= fit.w &&
              b.y + b.h <= fit.h
            )
              buttons.push(c);
          }
          c.children.forEach((k) => walk(k as Container));
        };
        walk(root);
        for (const target of buttons) {
          seen.add(`${panel ?? tab}:${target.label}`);
          guideMark(root, target, null, true, fit, null, panel !== null);
          const mark = root.getChildByLabel("guideMark")!;
          const hand = boxIn(root, mark.getChildByLabel("hintHand")!);
          if (
            hand.x < -SLACK ||
            hand.y < -SLACK ||
            hand.x + hand.w > fit.w + SLACK ||
            hand.y + hand.h > fit.h + SLACK
          ) {
            off.push(
              `${width}x${height} ${panel ?? tab} ${target.label} hand ${[hand.x, hand.y, hand.w, hand.h].map(Math.round).join(",")} page ${Math.round(fit.w)}x${Math.round(fit.h)}`,
            );
          }
          root.removeChild(mark);
          mark.destroy({ children: true });
        }
      }
    }
    expect(off).toEqual([]);
    expect([...seen]).toEqual(
      expect.arrayContaining([
        "battle:top_welcome",
        "battle:start",
        "shop:tab_shop",
        "welcome:claim_welcome",
        "tasks:panel_close",
      ]),
    );
  });
});
