// The shape of a home guide step's rule (game/homeGuide.ts, game/homeGuideLate.ts): when its
// button would do something, what it points at on the screen about to be built, and how a tap
// counts for it; with the helpers for a step on a tab or in a top-bar panel.

import type { MetaSave } from '../sim/meta';
import type { HomePanel, HomeTab } from '../view/Home';

export type Tap = 'done' | 'path';
export type Where = { panel: HomePanel; tab: HomeTab; today: string };

export interface Rule {
  /** The step's button would do something now. */
  can(m: MetaSave, today: string): boolean;
  aim(m: MetaSave, w: Where): string | null;
  /** How an action counts: the step itself, on its way, or (undefined) round it. */
  tap(act: string, arg: unknown): Tap | undefined;
}

/** A tab's step: the tab's button, then `inner` once it is open; nothing over a panel. */
export const onTab = (tab: HomeTab, inner: string) => (w: Where) => (w.panel ? null : w.tab === tab ? inner : `tab_${tab}`);
/** A top-bar panel's step: its button, then `inner` in the panel. */
export const inPanel = (panel: HomePanel & string, top: string, inner: string) => (w: Where) => (w.panel === panel ? inner : w.panel ? null : top);
