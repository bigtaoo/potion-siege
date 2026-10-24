import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newMeta } from '../sim/meta';

const lit = vi.hoisted(() => ({ nav: {} as Record<string, boolean>, welcome: false, login: false, tasks: false }));
vi.mock('./nudges', () => ({ navDots: () => ({ ...lit.nav }) }));
vi.mock(import('../sim/daily'), async (real) => ({ ...(await real()), canClaimLogin: () => lit.login, tasksClaimable: () => lit.tasks }));
vi.mock(import('../sim/welcome'), async (real) => ({ ...(await real()), welcomeOn: () => lit.welcome, canClaimWelcome: () => lit.welcome }));

import { homeDots, ONE_DOT_UNTIL } from './homeDots';

const on = (d: Record<string, boolean>) => Object.keys(d).filter((k) => d[k]).sort();

describe('home red dots', () => {
  beforeEach(() => {
    lit.nav = { potions: false, workshop: true, codex: true, shop: true, battle: true };
    lit.welcome = false;
    lit.login = true;
    lit.tasks = true;
  });

  it('a new player sees only the most important one', () => {
    const m = Object.assign(newMeta(), { runs: 1 });
    expect(on(homeDots(m, '2026-10-23', 'potions'))).toEqual(['battle']);
    lit.nav.potions = true;
    expect(on(homeDots(m, '2026-10-23', 'battle'))).toEqual(['potions']);
  });

  it('the open tab gives its dot to the next one', () => {
    const m = Object.assign(newMeta(), { runs: 1 });
    lit.nav.battle = false;
    expect(on(homeDots(m, '2026-10-23', 'workshop'))).toEqual(['login']);
  });

  it("the welcome week's gift comes before the daily login", () => {
    const m = Object.assign(newMeta(), { runs: 1 });
    lit.nav.battle = false;
    lit.welcome = true;
    expect(on(homeDots(m, '2026-10-23', 'workshop'))).toEqual(['welcome']);
  });

  it('the battle tab keeps its chest dot while open', () => {
    const m = Object.assign(newMeta(), { runs: 1 });
    expect(homeDots(m, '2026-10-23', 'battle').battle).toBe(true);
  });

  it('later every dot shows', () => {
    const m = Object.assign(newMeta(), { runs: ONE_DOT_UNTIL });
    expect(on(homeDots(m, '2026-10-23', 'potions'))).toEqual(['battle', 'codex', 'login', 'shop', 'tasks', 'workshop']);
  });

  it('none lit stays none', () => {
    lit.nav = { potions: false, workshop: false, codex: false, shop: false, battle: false };
    lit.login = lit.tasks = false;
    expect(on(homeDots(Object.assign(newMeta(), { runs: 0 }), '2026-10-23', 'potions'))).toEqual([]);
  });
});
