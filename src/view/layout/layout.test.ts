// Every screen in every language: no word sticks out of the panel, card, tile or button it sits
// on, nor runs into a button beside it. Text is measured by a table of real Windows Chromium
// glyph widths (see measure.ts), so this runs in node without a browser.
import './measure';
import { describe, expect, it } from 'vitest';
import type { Container } from 'pixi.js';
import { LOCALES, loadLocale, setLocale, t } from '../../i18n';
import { battleSetup, newMeta, type MetaSave } from '../../sim/meta';
import { endlessSetup } from '../../sim/endless';
import { MODIFIER_IDS } from '../../sim/challenge';
import { emptySkills, SKILL_IDS, skillMax } from '../../sim/skills';
import { ENEMY_KINDS, HERO_KINDS } from '../../sim/types';
import { FIRST_STAGE, FIRST_WAVE } from '../../sim/waves';
import { Battle } from '../../sim/battle';
import { buildHome, HOME_TABS, type HomeActions, type HomePanel } from '../Home';
import { CODEX_PAGES, scrollFeats, setCodexPage } from '../codex';
import { Overlay } from '../Overlay';
import { Hud } from '../Hud';
import { pausePanel, uprightCover, type PauseActions } from '../pausePanel';
import { PillButton } from '../kit';
import { Button } from '../ui';
import { DESIGN_H, DESIGN_W, type MenuFit } from '../viewport';
import { overflows } from './check';
import { unknownChars } from './measure';

const FITS: Record<string, MenuFit> = {
  portrait: { scale: 1, w: 1080, h: 1920, wide: false },
  tall: { scale: 1, w: 1080, h: 2340, wide: false },
  wide: { scale: 1, w: 1920, h: 1080, wide: true },
};

const noop = new Proxy({}, { get: () => () => {} }) as HomeActions;

/** Big numbers everywhere: every potion and the workshop levelled, deep into the chapters. */
function rich(): MetaSave {
  const m = newMeta();
  m.crystals = 1_234_567;
  m.cleared = 37;
  m.stage = 38;
  m.runs = 60;
  m.unlocked = ['poison', 'wind'];
  for (const k of HERO_KINDS) m.heroes[k] = 23;
  m.workshop = { wall: 7, startGold: 5, crystals: 4 };
  return m;
}

interface Screen {
  name: string;
  /** The page the words must stay on when nothing is drawn under them. */
  w: number;
  h: number;
  build(): Container;
}

function homeScreens(): Screen[] {
  const out: Screen[] = [];
  for (const [fitName, fit] of Object.entries(FITS)) {
    for (const [saveName, save] of Object.entries({ fresh: newMeta, rich })) {
      const home = (tab: (typeof HOME_TABS)[number], panel: HomePanel) => () =>
        buildHome(save(), noop, tab, panel, '2026-10-19', fit, null, true, null, {
          adFree: { price: '$4.99', owned: false, note: t('store.adFree.failed') },
          privacy: true,
          policy: true,
          vibrate: true,
        });
      const at = `${fitName}/${saveName}`;
      for (const tab of HOME_TABS) if (tab !== 'codex') out.push({ name: `${at}/${tab}`, w: fit.w, h: fit.h, build: home(tab, null) });
      for (const page of CODEX_PAGES) {
        const build = home('codex', null);
        out.push({ name: `${at}/codex ${page}`, w: fit.w, h: fit.h, build: () => (setCodexPage(page), scrollFeats(), build()) });
      }
      // the achievements list scrolled to its far end
      const feats = home('codex', null);
      out.push({ name: `${at}/codex feats end`, w: fit.w, h: fit.h, build: () => (setCodexPage('feats'), scrollFeats(1e6), feats()) });
      for (const panel of ['settings', 'language', 'tasks', 'login', 'challenge', 'chapters', ...HERO_KINDS, ...ENEMY_KINDS] as HomePanel[]) {
        out.push({ name: `${at}/${panel}`, w: fit.w, h: fit.h, build: home('potions', panel) });
      }
    }
    // one potion left to unlock, its big card alone, and the ad still loading
    const one = () => Object.assign(newMeta(), { cleared: 6, stage: 7, runs: 8, unlocked: ['poison'] });
    out.push({ name: `${fitName}/one/shop loading`, w: fit.w, h: fit.h, build: () => buildHome(one(), noop, 'shop', null, '2026-10-19', fit, null, false, null, { adsHosted: true }) });
  }
  return out;
}

