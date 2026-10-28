import '../layout/measure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { t } from '../../i18n';
import { fillColors, picture } from '../kit/kitTestBits';
import { CARD_NUDGE, CardNudge, nudgeOn, tapPose, topTag } from './cardNudge';

const art = vi.hoisted(() => ({ hand: undefined as Texture | undefined }));
vi.mock('../art', async (orig) => ({ ...(await orig<typeof import('../art')>()), handTexture: () => art.hand }));

describe('skill card nudge', () => {
  it('shows the hand only after the cards were left alone, never once touched', () => {
    expect(nudgeOn(CARD_NUDGE.after - 0.1, false)).toBe(false);
    expect(nudgeOn(CARD_NUDGE.after, false)).toBe(true);
    expect(nudgeOn(CARD_NUDGE.after + 30, true)).toBe(false);
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

  it('stays hidden until the cards were left alone, then taps them', () => {
    const n = new CardNudge(120, 340);
    expect([n.x, n.y, n.visible, n.eventMode]).toEqual([120, 340, false, 'none']);
    n.update(CARD_NUDGE.after - 0.5);
    expect(n.visible).toBe(false);
    n.update(0.5);
    expect(n.visible).toBe(true);
    expect(hand(n).y).toBe(80);
    expect(ring(n).context.instructions).toHaveLength(0);
    n.update(CARD_NUDGE.beat * 0.5);
    expect(hand(n).y).toBe(20);
    expect(ring(n).context.instructions.length).toBeGreaterThan(0);
    n.destroy();
  });

  it('goes for good at the first touch or key, and stops listening once destroyed', () => {
    for (const type of ['pointerdown', 'pointermove', 'keydown']) {
      const n = new CardNudge(0, 0);
      win.dispatchEvent(new Event(type));
      n.update(CARD_NUDGE.after + 1);
      expect(n.visible).toBe(false);
      n.destroy();
    }
    const spy = vi.spyOn(win, 'removeEventListener');
    new CardNudge(0, 0).destroy();
    expect(spy).toHaveBeenCalledTimes(3);
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
