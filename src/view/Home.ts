// The home screen between battles, in the alchemist's-workshop look: a top bar with the daily
// login, the daily tasks and the crystals, five tabs (potions, workshop, battle, codex, shop)
// and the daily login reward, the daily tasks, the settings and a hero's milestones as panels
// over it. Each tab and panel is built in home/ (the codex in codex/); this puts them together.
// Laid out on the whole screen: a portrait page with the tabs along the bottom, or on a wide
// (desktop) screen a landscape page with the tabs down the left side. Built afresh after every
// purchase, claim or resize.

import { Container } from 'pixi.js';
import type { MetaSave } from '../sim/meta';
import type { HeroKind } from '../sim/types';
import { buildCodex, enemyPanel, isEnemy } from './codex';
import { workshopWall } from './kit';
import { navDots } from './nudges';
import type { MenuFit } from './viewport';
import { battleTab } from './home/battleTab';
import { challengePanel } from './home/challengePanel';
import { chaptersPanel } from './home/chaptersPanel';
import { consentPanel } from './home/consentPanel';
import { frame } from './home/frame';
import { heroPanel } from './home/heroPanel';
import { languagePanel } from './home/languagePanel';
import { loginPanel } from './home/loginPanel';
import { nav, NAV, RAIL, TOP } from './home/nav';
import { potionsTab } from './home/potionsTab';
import { settingsPanel } from './home/settingsPanel';
import type { Area } from './home/shared';
import { shopTab } from './home/shopTab';
import { tasksPanel } from './home/tasksPanel';
import { topBar } from './home/topBar';
import type { HomeActions, HomeExtras, HomePanel, HomeTab } from './home/types';
import { workshopTab } from './home/workshopTab';

export { HOME_TABS } from './home/types';
export type { HomeActions, HomeExtras, HomePanel, HomeTab, PlayData } from './home/types';

/** `picked`: a reserve potion tapped on the potions tab's lineup strip, waiting for the one it replaces; `ads`:
 *  a rewarded ad can be offered; `hint`: the potion whose upgrade the one-time pointer is after
 *  (a hand on the potions tab, then on that potion's button). */
export function buildHome(
  m: MetaSave,
  act: HomeActions,
  tab: HomeTab,
  panel: HomePanel,
  today: string,
  fit: MenuFit,
  picked: HeroKind | null = null,
  ads = false,
  hint: HeroKind | null = null,
  extras: HomeExtras = {},
): Container {
  const root = new Container();
  const { w, h, wide } = fit;
  root.addChild(workshopWall(w, h));
  const left = wide ? RAIL : 0;
  const top = wide ? TOP - 20 : TOP;
  const area: Area = { x: left, y: top, w: w - left, h: (wide ? h : h - NAV) - top, wide };
  if (tab === 'battle') battleTab(root, m, act, area, today);
  else if (tab === 'potions') potionsTab(root, m, act, area, picked, hint);
  else if (tab === 'workshop') workshopTab(root, m, act, area);
  else if (tab === 'codex') root.addChild(buildCodex(m, area, act.claimTier, act.panel));
  else shopTab(root, m, act, area, today, ads, ads || !!extras.adsHosted, extras.adFree ?? null);
  topBar(root, m, act, today, left, w, wide);
  // the red-dot rule is in nudges.ts; never on the tab already open
  const dots: Partial<Record<HomeTab, boolean>> = navDots(m, today, hint !== null);
  dots[tab] = false;
  nav(root, act, tab, fit, dots, hint !== null && tab !== 'potions' && !panel);
  if (panel === 'login') root.addChild(loginPanel(m, act, today, fit));
  else if (panel === 'tasks') root.addChild(tasksPanel(m, act, fit));
  else if (panel === 'settings') root.addChild(settingsPanel(m, act, fit, !!extras.privacy, !!extras.policy, extras.data ?? null));
  else if (panel === 'privacy') root.addChild(consentPanel(act, fit, !!extras.policy));
  else if (panel === 'language') root.addChild(languagePanel(act, fit));
  else if (panel === 'challenge') root.addChild(challengePanel(m, act, today, ads, fit));
  else if (panel === 'chapters') root.addChild(chaptersPanel(m, act, fit));
  else if (panel) root.addChild(isEnemy(panel) ? enemyPanel(m, panel, (title, ph) => frame(act, title, ph, fit)) : heroPanel(m, act, panel, fit));
  return root;
}
