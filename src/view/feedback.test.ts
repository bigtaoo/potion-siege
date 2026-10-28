import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_MAX, FEEDBACK_RUN, FeedbackAsk } from './feedback';
import { FakeDoc, type FakeEl } from './feedbackDom';

type Sent = [string, Record<string, string | number>];

function open(run = FEEDBACK_RUN) {
  const doc = new FakeDoc();
  const sent: Sent[] = [];
  const ask = new FeedbackAsk((name, props) => void sent.push([name, props]), run, doc.asDocument());
  const strip = () => doc.body.children[0] as FakeEl | undefined;
  const stars = () => strip()!.all().filter((e) => e.classList.contains('ps-fb-star'));
  const tap = (e: FakeEl | undefined) => e!.onclick!();
  return { doc, sent, ask, strip, stars, tap };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the feedback question', () => {
  it('asks after the third finished run', () => {
    expect(FEEDBACK_RUN).toBe(3);
  });

  it('puts one strip on the page with the question, a skip button and five unlit stars', () => {
    const { doc, strip, stars } = open();
    expect(doc.body.children).toHaveLength(1);
    expect(strip()!.className).toBe('ps-fb');
    expect(strip()!.getAttribute('role')).toBe('dialog');
    expect(strip()!.find('ps-fb-ask')!.textContent).toBe('Enjoying Potion Siege so far?');
    expect(strip()!.find('ps-fb-x')!.textContent).toBe('Not now ✕');
    expect(stars().map((s) => s.getAttribute('aria-label'))).toEqual(['1/5', '2/5', '3/5', '4/5', '5/5']);
    expect(stars().some((s) => s.classList.contains('on'))).toBe(false);
    expect(strip()!.all().some((e) => e.tagName === 'textarea')).toBe(false);
  });

  it('adds its style sheet once, however many times it asks', () => {
    const doc = new FakeDoc();
    new FeedbackAsk(() => {}, 3, doc.asDocument());
    new FeedbackAsk(() => {}, 4, doc.asDocument());
    expect(doc.head.children).toHaveLength(1);
    expect((doc.head.children[0] as FakeEl).id).toBe('ps-fb-css');
    expect((doc.head.children[0] as FakeEl).textContent).toContain('.ps-fb{');
  });

  it('keeps taps on the strip from reaching the canvas', () => {
    const { strip } = open();
    const stop = vi.fn();
    for (const fn of strip()!.listeners.get('pointerdown')!) fn({ stopPropagation: stop });
    expect(stop).toHaveBeenCalledOnce();
  });

  it('lights the stars up to the one tapped, and swaps the question for them with a text line', () => {
    const { strip, stars, tap, sent } = open();
    tap(stars()[3]);
    expect(stars().map((s) => s.classList.contains('on'))).toEqual([true, true, true, true, false]);
    const head = strip()!.children[0] as FakeEl;
    expect(head.find('ps-fb-ask')).toBeUndefined();
    expect(head.find('ps-fb-stars')).toBeDefined();
    const text = strip()!.all().find((e) => e.tagName === 'textarea')!;
    expect(text.maxLength).toBe(FEEDBACK_MAX);
    expect(text.placeholder).toBe('Anything to tell us? (optional)');
    expect(strip()!.find('ps-fb-send')!.textContent).toBe('Send');
    expect(sent).toEqual([]);
  });

  it('changes the rating on a second tap without adding a second text line', () => {
    const { strip, stars, tap, sent } = open();
    tap(stars()[4]);
    tap(stars()[1]);
    expect(stars().map((s) => s.classList.contains('on'))).toEqual([true, true, false, false, false]);
    expect(strip()!.all().filter((e) => e.tagName === 'textarea')).toHaveLength(1);
    tap(strip()!.find('ps-fb-send'));
    expect(sent).toEqual([['feedback', { rating: 2, text: '', run: 3 }]]);
  });

  it('sends the rating with the text trimmed and cut to length, thanks the player, then goes', () => {
    const { doc, strip, stars, tap, sent } = open(5);
    tap(stars()[2]);
    strip()!.all().find((e) => e.tagName === 'textarea')!.value = `  ${'a'.repeat(FEEDBACK_MAX + 20)}  `;
    tap(strip()!.find('ps-fb-send'));
    expect(sent).toEqual([['feedback', { rating: 3, text: 'a'.repeat(FEEDBACK_MAX), run: 5 }]]);
    expect(strip()!.text()).toBe('Thank you!');
    vi.advanceTimersByTime(1499);
    expect(doc.body.children).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(doc.body.children).toHaveLength(0);
  });

  it('sends only once, whatever is tapped or closed after', () => {
    const { ask, stars, strip, tap, sent } = open();
    tap(stars()[0]);
    const send = strip()!.find('ps-fb-send');
    tap(send);
    tap(send);
    ask.close('left');
    expect(sent.map(([n]) => n)).toEqual(['feedback']);
  });

  it('counts the skip button as a skip, and takes the strip away at once', () => {
    const { doc, strip, tap, sent } = open();
    tap(strip()!.find('ps-fb-x'));
    expect(sent).toEqual([['feedback_skip', { how: 'closed', run: 3 }]]);
    expect(doc.body.children).toHaveLength(0);
  });

  it('counts leaving the result screen unanswered as a skip, once', () => {
    const { doc, ask, sent } = open(4);
    ask.close('left');
    ask.close('closed');
    expect(sent).toEqual([['feedback_skip', { how: 'left', run: 4 }]]);
    expect(doc.body.children).toHaveLength(0);
  });

  it('still sends a rating already tapped when the player leaves, with what text there is', () => {
    const { doc, ask, stars, strip, tap, sent } = open();
    tap(stars()[4]);
    strip()!.all().find((e) => e.tagName === 'textarea')!.value = ' great ';
    ask.close('left');
    expect(sent).toEqual([['feedback', { rating: 5, text: 'great', run: 3 }]]);
    expect(doc.body.children).toHaveLength(0);
    vi.runAllTimers();
    expect(doc.body.children).toHaveLength(0);
  });
});
