import '../layout/measure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { t } from '../../i18n';
import { fillColors, picture } from '../kit/kitTestBits';
import { Overlay } from '../Overlay';
import { PillButton } from '../kit';
import { CARD_NUDGE, CardNudge, nudgeOn, tapPose, topTag } from './cardNudge';

const art = vi.hoisted(() => ({ hand: undefined as Texture | undefined }));
vi.mock('../art', async (orig) => ({ ...(await orig<typeof import('../art')>()), handTexture: () => art.hand }));

describe('skill card nudge', () => {
  it('shows the hand once the cards are open and while they are let alone', () => {
    expect(nudgeOn(CARD_NUDGE.after - 0.1, Infinity)).toBe(false);
    expect(nudgeOn(CARD_NUDGE.after, Infinity)).toBe(true);
    expect(CARD_NUDGE.after).toBeLessThan(1);
    expect(nudgeOn(5, CARD_NUDGE.rest - 0.1)).toBe(false);
    expect(nudgeOn(5, CARD_NUDGE.rest)).toBe(true);
  });

  it('taps down onto the card, rests, lifts, and repeats every beat', () => {
    expect(tapPose(0).lift).toBe(1);
    expect(tapPose(CARD_NUDGE.beat * 0.4)).toEqual({ lift: 0, ripple: expect.any(Number) });
    expect(tapPose(CARD_NUDGE.beat * 0.4).ripple).toBeGreaterThan(0);
    expect(tapPose(0).ripple).toBe(0);
    expect(tapPose(CARD_NUDGE.beat * 2.4)).toEqual(tapPose(CARD_NUDGE.beat * 0.4));
  });
});

