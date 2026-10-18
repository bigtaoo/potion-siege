// CrazyGames Basic Launch benchmarks: the one place the 0-5 scores are mapped from our numbers.
//
// CG scores a Basic Launch per platform (desktop, mobile+tablet) on three metrics, each 0-5, and a
// platform passes at 9/15. The cut-offs depend on the game's category and are shown only on the
// developer portal ("Basic Launch Results" tab) once a game is in Basic Launch, so what we know
// comes from games we have seen scored there. Each metric keeps a list of points:
//
//   { at, score, kind: 'min' }    the portal said `at` is what `score` needs (its "x for 4" tip)
//   { at, score, kind: 'seen' }   a day's or window's value `at` was scored `score`
//
// Scores rise with the value, so a value at or above a point's `at` scores at least what the
// point says, and a value below a 'min' scores less (at or below a 'seen', at most that). A value
// between known points gets a range, e.g. 3-5: an honest "we don't know the 4 and 5 cut-offs yet".
//
// Units: conversion and d1 are shares (0.539 = 53.9%), playtime is minutes per player.

const m = (min, sec = 0) => min + sec / 60;

/** Points per category, platform and metric. Sources in the comments; dates are 2026. */
export const BENCHMARKS = {
  // Holy Kicker (Action), Basic Launch 10-09..10-16, from the portal (D:\standing memory
  // crazygames-basic-launch-scores.md). Final window 10-10..10-16 scored desktop 8/15, mobile 8/15.
  action: {
    desktop: {
      conversion: [
        { at: 0.521, score: 1, kind: 'seen' },
        { at: 0.5355, score: 1, kind: 'seen' },
        { at: 0.5395, score: 2, kind: 'min' }, // "needs 53.94%" / "53.95%" on 10-15 / 10-16
        { at: 0.5502, score: 2, kind: 'seen' },
        { at: 0.6308, score: 3, kind: 'min' },
      ],
      playtime: [
        { at: m(8, 12), score: 3, kind: 'seen' },
        { at: m(8, 52), score: 4, kind: 'min' },
        { at: m(12, 12), score: 5, kind: 'min' },
      ],
      d1: [
        { at: 0.0198, score: 2, kind: 'seen' },
        { at: 0.0309, score: 2, kind: 'seen' },
        { at: 0.0393, score: 3, kind: 'min' },
      ],
    },
    mobile: {
      conversion: [
        { at: 0.219, score: 1, kind: 'seen' },
        { at: 0.2857, score: 2, kind: 'min' },
      ],
      playtime: [
        { at: m(8, 42), score: 4, kind: 'seen' },
        { at: m(10, 21), score: 5, kind: 'min' },
      ],
      d1: [
        { at: 0.0455, score: 3, kind: 'seen' },
        { at: 0.0562, score: 3, kind: 'seen' },
        { at: 0.0665, score: 4, kind: 'min' },
      ],
    },
  },
  // Potion Siege's own category. Only one point so far, from Nivara: Notebook Wars (CG game
  // 136102, Strategy) on 2026-10-14.
  // TODO: once Potion Siege is in Basic Launch, copy every "x for n" tip from its portal page
  // (desktop and mobile, all three metrics) in here as 'min' points, and each day's scores as 'seen'.
  strategy: {
    desktop: {
      conversion: [], // TODO unknown
      playtime: [], // TODO unknown
      d1: [], // TODO unknown
    },
    mobile: {
      conversion: [{ at: 0.276, score: 2, kind: 'seen' }], // TODO the rest unknown
      playtime: [], // TODO unknown
      d1: [], // TODO unknown
    },
  },
};

/** Potion Siege is listed in Strategy. */
export const CATEGORY = 'strategy';

/** A platform passes Basic Launch at this total out of 15. */
export const PASS = 9;

export const METRICS = ['conversion', 'playtime', 'd1'];

/** CG's platform for our device split: touch is their mobile+tablet. */
export const platformOf = (device) => (device === 'touch' ? 'mobile' : 'desktop');

/** The score range { lo, hi } (0-5) the points allow for `value`; null value -> null. */
export function scoreRange(points, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  let lo = 0;
  let hi = 5;
  for (const p of points) {
    if (value >= p.at) lo = Math.max(lo, p.score);
    else if (p.kind === 'min') hi = Math.min(hi, p.score - 1);
    if (p.kind === 'seen' && value <= p.at) hi = Math.min(hi, p.score);
  }
  return { lo, hi: Math.max(lo, hi) };
}

/** Scores of one platform's numbers ({ conversion, playtime, d1 }, null when not measured yet). */
export function scoreDay(values, device, category = CATEGORY) {
  const points = BENCHMARKS[category][platformOf(device)];
  const scores = {};
  let lo = 0;
  let hi = 0;
  for (const k of METRICS) {
    scores[k] = scoreRange(points[k], values[k]);
    lo += scores[k]?.lo ?? 0;
    hi += scores[k]?.hi ?? 5; // a metric not measured yet could still score anything
  }
  return { ...scores, total: { lo, hi }, pass: lo >= PASS ? true : hi < PASS ? false : null };
}

/** "3" or "3-5". */
export const rangeText = (r) => (r === null ? '-' : r.lo === r.hi ? String(r.lo) : `${r.lo}-${r.hi}`);
