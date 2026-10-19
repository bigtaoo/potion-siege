// The achievements list: its order, a drag that scrolls it (and keeps the tap off the rows), the
// scroll kept over the rebuild a claim brings, and the rows sliding to their new places.
import '../layout/measure';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Container, Text, type Rectangle } from 'pixi.js';
import { t } from '../../i18n';
import { claimTier, nextTier, TRACK_IDS, TRACKS, trackProgress, trackReady, type TrackId } from '../../sim/achievements';
import { newMeta, type MetaSave } from '../../sim/meta';
import { PillButton } from '../kit';
import { buildCodex, scrollFeats, setCodexPage } from '.';
import { featOrder } from './achievements';

const AREA = { x: 0, y: 150, w: 1080, h: 1978, wide: false };

/** Two tiers to claim (stages, kills), two tracks done (login, workshop), the rest under way. */
function meta(): MetaSave {
  const m = newMeta();
  m.cleared = 1;
  m.runs = 9;
  m.achievements.stats.kills = 1500;
  m.achievements.stats.merges = 60;
  m.achievements.claimed.login = TRACKS.login.length;
  m.achievements.claimed.workshop = TRACKS.workshop.length;
  return m;
}

function find<T extends Container>(c: Container, is: (n: Container) => n is T): T[] {
  const out: T[] = [];
  const walk = (n: Container): void => {
    if (is(n)) out.push(n);
    for (const k of n.children) walk(k);
  };
  walk(c);
  return out;
}

/** The list's window, and its rows by track. */
function list(root: Container): { view: Container; content: Container; rows: Map<TrackId, Container> } {
  const view = find(root, (n): n is Container => n.mask instanceof Container)[0];
  const content = view.children[0];
  const rows = new Map<TrackId, Container>();
  for (const r of content.children) {
    const names = find(r, (n): n is Text => n instanceof Text).map((x) => x.text);
    rows.set(TRACK_IDS.find((id) => names.includes(t(`ach.${id}.name`)))!, r);
  }
  return { view, content, rows };
}

const at = (y: number) => ({ global: { x: 300, y }, stopPropagation() {} }) as never;

function build(m: MetaSave, claim: (id: TrackId, b: Container) => void = () => {}): Container {
  return buildCodex(m, AREA, claim, () => {});
}

afterEach(() => {
  setCodexPage('potions');
  scrollFeats();
  vi.restoreAllMocks();
});

describe('achievements list', () => {
  it('puts the tiers to claim first, the finished tracks last, the rest by how close', () => {
    const m = meta();
    const order = featOrder(m);
    expect(order.slice(0, 2)).toEqual(['stages', 'kills']);
    expect(order.slice(-2)).toEqual(['login', 'workshop']);
    const near = (id: TrackId) => {
      const tier = nextTier(m, id)!;
      return Math.min(1, trackProgress(m, id, tier) / TRACKS[id][tier].goal);
    };
    const going = order.slice(2, -2);
    expect(going.every((id) => !trackReady(m, id) && nextTier(m, id) !== null)).toBe(true);
    for (let i = 1; i < going.length; i++) {
      const [a, b] = [going[i - 1], going[i]];
      expect(near(a) > near(b) || (near(a) === near(b) && TRACK_IDS.indexOf(a) < TRACK_IDS.indexOf(b))).toBe(true);
    }
  });

  it('draws the rows in that order, the finished ones dimmed and without a button', () => {
    setCodexPage('feats');
    const m = meta();
    const { rows } = list(build(m));
    const drawn = [...rows.entries()].sort((a, b) => a[1].y - b[1].y).map(([id]) => id);
    expect(drawn).toEqual(featOrder(m));
    for (const id of ['login', 'workshop'] as const) {
      expect(rows.get(id)!.alpha).toBeLessThan(1);
      expect(find(rows.get(id)!, (n): n is PillButton => n instanceof PillButton)).toHaveLength(0);
    }
  });

  it('scrolls on a drag, keeps the tap off the rows meanwhile, and keeps the place over a rebuild', async () => {
    setCodexPage('feats');
    const m = meta();
    const { view, content } = list(build(m));
    view.emit('pointerdown', at(1200));
    view.emit('globalpointermove', at(1195));
    // a few px is still a tap (true in the browser; node runs without pixi's event mixin)
    expect(content.interactiveChildren).not.toBe(false);
    view.emit('globalpointermove', at(900));
    expect(content.interactiveChildren).toBe(false);
    expect(content.y).toBe(-300);
    view.emit('pointerup', at(900));
    await Promise.resolve();
    expect(content.interactiveChildren).toBe(true);
    expect(list(build(m)).content.y).toBe(-300);
  });

  it('holds the list inside its ends', () => {
    setCodexPage('feats');
    scrollFeats(1e6);
    const { view, content } = list(build(meta()));
    const end = content.y;
    expect(end).toBeLessThan(0);
    // the last row's foot is in the window
    const last = content.children[content.children.length - 1];
    expect(last.y + 200 / 2 + end).toBeCloseTo((view.hitArea as Rectangle).height - 8, 0);
    view.emit('pointerdown', at(500));
    view.emit('globalpointermove', at(100));
    expect(content.y).toBe(end);
  });

  it('slides the rows from where they were to their new places after a claim, from the tapped button', () => {
    setCodexPage('feats');
    const m = meta();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    let tapped: Container | null = null;
    let rebuilt: Container | null = null;
    const claim = (id: TrackId, b: Container) => {
      tapped = b;
      claimTier(m, id);
      rebuilt = build(m, claim);
    };
    const before = list(build(m, claim));
    const stagesY = before.rows.get('stages')!.y;
    const button = find(before.rows.get('stages')!, (n): n is PillButton => n instanceof PillButton)[0];
    now += 100;
    button.emit('pointertap', at(0));
    expect(tapped).toBe(button);
    const after = list(rebuilt!);
    // stages has its next tier far off now: it starts where it was and slides down below kills
    const row = after.rows.get('stages')!;
    expect(row.y).toBe(stagesY);
    now += 1000;
    after.content.onRender!(null as never);
    expect(row.y).toBeGreaterThan(after.rows.get('kills')!.y);
    expect(after.content.onRender).toBeFalsy();
    // a rebuild that no claim brought draws the rows in place at once
    const still = list(build(m));
    expect(still.content.onRender).toBeFalsy();
  });
});
