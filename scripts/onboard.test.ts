// `npm run onboard`: the first three battles as a new player who only does what the game points
// at. A fresh save plays battle 1 (the tutorial), then 2 and 3 from the home screen, on the real
// Game frame by frame at 30 fps. Each frame asks two things: could the player do something now (a
// summon, a 强化, a pair to fuse, a skill card to pick, a full commander charge), and does the
// game point at something (the tutorial's lesson, the HUD's hand or pulse, the card nudge, the
// full charge's glowing badge). The fake player does what is
// pointed at REACT seconds after it shows. Per battle it prints the seconds with something to do
// and nothing pointed at, the longest such stretch and how many there were (and how many of them
// began on the frame after one of the player's own moves: NextMove's EARLY.rest), against the targets
// (docs/onboarding-plan.md): under 10 s a battle, none longer than 1.5 s. A report only: it fails
// on nothing.
import '../src/view/layout/measure';
import { beforeAll, it, vi } from 'vitest';
import type { Game } from '../src/app';
import { englishPage, play, world, type World } from '../src/game/testWorld';
import type { Battle } from '../src/sim/battle';
import { newMeta, type MetaSave } from '../src/sim/meta';
import { mergeablePair } from '../src/sim/tutorial';

const FRAME = 1 / 30;
/** Seconds from a pointer showing to the fake player doing it. */
const REACT = 0.5;
const TARGET = { total: 10, longest: 1.5 };

type Move = 'summon' | 'upgrade' | 'pick' | 'cast' | [number, number];

beforeAll(async () => {
  vi.stubGlobal('window', new EventTarget());
  await englishPage();
});

const hud = (g: Game) => g.hud as unknown as Record<string, { visible: boolean; x: number }>;

/** What the game points at now, or null. */
function pointed(g: Game, b: Battle): Move | null {
  if (b.choices) return g.overlay.visible && (g.lessons.visible || overlayNudge(g)) ? 'pick' : null;
  const cue = g.lessons.visible && g.tutorial ? g.tutorial.showing(b) : null;
  if (cue === 'summon' || cue === 'more' || cue === 'again') return 'summon';
  if (cue === 'upgrade') return 'upgrade';
  if (cue === 'merge') return mergeablePair(b);
  const h = hud(g);
  if (h.nudgeHand.visible) {
    if (h.nudgeArc.visible) return mergeablePair(b);
    return Math.abs(h.nudgeHand.x - h.summonButton.x) < Math.abs(h.nudgeHand.x - h.upgradeButton.x) ? 'summon' : 'upgrade';
  }
  if (g.hud.pulse && b.canSummon()) return 'summon';
  return b.canCast() ? 'cast' : null;
}

function overlayNudge(g: Game): boolean {
  const n = (g.overlay as unknown as { nudge: { visible: boolean; destroyed: boolean } | null }).nudge;
  return !!n && !n.destroyed && n.visible;
}

/** Whether the player could do something now. */
function doable(g: Game, b: Battle): boolean {
  if (b.choices) return g.overlay.visible;
  return !b.paused && (b.canSummon() || b.canUpgrade() || b.canCast() || mergeablePair(b) !== null);
}

function act(g: Game, b: Battle, m: Move): void {
  if (m === 'pick') g['pick'](b.choices![0]);
  else if (m === 'summon') b.summon();
  else if (m === 'upgrade') b.upgrade();
  else if (m === 'cast') b.cast();
  else b.move(m[0], m[1]);
}

interface Row {
  run: number;
  result: string;
  seconds: number;
  doable: number;
  unhinted: number;
  longest: number;
  /** When the longest stretch began, battle-clock seconds of real time. */
  longestAt: number;
  stretches: number;
  afterMove: number;
}

function battle(w: World, run: number): Row {
  const g = w.game;
  let seconds = 0;
  let can = 0;
  let blank = 0;
  let stretch = 0;
  const stretches: { s: number; at: number; afterMove: boolean }[] = [];
  let start = { at: 0, afterMove: false };
  let lastAct = -1;
  let seen: string | null = null;
  let since = 0;
  for (let f = 0; f < 30 * 60 * 15 && !g['ended']; f++) {
    g['tick'](FRAME);
    const b = g['battle'];
    if (!b || g['ended']) break;
    seconds += FRAME;
    const move = pointed(g, b);
    const key = move === null ? null : String(move);
    since = key !== null && key === seen ? since + FRAME : 0;
    seen = key;
    const open = doable(g, b);
    if (open) can += FRAME;
    if (open && move === null) {
      if (stretch === 0) start = { at: seconds, afterMove: f === lastAct + 1 };
      blank += FRAME;
      stretch += FRAME;
    } else if (stretch > 0) {
      stretches.push({ s: stretch, ...start });
      stretch = 0;
    }
    if (move !== null && since >= REACT) {
      act(g, b, move);
      lastAct = f;
      since = 0;
      seen = null;
    }
  }
  if (stretch > 0) stretches.push({ s: stretch, ...start });
  const counted = stretches.filter((s) => s.s > FRAME * 1.5);
  const longest = stretches.reduce((a, s) => (s.s > a.s ? s : a), { s: 0, at: 0, afterMove: false });
  return {
    run,
    result: String(g['battle']?.result ?? (g['ended'] ? 'ended' : 'timeout')),
    seconds,
    doable: can,
    unhinted: blank,
    longest: longest.s,
    longestAt: longest.at,
    stretches: counted.length,
    afterMove: counted.filter((s) => s.afterMove).length,
  };
}

it('the first three battles of a hint-following new player', { timeout: 600_000 }, () => {
  const rows: Row[] = [];
  let save: MetaSave = newMeta();
  for (let run = 1; run <= 3; run++) {
    const w = world(save, () => {}, '');
    if (run > 1) play(w);
    rows.push(battle(w, run));
    save = w.save();
  }
  const f = (s: number) => s.toFixed(1).padStart(6);
  console.log(`\nfake player reacts after ${REACT} s; targets: unhinted < ${TARGET.total} s a battle, longest < ${TARGET.longest} s`);
  console.log(' run  result   battle s  doable s  unhinted s  longest s  (at s)  stretches  after a move  ok');
  for (const r of rows) {
    const ok = r.unhinted < TARGET.total && r.longest < TARGET.longest ? 'yes' : 'NO';
    console.log(`${String(r.run).padStart(4)}  ${r.result.padEnd(7)}${f(r.seconds)}    ${f(r.doable)}    ${f(r.unhinted)}     ${f(r.longest)}  ${f(r.longestAt)}  ${String(r.stretches).padStart(9)}  ${String(r.afterMove).padStart(12)}  ${ok}`);
  }
});