function overlayScreens(): Screen[] {
  const out: Screen[] = [];
  for (const [fitName, fit] of Object.entries(FITS)) {
    const overlay = (show: (o: Overlay) => void) => () => {
      const o = new Overlay();
      o.layout(fit.w, fit.h);
      show(o);
      return o;
    };
    // every skill's card, new and one short of its top level
    for (let i = 0; i < SKILL_IDS.length; i += 3) {
      const choices = SKILL_IDS.slice(i, i + 3);
      for (const step of ['new', 'deep'] as const) {
        const levels = emptySkills();
        if (step === 'deep') for (const id of choices) levels[id] = Math.max(0, skillMax(id) - 1);
        out.push({
          name: `${fitName}/skills ${choices.join(',')} ${step}`,
          w: fit.w,
          h: fit.h,
          build: overlay((o) => o.showSkills([...choices], levels, t(i === 0 ? 'ultimatePick' : 'upgradePick'), () => {}, () => {})),
        });
      }
    }
    const stats = t('stats', { wave: 10, kills: 412, time: '12:34' });
    const dealt = HERO_KINDS.map((kind, i) => ({ kind, damage: 123_456 * (i + 1) }));
    for (const won of [true, false]) {
      out.push({
        name: `${fitName}/end ${won ? 'won' : 'lost'}`,
        w: fit.w,
        h: fit.h,
        build: overlay((o) =>
          o.showEnd(won, stats, { crystals: 1234, firstClear: won, unlocked: won ? ['poison'] : [], chest: won ? 300 : 0 }, () => {}, won ? null : () => {}, {
            onDouble: () => {},
            doubled: false,
            doublesLeft: 2,
            dealt,
            onTip: won ? null : () => {},
            onNext: won ? () => {} : null,
          }),
        ),
      });
    }
    out.push({
      name: `${fitName}/end lost adblock`,
      w: fit.w,
      h: fit.h,
      build: overlay((o) => o.showEnd(false, stats, { crystals: 640, firstClear: false, unlocked: [] }, () => {}, null, { onDouble: null, doubled: false, dealt, onTip: () => {}, adBlocked: true })),
    });
    out.push({
      name: `${fitName}/end challenge`,
      w: fit.w,
      h: fit.h,
      build: overlay((o) =>
        o.showEnd(false, stats, { crystals: 0, firstClear: false, unlocked: [] }, () => {}, null, {
          onDouble: null,
          doubled: false,
          dealt,
          onTip: null,
          challenge: { result: { wave: 14, best: 14, tier: 2, bestTier: 2, crystals: 120 }, mods: MODIFIER_IDS.slice(0, 3), trial: 'fire', streak: 4, streakBonus: 50 },
        }),
      ),
    });
    out.push({
      name: `${fitName}/end endless`,
      w: fit.w,
      h: fit.h,
      build: overlay((o) =>
        o.showEnd(false, stats, { crystals: 640, firstClear: false, unlocked: [] }, () => {}, () => {}, {
          onDouble: () => {},
          doubled: false,
          doublesLeft: 0,
          dealt,
          onTip: () => {},
          endless: { result: { wave: 31, before: 25, record: true, milestones: 200 }, best: 31, next: { wave: 40, reward: 300 } },
        }),
      ),
    });
  }
  return out;
}

/** The battle's own words: the stage, the wave, both buttons, the opening hint, each banner,
 *  each newcomer's line and each boss's card, and a challenge's modifier chips. */
function hudScreens(): Screen[] {
  const out: Screen[] = [];
  const hud = (name: string, setup: () => Battle, go: (h: Hud, b: Battle) => void): Screen => ({
    name: `hud/${name}`,
    w: DESIGN_W,
    h: DESIGN_H,
    build: () => {
      const h = new Hud(() => {}, () => {}, () => {});
      const b = setup();
      h.attach(b);
      go(h, b);
      h.update(0.016);
      return h;
    },
  });
  const stage = (n: number) => () => new Battle(1, battleSetup(rich(), n));
  out.push(hud('opening', stage(38), () => {}));
  out.push(hud('endless', () => new Battle(1, endlessSetup(rich())), (h) => h.react([{ type: 'wave', wave: 47, boss: true }])));
  for (const kind of ENEMY_KINDS) {
    if (FIRST_STAGE[kind] <= 1) continue;
    out.push(hud(`first ${kind}`, stage(FIRST_STAGE[kind]), (h) => h.react([{ type: 'wave', wave: FIRST_WAVE[kind], boss: FIRST_WAVE[kind] === 10 }])));
  }
  for (let i = 0; i < MODIFIER_IDS.length; i += 3) {
    const ids = MODIFIER_IDS.slice(i, i + 3);
    out.push(hud(`mods ${ids.join(',')}`, stage(5), (h) => h.showMods(ids, 'fire')));
  }
  return out;
}

/** The pause panel, with every switch and Give up as it first shows and waiting for its
 *  second tap, and the upright cover on a phone held sideways. */
function pauseScreens(): Screen[] {
  const out: Screen[] = [];
  const act = noop as unknown as PauseActions;
  for (const [fitName, fit] of Object.entries(FITS)) {
    for (const confirming of [false, true]) {
      out.push({ name: `pause/${fitName}${confirming ? ' confirm' : ''}`, w: fit.w, h: fit.h, build: () => pausePanel(rich(), act, fit, true, true, confirming) });
    }
  }
  out.push({ name: 'upright', w: FITS.wide.w, h: FITS.wide.h, build: () => uprightCover(FITS.wide) });
  return out;
}

describe('every language fits its boxes', () => {
  for (const l of LOCALES) {
    it(l, async () => {
      expect(await loadLocale(l)).toBe(true);
      setLocale(l);
      const found: string[] = [];
      for (const s of [...homeScreens(), ...overlayScreens(), ...hudScreens(), ...pauseScreens()]) {
        const root = s.build();
        for (const o of overflows(root, { x: 0, y: 0, width: s.w, height: s.h }, [PillButton, Button])) {
          found.push(`${s.name}: ${JSON.stringify(o.text)} ${o.side === 'button' ? 'runs into a button by' : `sticks out ${o.side} by`} ${o.by}px`);
        }
        root.destroy({ children: true });
      }
      expect([...new Set(found)]).toEqual([]);
    });
  }

  it('measures every glyph it met', () => {
    expect(unknownChars()).toEqual([]);
  });
});
