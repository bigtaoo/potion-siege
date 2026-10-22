// The home screen built over an idle battle: the panels that open by themselves (consent,
// login), the upgrade pointer, and what each of its buttons does.

import type { Game } from '../app';
import { CONSENT_AFTER_RUNS } from '../analytics/privacy';
import { t } from '../i18n';
import { claimTier } from '../sim/achievements';
import { openChapterChest } from '../sim/chapters';
import { canClaimLogin, claimBonus, claimLogin, claimTask, dayOf, rollDay } from '../sim/daily';
import { buyHero, buyUnlock, buyWorkshop, claimChest } from '../sim/meta';
import { setHardMode, stageOpen, stepStage } from '../sim/stars';
import { buildHome, type HomeExtras, type HomePanel } from '../view/Home';
import { loginPops, markSeen, upgradeHintKind } from '../view/nudges';
import { fitMenu } from '../view/viewport';
import { buy, buyAdFree, claimed, hintDone, language, lineup, restoreAdFree, shopAd } from './homeActions';
import { challengeAd, playChallenge, playEndless } from './modes';
import { beginTutorial } from './tutorialFlow';

/** The home screen over an idle battle of the chosen stage; the login reward opens by itself
 *  the first time each day it can be claimed. */
export function home(g: Game, panel: HomePanel = null): void {
  const today = dayOf(new Date());
  rollDay(g.save, today);
  const entering = !g.menu.visible;
  if (entering) g.consentVisit = false;
  // the play statistics question, from the first home screen on (never in the first battle,
  // which starts live), ahead of the login reward
  if (panel === null && g.privacy.asking() && g.save.runs >= CONSENT_AFTER_RUNS && !g.autoplay && !g.consentShown) {
    panel = 'privacy';
    g.consentShown = true;
    g.consentVisit = true;
  }
  // not between the first battles: once a few runs are in, the first time each day, and not
  // on the visit the consent panel opened (it keeps its place: events wait for its answer)
  if (panel === null && !g.consentVisit && loginPops(g.save) && canClaimLogin(g.save, today) && g.loginShown !== today) {
    panel = 'login';
    g.loginShown = today;
    g.analytics.track('dialog', { id: 'login', action: 'open', auto: true, run: g.save.runs });
  }
  if (entering) g.analytics.track('home_view', { tab: g.tab, from: 'enter', run: g.save.runs });
  g.newBattle(null);
  g.panel = panel;
  g.overlay.hide();
  g.root.visible = false;
  const fit = fitMenu(g.app.screen.width, g.app.screen.height);
  g.menuFit = fit;
  g.menu.scale.set(fit.scale);
  g.menu.visible = true;
  g.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
  // what the open tab offers puts its red dot out (view/nudges.ts)
  if (g.tab !== 'battle' && markSeen(g.save, g.tab, today)) g.store();
  // the one-time pointer at a potion upgrade, until the player has seen its button
  const hint = g.autoplay || panel ? null : upgradeHintKind(g.save);
  if (hint) g.analytics.first(g.tab === 'potions' ? 'hint_upgrade_button' : 'hint_upgrade_tab', { run: g.save.runs });
  g.hintOnButton = !!hint && g.tab === 'potions';
  g.menu.addChild(buildHome(g.save, {
    tab: (tab) => {
      if (g.hintOnButton && tab !== 'potions') hintDone(g, false);
      g.tab = tab;
      g.picked = null;
      g.storeNote = null;
      g.analytics.track('home_view', { tab, from: 'tab', run: g.save.runs });
      home(g);
    },
    panel: (p) => {
      const old = panel;
      if ((old === 'login' || old === 'tasks') && p !== old) g.analytics.track('dialog', { id: old, action: 'close', run: g.save.runs });
      if ((p === 'login' || p === 'tasks') && p !== old) g.analytics.track('dialog', { id: p, action: 'open', auto: false, run: g.save.runs });
      home(g, p);
    },
    claimLogin: (at) => {
      const n = claimLogin(g.save, today);
      if (n === 0) return;
      // claimed, the login closes by itself
      g.analytics.track('dialog', { id: 'login', action: 'claim', run: g.save.runs });
      claimed(g, 'login', n, null, at);
    },
    claimTask: (i, at) => {
      const id = g.save.daily.tasks[i]?.id;
      const n = claimTask(g.save, i);
      if (n > 0) {
        g.analytics.track('dialog', { id: 'tasks', action: 'claim', item: id ?? null, run: g.save.runs });
        claimed(g, `task_${id}`, n, panel, at);
      }
    },
    claimBonus: (at) => {
      const n = claimBonus(g.save);
      if (n > 0) claimed(g, 'task_all', n, panel, at);
    },
    claimTier: (id, at) => {
      const n = claimTier(g.save, id);
      if (n > 0) claimed(g, `ach_${id}`, n, panel, at);
    },
    stage: (d) => {
      const to = stepStage(g.save, g.save.stage, d);
      if (to === null) return;
      g.save.stage = to;
      g.store();
      home(g);
    },
    pickStage: (stage) => {
      if (!stageOpen(g.save, stage)) return;
      g.save.stage = stage;
      g.store();
      home(g);
    },
    hardMode: (on) => {
      if (!setHardMode(g.save, on)) return false;
      g.store();
      home(g);
      return true;
    },
    claimChapter: (ch, at) => {
      const n = openChapterChest(g.save, ch);
      if (n > 0) claimed(g, `chapter_${ch}`, n, panel, at);
    },
    hero: (kind) => {
      const ok = buyHero(g.save, kind);
      if (ok && hint) hintDone(g, true);
      buy(g, ok, `hero_${kind}`, g.save.heroes[kind]);
    },
    lineup: (kind) => lineup(g, kind),
    workshop: (id) => buy(g, buyWorkshop(g.save, id), `shop_${id}`, g.save.workshop[id]),
    claimChest: (at) => {
      const n = claimChest(g.save, today);
      if (n > 0) claimed(g, 'shop_chest', n, panel, at);
    },
    watchAd: () => void shopAd(g),
    unlock: (kind) => buy(g, buyUnlock(g.save, kind), `unlock_${kind}`),
    challenge: () => playChallenge(g, false),
    challengeAd: () => void challengeAd(g),
    endless: () => playEndless(g),
    sound: (which) => {
      g.save.sound[which] = !g.save.sound[which];
      g.audio.prefs(g.save.sound);
      g.store();
      home(g, 'settings');
    },
    language: (l) => void language(g, l),
    buyAdFree: () => void buyAdFree(g),
    restoreAdFree: () => void restoreAdFree(g),
    adPrivacy: () => g.platform.adPrivacy?.open(),
    privacyPolicy: () => g.platform.openUrl?.(t('sound.policyPage')),
    shareData: (on) => {
      const asked = panel === 'privacy';
      g.privacy.set(on);
      g.analytics.setSharing(g.privacy.sharing());
      // sent only if they said yes: the answer itself goes nowhere otherwise
      g.analytics.track('privacy', { on, from: asked ? 'ask' : 'settings', run: g.save.runs });
      home(g, asked ? null : 'settings');
    },
    copyId: () => {
      const id = g.analytics.playerId;
      if (!id || !g.platform.copyText) return;
      void g.platform.copyText(id).then((ok) => {
        g.idNote = ok ? 'copied' : 'failed';
        if (g.menu.visible && g.panel === 'settings') home(g, 'settings');
      });
    },
    play: () => {
      if (g.hintOnButton) hintDone(g, false);
      g.analytics.track('battle_start_tap', { stage: g.save.stage, from: 'home', run: g.save.runs + 1 });
      g.newBattle('again');
      beginTutorial(g);
      g.menu.visible = false;
      g.menu.removeChildren().forEach((c) => c.destroy({ children: true }));
      g.root.visible = true;
      g.platform.gameplayStart();
    },
  }, g.tab, panel, today, fit, g.picked, !g.autoplay && g.platform.rewardedAvailable(), hint, extras(g)));
  g.hintHand = hint ? g.menu.getChildByLabel('hintHand', true) : null;
}

/** The ad-free card and the ad privacy options, where the host has them (iOS), the link to
 *  our privacy policy (everywhere but CrazyGames), and the play statistics switch with the
 *  player ID. */
export function extras(g: Game): HomeExtras {
  const store = g.platform.store;
  if (g.panel !== 'settings') g.idNote = null;
  return {
    adFree: store ? { price: store.price(), owned: store.owned(), note: g.storeNote } : undefined,
    adsHosted: !g.autoplay && (g.platform.rewardedHosted?.() ?? g.platform.rewardedAvailable()),
    privacy: g.platform.adPrivacy?.offered() ?? false,
    policy: !!g.platform.openUrl,
    data: { sending: g.analytics.sending, id: g.analytics.playerId, copy: !!g.platform.copyText, note: g.idNote },
  };
}
