// What a host's entry gets back from boot(), and the hot-update prompt it keeps over the home
// screen when the platform has updates to offer (docs/ios.md "Hot updates").

import type { Props } from '../analytics/analytics';
import type { Game } from '../app';
import type { AppUpdates } from '../platform/types';
import { UpdatePrompt } from '../view/updatePrompt';
import { fitMenu } from '../view/viewport';

/** What a host's entry can do with the game once it is up. */
export interface GameHandle {
  /** Draws the home screen again if it is up: the store or the ads changed (iOS). */
  refresh(): void;
  /** An anomaly from before the game was up (iOS: a launch that never finished, a bundle rolled back). */
  report(kind: 'boot_fail' | 'ota_fail', props: Props): void;
}

export function gameHandle(g: Game, updates?: AppUpdates): GameHandle {
  if (updates) watchUpdates(g, updates);
  return {
    refresh: () => g.refresh(),
    report: (kind, props) => g.perf.anomalies.report(kind, props),
  };
}

/** Home with nothing over it: no battle, panel, pointing hand or stale-tab notice. */
export function homeIdle(g: Game): boolean {
  return g.menu.visible && g.panel === null && !g.overlay.visible && !(g.hintHand && !g.hintHand.destroyed) && !g.tabs?.stale;
}

function watchUpdates(g: Game, updates: AppUpdates): UpdatePrompt {
  const prompt = new UpdatePrompt(updates);
  g.app.stage.addChild(prompt.view);
  g.app.ticker.add(() => {
    // over the stage, which may have had a layer put up after it
    const stage = g.app.stage;
    if (stage.children[stage.children.length - 1] !== prompt.view) stage.addChild(prompt.view);
    prompt.update(homeIdle(g), fitMenu(g.app.screen.width, g.app.screen.height));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') prompt.hidden();
  });
  return prompt;
}
