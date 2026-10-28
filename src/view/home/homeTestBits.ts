// Stand-ins for the home panels' tests: the actions as a log of what was asked, and a phone page.

import type { MenuFit } from '../viewport';
import type { HomeActions } from './types';

export const PHONE: MenuFit = { scale: 1, w: 1080, h: 1920, wide: false };

/** Home actions that only note each call, its name and arguments. */
export function loggedActions(): { act: HomeActions; calls: [string, unknown[]][] } {
  const calls: [string, unknown[]][] = [];
  const act = new Proxy({}, { get: (_, k) => (...a: unknown[]) => void calls.push([String(k), a]) }) as HomeActions;
  return { act, calls };
}