describe('CardNudge', () => {
  let win: EventTarget;
  beforeEach(() => {
    win = new EventTarget();
    vi.stubGlobal('window', win);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    art.hand = undefined;
  });
  const ring = (n: CardNudge) => n.children[0] as Graphics;
  const hand = (n: CardNudge) => n.children[1] as Container;

  it('stays hidden while the cards fan out, then taps them', () => {
    const n = new CardNudge(120, 340);
    expect([n.x, n.y, n.visible, n.eventMode]).toEqual([120, 340, false, 'none']);
    n.update(CARD_NUDGE.after - 0.2);
    expect(n.visible).toBe(false);
    n.update(0.2);
    expect(n.visible).toBe(true);
    expect(hand(n).y).toBe(80);
    expect(ring(n).context.instructions).toHaveLength(0);
    n.update(CARD_NUDGE.beat * 0.5);
    expect(hand(n).y).toBe(20);
    expect(ring(n).context.instructions.length).toBeGreaterThan(0);
    n.destroy();
  });

  it('goes at a touch, drag or key and comes back a second after it', () => {
    const drag = Object.assign(new Event('pointermove'), { buttons: 1 });
    for (const ev of [new Event('pointerup'), drag, new Event('keydown')]) {
      const n = new CardNudge(0, 0);
      n.update(CARD_NUDGE.after + 1);
      win.dispatchEvent(ev);
      n.update(CARD_NUDGE.rest - 0.2);
      expect(n.visible).toBe(false);
      n.update(0.2);
      expect(n.visible).toBe(true);
      n.destroy();
    }
  });

  it('stays away for as long as a press lasts', () => {
    const n = new CardNudge(0, 0);
    n.update(CARD_NUDGE.after);
    win.dispatchEvent(new Event('pointerdown'));
    n.update(5);
    expect(n.visible).toBe(false);
    win.dispatchEvent(new Event('pointercancel'));
    n.update(CARD_NUDGE.rest);
    expect(n.visible).toBe(true);
    n.destroy();
  });

  it('pays no heed to a mouse only passing over the cards, and stops listening once destroyed', () => {
    const n = new CardNudge(0, 0);
    n.update(CARD_NUDGE.after - 0.2);
    win.dispatchEvent(Object.assign(new Event('pointermove'), { buttons: 0 }));
    n.update(0.2);
    expect(n.visible).toBe(true);
    n.destroy();
    const spy = vi.spyOn(win, 'removeEventListener');
    new CardNudge(0, 0).destroy();
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('swaps the drawn glove for the painted one once its art is in', () => {
    const n = new CardNudge(0, 0);
    n.update(CARD_NUDGE.after);
    expect(hand(n).children[0]).not.toBeInstanceOf(Sprite);
    art.hand = picture(300, 420);
    n.update(0.1);
    const painted = hand(n).children[0];
    expect(painted).toBeInstanceOf(Sprite);
    n.update(0.1);
    expect(hand(n).children[0]).toBe(painted);
    expect(hand(n).children).toHaveLength(1);
    n.destroy();
  });
});

describe('topTag', () => {
  it('is a green tag round its word that lets taps through', () => {
    const tag = topTag();
    expect(tag.eventMode).toBe('none');
    expect(fillColors(tag.children[0] as Graphics)).toEqual([0x4cc35a]);
    expect((tag.children[1] as Text).text).toBe(t('topPick'));
    expect(tag.children[0].width).toBeGreaterThanOrEqual(150);
  });
});

describe("the result's way on", () => {
  beforeEach(() => vi.stubGlobal('window', new EventTarget()));
  afterEach(() => vi.unstubAllGlobals());

  /** A won result, the hand asked for or not, and with 下一关 or Continue alone. */
  function result(pointOn: boolean, next: boolean): { nudge: CardNudge | undefined; main: Container } {
    const o = new Overlay();
    o.layout(1080, 1920);
    o.showEnd(true, 'stats', { crystals: 10, firstClear: false, unlocked: [] }, () => {}, null, {
      onDouble: null,
      doubled: false,
      dealt: [],
      onTip: null,
      onNext: next ? () => {} : null,
      pointOn,
    });
    const box = o.children[1] as Container;
    const nudge = box.children.find((c) => c instanceof CardNudge) as CardNudge | undefined;
    const want = t(next ? 'nextStage' : 'continue');
    const all = (c: Container): Container[] => [c, ...c.children.flatMap((k) => all(k as Container))];
    const main = all(box).find((c) => c instanceof PillButton && all(c).some((k) => k instanceof Text && k.text === want))!;
    return { nudge, main };
  }

  it("taps the big button of a new player's win, 下一关 or else Continue, and nothing otherwise", () => {
    for (const next of [true, false]) {
      const { nudge, main } = result(true, next);
      expect(nudge).toBeDefined();
      const at = main.parent!.position;
      expect(nudge!.x).toBeCloseTo(at.x + main.x);
      expect(nudge!.y).toBeCloseTo(at.y + main.y + 10);
    }
    expect(result(false, false).nudge).toBeUndefined();
  });

  it("taps the tip a lost battle singles out, and Continue when none is", () => {
    for (const ready of ['workshop', null] as const) {
      const o = new Overlay();
      o.layout(1080, 1920);
      o.showEnd(false, 'stats', { crystals: 10, firstClear: false, unlocked: [] }, () => {}, null, {
        onDouble: null,
        doubled: false,
        dealt: [],
        onTip: () => {},
        tipTabs: ['workshop', 'potions'],
        ready,
        onNext: null,
        pointOn: true,
      });
      const box = o.children[1] as Container;
      const nudge = box.children.find((c) => c instanceof CardNudge) as CardNudge;
      expect(nudge).toBeDefined();
      const all = (c: Container): Container[] => [c, ...c.children.flatMap((k) => all(k as Container))];
      const word = (s: string) => all(box).find((c) => c instanceof Text && c.text === s)!;
      const row = ready ? word(t('tip.workshop.name')).parent! : word(t('continue')).parent!;
      const at = row.parent!.position;
      if (ready) expect(nudge.y).toBeCloseTo(at.y + row.y + 10);
      else expect(nudge.y).toBeGreaterThan(word(t('tip.potions.name')).parent!.parent!.y);
    }
  });
});
